import { logger } from '@quilibrium/quorum-shared';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Conversation, Message, Space, Bookmark, BOOKMARKS_CONFIG } from '../api/quorumApi';
import type { NotificationSettings } from '../types/notifications';
import type { IconColor } from '../components/space/IconPicker/types';
import type { IconName } from '../components/primitives/Icon/types';
import type { QueueTask, TaskStatus, QueueStats } from '../types/actionQueue';
import MiniSearch from 'minisearch';

export interface EncryptedMessage {
  encryptedContent: string;
  inboxAddress: string;
  timestamp: number;
}

export interface EncryptionState {
  state: string;
  timestamp: number;
  conversationId: string;
  inboxId: string;
  sentAccept?: boolean;
}

export interface DecryptionResult {
  decryptedMessage: Message;
  newState: any;
}

// Folder color type (reuses icon colors)
export type FolderColor = IconColor;

// NavItem represents either a standalone space or a folder containing spaces
export type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;                   // crypto.randomUUID()
      name: string;                 // User-defined name (default: "Spaces")
      spaceIds: string[];           // Spaces in this folder (ordered)
      icon?: IconName;              // Custom icon (always rendered white, default: 'folder')
      iconVariant?: 'outline' | 'filled'; // Icon style variant (default: 'outline')
      color?: FolderColor;          // Folder background color (default: 'default' = gray)
      createdDate: number;
      modifiedDate: number;
    };

export type UserConfig = {
  address: string;
  spaceIds: string[];               // KEPT for backwards compatibility (derived from items)
  items?: NavItem[];                // Single source of truth for ordering & folders
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  name?: string;                    // User's display name (synced from profile)
  profile_image?: string;           // User's profile image as data URI (synced from profile)
  spaceKeys?: {
    spaceId: string;
    encryptionState: {
      conversationId: string;
      inboxId: string;
      state: string;
      timestamp: number;
    };
    keys: {
      keyId: string;
      address?: string;
      publicKey: string;
      privateKey: string;
      spaceId: string;
    }[];
  }[];
  notificationSettings?: {
    [spaceId: string]: NotificationSettings;
  };
  bookmarks?: Bookmark[];
  deletedBookmarkIds?: string[];
  // Channel mute settings: maps spaceId to array of muted channelIds
  mutedChannels?: {
    [spaceId: string]: string[];
  };
  // Global preference for showing muted channels in list (default: true = visible with 60% opacity)
  showMutedChannels?: boolean;
  // Favorite DM conversation IDs for quick access filtering
  favoriteDMs?: string[];
};

export interface SearchableMessage {
  id: string;
  messageId: string;
  spaceId: string;
  channelId: string;
  content: string;
  senderId: string;
  createdDate: number;
  type: string;
}

export interface SearchContext {
  type: 'space' | 'dm';
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
}

export interface MutedUserRecord {
  spaceId: string;
  targetUserId: string;
  mutedAt: number;
  mutedBy: string;
  lastMuteId: string;
  expiresAt?: number; // undefined = forever
}

/**
 * Tombstone record for deleted messages.
 * Prevents deleted messages from being re-added during peer sync.
 */
export interface DeletedMessageRecord {
  messageId: string;
  spaceId: string;
  channelId: string;
  deletedAt: number;
}

export interface SearchResult {
  message: Message;
  score: number;
  highlights: string[];
}

export class MessageDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'quorum_db';
  private readonly DB_VERSION = 7;
  private searchIndices: Map<string, MiniSearch<SearchableMessage>> = new Map();
  private indexInitialized = false;

  async init() {
    if (this.db) return;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (event.oldVersion < 1) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'messageId',
          });
          messageStore.createIndex('by_conversation_time', [
            'spaceId',
            'channelId',
            'createdDate',
          ]);

          const conversationStore = db.createObjectStore('conversations', {
            keyPath: ['conversationId'],
          });
          conversationStore.createIndex('by_type_time', ['type', 'timestamp']);

          db.createObjectStore('encryption_states', {
            keyPath: ['conversationId', 'inboxId'],
          });

          const conversationUsersStore = db.createObjectStore(
            'conversation_users',
            { keyPath: 'address' }
          );
          conversationUsersStore.createIndex('by_conversation', [
            'conversationId',
          ]);

          db.createObjectStore('user_info', { keyPath: 'address' });
          db.createObjectStore('inbox_mapping', { keyPath: 'inboxId' });
          db.createObjectStore('latest_states', { keyPath: 'conversationId' });
        }

        if (event.oldVersion < 2) {
          db.createObjectStore('spaces', { keyPath: 'spaceId' });
          db.createObjectStore('space_keys', { keyPath: ['spaceId', 'keyId'] });
          const spaceMembers = db.createObjectStore('space_members', {
            keyPath: ['spaceId', 'user_address'],
          });
          spaceMembers.createIndex('by_address', ['user_address']);
          db.createObjectStore('user_config', { keyPath: 'address' });
        }

        if (event.oldVersion < 3) {
          // Add index for pinned messages
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const messageStore = transaction.objectStore('messages');
            // Create index for efficiently querying pinned messages
            messageStore.createIndex('by_channel_pinned', [
              'spaceId',
              'channelId',
              'isPinned',
              'pinnedAt',
            ]);
          }
        }

        if (event.oldVersion < 4) {
          // Add bookmarks object store
          const bookmarksStore = db.createObjectStore('bookmarks', {
            keyPath: 'bookmarkId',
          });

          // Create indices for efficient querying
          bookmarksStore.createIndex('by_message', 'messageId'); // Essential for O(1) isBookmarked check
          bookmarksStore.createIndex('by_created', 'createdAt'); // For chronological listing
        }

        if (event.oldVersion < 5) {
          // Add muted_users object store for client-side mute enforcement
          const mutedUsersStore = db.createObjectStore('muted_users', {
            keyPath: ['spaceId', 'targetUserId'],
          });
          mutedUsersStore.createIndex('by_space', 'spaceId');
          mutedUsersStore.createIndex('by_mute_id', 'lastMuteId');
        }

        if (event.oldVersion < 6) {
          // Add action_queue object store for persistent background task queue
          const queueStore = db.createObjectStore('action_queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('taskType', 'taskType', { unique: false });
          queueStore.createIndex('key', 'key', { unique: false });
          queueStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
        }

        if (event.oldVersion < 7) {
          // Add deleted_messages object store for tombstone tracking
          // Prevents deleted messages from being re-added during peer sync
          const deletedMessagesStore = db.createObjectStore('deleted_messages', {
            keyPath: 'messageId',
          });
          deletedMessagesStore.createIndex('by_space_channel', ['spaceId', 'channelId']);
          deletedMessagesStore.createIndex('by_deleted_at', 'deletedAt');
        }
      };
    });
  }

  async getMessage({
    spaceId,
    channelId,
    messageId,
  }: {
    spaceId: string;
    channelId: string;
    messageId: string;
  }): Promise<Message | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');

      const request = store.get(messageId);

      request.onsuccess = (event) => {
        const message = request.result;

        if (message?.channelId === channelId && message?.spaceId === spaceId) {
          resolve(message as Message);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a message by ID only, without context validation.
   * Used for bookmark resolution where we just need to display the message.
   * Falls back gracefully if message not found (e.g., cross-device sync).
   */
  async getMessageById(messageId: string): Promise<Message | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');

      const request = store.get(messageId);

      request.onsuccess = () => {
        resolve(request.result as Message | undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSpaceMessages({
    spaceId,
  }: {
    spaceId: string;
  }): Promise<Message[]> {
    await this.init();
    return new Promise(async (resolve, reject) => {
      const space = await this.getSpace(spaceId);

      if (!space || !space.groups || space.groups.length === 0) {
        resolve([]);
        return;
      }

      const channelIds = space.groups
        .flatMap((g) => g.channels.map((c) => c.channelId))
        .sort();

      if (channelIds.length === 0) {
        resolve([]);
        return;
      }

      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      let range: IDBKeyRange;

      // Initial load - get latest messages
      range = IDBKeyRange.bound(
        [spaceId, channelIds[0], 0],
        [spaceId, channelIds[channelIds.length - 1], Number.MAX_VALUE]
      );

      const request = index.getAll(range);

      request.onsuccess = (event) => {
        const messages = request.result;

        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages({
    spaceId,
    channelId,
    cursor,
    direction = 'backward',
    limit = 100,
  }: {
    spaceId: string;
    channelId: string;
    cursor?: number;
    direction?: 'forward' | 'backward';
    limit?: number;
  }): Promise<{
    messages: Message[];
    nextCursor: number | null;
    prevCursor: number | null;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      let range: IDBKeyRange;
      if (!cursor) {
        // Initial load - get latest messages
        range = IDBKeyRange.bound(
          [spaceId, channelId, 0],
          [spaceId, channelId, Number.MAX_VALUE]
        );
      } else if (direction === 'forward') {
        // Get messages newer than cursor
        range = IDBKeyRange.bound(
          [spaceId, channelId, cursor],
          [spaceId, channelId, Number.MAX_VALUE],
          true
        );
      } else {
        // Get messages older than cursor
        range = IDBKeyRange.bound(
          [spaceId, channelId, 0],
          [spaceId, channelId, cursor],
          false,
          true // exclude the cursor value itself
        );
      }

      // For initial load and backward pagination, we want reverse order
      const request =
        !cursor || direction === 'backward'
          ? index.openCursor(range, 'prev')
          : index.openCursor(range, 'next');

      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Calculate cursors for next/prev pages
          const nextCursor =
            messages.length === limit
              ? direction === 'forward'
                ? messages[messages.length - 1].createdDate
                : messages[0].createdDate
              : null;

          const prevCursor =
            messages.length > 0
              ? direction === 'forward'
                ? messages[0].createdDate
                : messages[messages.length - 1].createdDate
              : null;

          // For backward pagination and initial load, reverse the array
          // to maintain chronological order
          if (!cursor || direction === 'backward') {
            messages.reverse();
          }

          resolve({
            messages,
            nextCursor,
            prevCursor,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUser({
    address,
  }: {
    address: string;
  }): Promise<{ userProfile: channel.UserProfile }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_info', 'readonly');
      const store = transaction.objectStore('user_info');

      const request = store.get(address);

      request.onsuccess = () => {
        const userProfile = request.result;
        resolve({ userProfile });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUserConfig({ address }: { address: string }): Promise<UserConfig> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_config', 'readonly');
      const store = transaction.objectStore('user_config');

      const request = store.get(address);

      request.onsuccess = () => {
        const userConfig = request.result;
        resolve(userConfig);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEncryptionStates(): Promise<EncryptionState[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('encryption_states', 'readonly');
      const store = transaction.objectStore('encryption_states');

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEncryptionStates({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<EncryptionState[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('encryption_states', 'readonly');
      const store = transaction.objectStore('encryption_states');

      const request = store.getAll(
        IDBKeyRange.bound(
          [conversationId, '\u0000'],
          [conversationId, '\uffff']
        )
      );

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getInboxMapping(inboxId: string): Promise<string | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('inbox_mapping', 'readonly');
      const store = transaction.objectStore('inbox_mapping');
      const request = store.get(inboxId);

      request.onsuccess = () => resolve(request.result?.conversationId || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveReadTime({
    conversationId,
    lastMessageTimestamp,
  }: {
    conversationId: string;
    lastMessageTimestamp: number;
  }): Promise<void> {
    const conversation = await this.getConversation({ conversationId });

    if (conversation.conversation) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction('conversations', 'readwrite');
        const store = transaction.objectStore('conversations');
        const request = store.put({
          ...conversation.conversation,
          lastReadTimestamp: lastMessageTimestamp,
        });

        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getConversation({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<{ conversation?: Conversation }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('conversations', 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get([conversationId]);

      request.onsuccess = () => {
        const conversation = request.result;
        resolve({ conversation });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('conversations', 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conversation);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getConversations({
    type,
    cursor,
    limit = 1000,
  }: {
    type: 'direct' | 'group';
    cursor?: number;
    limit?: number;
  }): Promise<{ conversations: Conversation[]; nextCursor: number | null }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('conversations', 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('by_type_time');

      const range = cursor
        ? IDBKeyRange.upperBound([type, cursor])
        : IDBKeyRange.bound([type, 0], [type, Number.MAX_VALUE]);

      const request = index.getAll(range, limit);

      request.onsuccess = () => {
        const conversations = request.result;
        const nextCursor =
          conversations.length === limit
            ? conversations[conversations.length - 1].timestamp
            : null;
        resolve({ conversations, nextCursor });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserProfile(userProfile: channel.UserProfile): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_info', 'readwrite');
      const store = transaction.objectStore('user_info');
      const request = store.put(userProfile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserConfig(userConfig: UserConfig): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_config', 'readwrite');
      const store = transaction.objectStore('user_config');
      const request = store.put(userConfig);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversationUsers(
    conversationId: string,
    addresses: string[]
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        'conversation_users',
        'readwrite'
      );
      const store = transaction.objectStore('conversation_users');
      for (const address of addresses) {
        store.put({ conversationId, address });
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveSpaceMember(
    spaceId: string,
    userProfile: channel.UserProfile & {
      inbox_address: string;
      isKicked?: boolean;
    }
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_members', 'readwrite');
      const store = transaction.objectStore('space_members');
      store.put({ ...userProfile, spaceId });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<
    channel.UserProfile & { inbox_address: string; isKicked?: boolean }
  > {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_members', 'readonly');
      const store = transaction.objectStore('space_members');

      const request = store.get([spaceId, user_address]);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSpaceMembers(
    spaceId: string
  ): Promise<
    (channel.UserProfile & { inbox_address: string; isKicked?: boolean })[]
  > {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_members', 'readonly');
      const store = transaction.objectStore('space_members');

      const range = IDBKeyRange.bound([spaceId, '\u0000'], [spaceId, '\uffff']);

      const request = store.getAll(range);

      request.onsuccess = () => {
        const members = request.result;
        resolve(members);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_members', 'readwrite');
      const store = transaction.objectStore('space_members');

      const request = store.delete([spaceId, user_address]);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(
    message: Message,
    lastMessageTimestamp: number,
    address: string,
    conversationType: string,
    icon: string,
    displayName: string,
    currentUserAddress?: string
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['messages', 'conversations'],
        'readwrite'
      );
      const store = transaction.objectStore('messages');
      const messageRequest = store.put(message);
      messageRequest.onerror = () => reject(messageRequest.error);

      const conversationStore = transaction.objectStore('conversations');

      // Get existing conversation to preserve data like isRepudiable
      const conversationId = message.spaceId + '/' + message.channelId;
      const getRequest = conversationStore.get([conversationId]);
      getRequest.onsuccess = () => {
        const existingConv = getRequest.result;
        // Update lastReadTimestamp if this is our own message (prevents false unread indicators)
        const isOwnMessage =
          currentUserAddress && message.content?.senderId === currentUserAddress;
        const request = conversationStore.put({
          ...existingConv, // Preserve existing fields including isRepudiable
          conversationId,
          address: address,
          icon: icon,
          displayName: displayName,
          type: conversationType,
          timestamp: message.createdDate,
          lastMessageId: message.messageId, // Track last message for previews
          ...(isOwnMessage ? { lastReadTimestamp: message.createdDate } : {}),
        });
        request.onerror = () => reject(request.error);
      };
      getRequest.onerror = () => reject(getRequest.error);

      transaction.oncomplete = () => {
        // Add message to search index after saving
        this.addMessageToIndex(message).catch((error) => {
          logger.warn('Failed to add message to search index:', error);
        });
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.init();

    // Get message first to extract spaceId and channelId for search index removal and tombstone
    const message = await new Promise<Message | undefined>((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.get(messageId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return new Promise((resolve, reject) => {
      // Include 'bookmarks' and 'deleted_messages' stores
      const transaction = this.db!.transaction(
        ['messages', 'bookmarks', 'deleted_messages'],
        'readwrite'
      );
      const messageStore = transaction.objectStore('messages');
      const bookmarkStore = transaction.objectStore('bookmarks');
      const deletedMessagesStore = transaction.objectStore('deleted_messages');

      // Delete the message
      const messageRequest = messageStore.delete(messageId);
      messageRequest.onerror = () => reject(messageRequest.error);

      // Save tombstone to prevent re-sync (only for channel messages, not DMs)
      // DMs don't have a sync mechanism, so tombstones aren't needed
      // DM detection: spaceId === channelId (both are partner's address)
      if (message && message.spaceId !== message.channelId) {
        const tombstone: DeletedMessageRecord = {
          messageId,
          spaceId: message.spaceId,
          channelId: message.channelId,
          deletedAt: Date.now(),
        };
        deletedMessagesStore.put(tombstone);
      }

      // Cascade delete: Remove any bookmark pointing to this message
      const bookmarkIndex = bookmarkStore.index('by_message');
      const bookmarkRequest = bookmarkIndex.get(messageId);
      bookmarkRequest.onsuccess = () => {
        const bookmark = bookmarkRequest.result;
        if (bookmark) {
          bookmarkStore.delete(bookmark.bookmarkId);
        }
      };

      transaction.oncomplete = () => {
        // Remove from search index after deleting
        if (message) {
          this.removeMessageFromIndex(
            messageId,
            message.spaceId,
            message.channelId
          ).catch((error) => {
            logger.warn('Failed to remove message from search index:', error);
          });
        }
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Check if a message has been deleted (tombstone exists).
   * Used to prevent deleted messages from being re-added during peer sync.
   */
  async isMessageDeleted(messageId: string): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['deleted_messages'], 'readonly');
      const store = transaction.objectStore('deleted_messages');
      const request = store.get(messageId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveEncryptionState(
    state: EncryptionState,
    wasFirstAttempt: boolean
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['encryption_states', 'latest_states'],
        'readwrite'
      );

      // Always save to history
      const stateStore = transaction.objectStore('encryption_states');
      stateStore.put(state);

      // Only update latest state if this was the first successful attempt
      if (wasFirstAttempt) {
        const latestStore = transaction.objectStore('latest_states');
        latestStore.put(state);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSpaceKey(
    spaceId: string,
    keyId: string
  ): Promise<{
    address?: string;
    spaceId: string;
    keyId: string;
    publicKey: string;
    privateKey: string;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_keys', 'readonly');
      const store = transaction.objectStore('space_keys');
      const request = store.get([spaceId, keyId]);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSpaceKeys(spaceId: string): Promise<
    {
      address?: string;
      spaceId: string;
      keyId: string;
      publicKey: string;
      privateKey: string;
    }[]
  > {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_keys', 'readonly');
      const store = transaction.objectStore('space_keys');

      const range = IDBKeyRange.bound([spaceId, '\u0000'], [spaceId, '\uffff']);

      const request = store.getAll(range);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSpaceKey(key: {
    spaceId: string;
    keyId: string;
    address?: string;
    publicKey: string;
    privateKey: string;
  }): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['space_keys'], 'readwrite');

      const stateStore = transaction.objectStore('space_keys');
      stateStore.put(key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteSpaceKey(spaceId: string, keyId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['space_keys'], 'readwrite');

      const stateStore = transaction.objectStore('space_keys');
      stateStore.delete([spaceId, keyId]);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteEncryptionState(state: EncryptionState): Promise<void> {
    if (!state) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ['encryption_states'],
        'readwrite'
      );

      const stateStore = transaction.objectStore('encryption_states');
      stateStore.delete([state.conversationId, state.inboxId]);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSpaces(): Promise<Space[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('spaces', 'readonly');
      const store = transaction.objectStore('spaces');

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSpace(spaceId: string): Promise<Space | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('spaces', 'readwrite');
      const store = transaction.objectStore('spaces');

      const request = store.delete(spaceId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSpace(spaceId: string): Promise<Space | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('spaces', 'readonly');
      const store = transaction.objectStore('spaces');

      const request = store.get(spaceId);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSpace(space: Space): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['spaces'], 'readwrite');

      const stateStore = transaction.objectStore('spaces');
      stateStore.put(space);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Search functionality
  private extractTextFromMessage(message: Message): string {
    if (message.content.type === 'post') {
      const content = message.content.text;
      return Array.isArray(content) ? content.join(' ') : content;
    }
    if (message.content.type === 'event') {
      return message.content.text;
    }
    return '';
  }

  private messageToSearchable(message: Message): SearchableMessage {
    return {
      id: message.messageId,
      messageId: message.messageId,
      spaceId: message.spaceId,
      channelId: message.channelId,
      content: this.extractTextFromMessage(message),
      senderId: message.content.senderId,
      createdDate: message.createdDate,
      type: message.content.type,
    };
  }

  private createSearchIndex(): MiniSearch<SearchableMessage> {
    return new MiniSearch({
      fields: ['content', 'senderId'],
      storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
      searchOptions: {
        boost: { content: 2, senderId: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  private getIndexKey(context: SearchContext): string {
    if (context.type === 'space') {
      return `space:${context.spaceId}`;
    } else {
      return `dm:${context.conversationId}`;
    }
  }

  async initializeSearchIndices(): Promise<void> {
    if (this.indexInitialized) return;

    await this.init();

    // Get all spaces and conversations to build indices
    const spaces = await this.getSpaces();
    const dmConversations = await this.getConversations({ type: 'direct' });

    // Initialize space indices
    for (const space of spaces) {
      const indexKey = `space:${space.spaceId}`;
      const messages = await this.getAllSpaceMessages({
        spaceId: space.spaceId,
      });

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
    }

    // Initialize DM indices
    for (const conversation of dmConversations.conversations) {
      const indexKey = `dm:${conversation.conversationId}`;
      // Get DM messages (need to implement this method)
      const messages = await this.getDirectMessages(
        conversation.conversationId
      );

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
    }

    this.indexInitialized = true;
  }

  async addMessageToIndex(message: Message): Promise<void> {
    const searchable = this.messageToSearchable(message);

    // Add to space index
    const spaceIndexKey = `space:${message.spaceId}`;
    const spaceIndex = this.searchIndices.get(spaceIndexKey);
    if (spaceIndex) {
      if (spaceIndex.has(message.messageId)) {
        spaceIndex.replace(searchable);
      } else {
        spaceIndex.add(searchable);
      }
    }

    // If it's a DM, also add to DM index
    const conversationId = `${message.spaceId}/${message.channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      if (dmIndex.has(message.messageId)) {
        dmIndex.replace(searchable);
      } else {
        dmIndex.add(searchable);
      }
    }
  }

  async removeMessageFromIndex(
    messageId: string,
    spaceId: string,
    channelId: string
  ): Promise<void> {
    // Remove from space index
    const spaceIndexKey = `space:${spaceId}`;
    const spaceIndex = this.searchIndices.get(spaceIndexKey);
    if (spaceIndex) {
      spaceIndex.discard(messageId);
    }

    // Remove from DM index if applicable
    const conversationId = `${spaceId}/${channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.discard(messageId);
    }
  }

  async searchMessages(
    query: string,
    context: SearchContext,
    limit: number = 50
  ): Promise<SearchResult[]> {
    if (!this.indexInitialized) {
      await this.initializeSearchIndices();
    }

    const indexKey = this.getIndexKey(context);
    const searchIndex = this.searchIndices.get(indexKey);

    if (!searchIndex) {
      return [];
    }

    const searchResults = searchIndex.search(query, {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR',
    });

    // Get full message objects and create results
    const results: SearchResult[] = [];

    for (const result of searchResults.slice(0, limit)) {
      try {
        const message = await this.getMessage({
          spaceId: result.spaceId || '',
          channelId: result.channelId || '',
          messageId: result.id,
        });

        if (message) {
          results.push({
            message,
            score: result.score,
            highlights: result.terms,
          });
        }
      } catch (error) {
        logger.warn(
          'Failed to get message for search result:',
          result.id,
          error
        );
      }
    }

    // Sort by relevance score (best match first)
    // MiniSearch provides well-tuned relevance scoring
    return results.sort((a, b) => b.score - a.score);
  }

  private async getDirectMessages(conversationId: string): Promise<Message[]> {
    // Parse conversationId to get spaceId and channelId
    const [spaceId, channelId] = conversationId.split('/');
    if (!spaceId || !channelId) return [];

    const result = await this.getMessages({ spaceId, channelId, limit: 1000 });
    return result.messages;
  }

  async getAllConversationMessages({
    spaceId,
    channelId,
  }: {
    spaceId: string;
    channelId: string;
  }): Promise<Message[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_VALUE]
      );

      const request = index.getAll(range);

      request.onsuccess = () => {
        const messages = request.result;
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessagesForConversation(conversationId: string): Promise<void> {
    await this.init();
    const [spaceId, channelId] = conversationId.split('/');
    if (!spaceId || !channelId) return;
    return new Promise((resolve, reject) => {
      // Include 'bookmarks' store to cascade delete bookmarks for deleted messages
      const transaction = this.db!.transaction(['messages', 'bookmarks'], 'readwrite');
      const store = transaction.objectStore('messages');
      const bookmarkStore = transaction.objectStore('bookmarks');
      const bookmarkIndex = bookmarkStore.index('by_message');
      const index = store.index('by_conversation_time');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_VALUE]
      );

      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          const msg = cursor.value as Message;
          try {
            // Remove from in-memory search indices if present
            const spaceIndexKey = `space:${msg.spaceId}`;
            const spaceIndex = this.searchIndices.get(spaceIndexKey);
            if (spaceIndex) spaceIndex.discard(msg.messageId);

            const dmIndexKey = `dm:${msg.spaceId}/${msg.channelId}`;
            const dmIndex = this.searchIndices.get(dmIndexKey);
            if (dmIndex) dmIndex.discard(msg.messageId);
          } catch {}

          // Cascade delete: Remove any bookmark pointing to this message
          const bookmarkRequest = bookmarkIndex.get(msg.messageId);
          bookmarkRequest.onsuccess = () => {
            const bookmark = bookmarkRequest.result;
            if (bookmark) {
              bookmarkStore.delete(bookmark.bookmarkId);
            }
          };

          store.delete(msg.messageId);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('conversations', 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.delete([conversationId]);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteUser(address: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_info', 'readwrite');
      const store = transaction.objectStore('user_info');
      const request = store.delete(address);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversationUsers(conversationId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        'conversation_users',
        'readwrite'
      );
      const store = transaction.objectStore('conversation_users');
      const index = store.index('by_conversation');

      const range = IDBKeyRange.only(conversationId);
      const getAllReq = index.getAll(range);

      getAllReq.onsuccess = () => {
        const users = getAllReq.result as { address: string }[];
        for (const u of users) {
          store.delete(u.address);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      getAllReq.onerror = () => reject(getAllReq.error);
    });
  }

  async deleteInboxMapping(inboxId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('inbox_mapping', 'readwrite');
      const store = transaction.objectStore('inbox_mapping');
      const request = store.delete(inboxId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLatestState(conversationId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['latest_states'], 'readwrite');
      const store = transaction.objectStore('latest_states');
      const request = store.delete(conversationId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing message in IndexedDB (for optimistic updates)
   */
  async updateMessage(message: Message): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Pinned Messages Methods
  async getPinnedMessages(
    spaceId: string,
    channelId: string
  ): Promise<Message[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      // Get all messages for this channel, then filter for pinned ones
      // This approach works reliably with the existing index structure
      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_SAFE_INTEGER]
      );

      const request = index.getAll(range);

      request.onsuccess = () => {
        const allMessages = request.result || [];
        // Filter for pinned messages only
        const pinnedMessages = allMessages.filter(
          (msg) => msg.isPinned === true
        );
        // Sort by pinned date (newest first), falling back to creation date
        pinnedMessages.sort((a, b) => {
          const aPinnedAt = a.pinnedAt || a.createdDate;
          const bPinnedAt = b.pinnedAt || b.createdDate;
          return bPinnedAt - aPinnedAt;
        });
        resolve(pinnedMessages);
      };
      request.onerror = () => {
        console.error('Error getting pinned messages:', request.error);
        reject(request.error);
      };
    });
  }

  async updateMessagePinStatus(
    messageId: string,
    isPinned: boolean,
    pinnedBy?: string
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const getRequest = store.get(messageId);

      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (!message) {
          console.error('Message not found:', messageId);
          reject(new Error('Message not found'));
          return;
        }

        // Update pin status
        message.isPinned = isPinned;
        if (isPinned) {
          message.pinnedAt = Date.now();
          message.pinnedBy = pinnedBy;
        } else {
          delete message.pinnedAt;
          delete message.pinnedBy;
        }

        const putRequest = store.put(message);
        putRequest.onsuccess = () => {
          resolve();
        };
        putRequest.onerror = () => {
          console.error('Error updating message:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error('Error getting message:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  async getPinnedMessageCount(
    spaceId: string,
    channelId: string
  ): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      // Get all messages for this channel, then count pinned ones
      // This approach works reliably with the existing index structure
      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_SAFE_INTEGER]
      );

      const request = index.getAll(range);

      request.onsuccess = () => {
        const allMessages = request.result || [];
        // Count pinned messages only
        const pinnedCount = allMessages.filter(
          (msg) => msg.isPinned === true
        ).length;
        resolve(pinnedCount);
      };
      request.onerror = () => {
        console.error('Error counting pins:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get unread messages that mention a specific user
   *
   * This is an optimized query for mention counting that:
   * 1. Only retrieves messages after lastReadTimestamp
   * 2. Filters for messages that mention the user
   * 3. Supports early-exit with limit parameter
   *
   * Note: This implementation uses existing indexes and filters in memory.
   * For optimal performance at scale, consider adding a dedicated compound index
   * for [spaceId, channelId, mentionedUserId, createdDate] in a future DB migration.
   *
   * @param spaceId - The space ID
   * @param channelId - The channel ID
   * @param afterTimestamp - Only get messages created after this timestamp (typically lastReadTimestamp)
   * @param limit - Maximum number of mention messages to return (default: 10 for early-exit optimization)
   * @returns Array of messages mentioning the user
   */
  async getUnreadMentions({
    spaceId,
    channelId,
    afterTimestamp,
    limit = 10,
  }: {
    spaceId: string;
    channelId: string;
    afterTimestamp: number;
    limit?: number;
  }): Promise<Message[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      // Use existing index to get messages after timestamp
      const range = IDBKeyRange.bound(
        [spaceId, channelId, afterTimestamp],
        [spaceId, channelId, Number.MAX_VALUE],
        true, // Exclude afterTimestamp itself
        false
      );

      const request = index.openCursor(range, 'next');
      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          const message = cursor.value as Message;

          // Only include messages with mentions
          // Note: The calling code will still need to filter by userAddress
          // since we don't have a dedicated mention index yet
          if (message.mentions) {
            messages.push(message);
          }

          // Continue only if we haven't reached the limit
          if (messages.length < limit) {
            cursor.continue();
          } else {
            resolve(messages);
          }
        } else {
          resolve(messages);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get unread messages that are replies to a specific user's messages
   *
   * This is an optimized query for reply notification counting that:
   * 1. Only retrieves messages after lastReadTimestamp
   * 2. Filters for messages with replyMetadata.parentAuthor matching the user
   * 3. Supports early-exit with limit parameter
   *
   * Note: This implementation uses existing indexes and filters in memory.
   * Reply notifications are stored in the message's replyMetadata field.
   *
   * @param spaceId - The space ID
   * @param channelId - The channel ID
   * @param userAddress - The user's address to check for replies
   * @param afterTimestamp - Only get messages created after this timestamp (typically lastReadTimestamp)
   * @param limit - Maximum number of reply messages to return (default: 10 for early-exit optimization)
   * @returns Array of messages that are replies to the user
   */
  async getUnreadReplies({
    spaceId,
    channelId,
    userAddress,
    afterTimestamp,
    limit = 10,
  }: {
    spaceId: string;
    channelId: string;
    userAddress: string;
    afterTimestamp: number;
    limit?: number;
  }): Promise<Message[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      // Use existing index to get messages after timestamp
      const range = IDBKeyRange.bound(
        [spaceId, channelId, afterTimestamp],
        [spaceId, channelId, Number.MAX_VALUE],
        true, // Exclude afterTimestamp itself
        false
      );

      const request = index.openCursor(range, 'next');
      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          const message = cursor.value as Message;

          // Only include messages with replyMetadata that reply to the user
          if (message.replyMetadata?.parentAuthor === userAddress) {
            messages.push(message);
          }

          // Continue only if we haven't reached the limit
          if (messages.length < limit) {
            cursor.continue();
          } else {
            resolve(messages);
          }
        } else {
          resolve(messages);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if there are any unread messages in a channel
   *
   * This is an optimized query for unread indicators that:
   * 1. Only checks if ANY message exists after lastReadTimestamp
   * 2. Returns immediately on finding the first unread message (early exit)
   * 3. Much more efficient than counting all unread messages
   *
   * @param spaceId - The space ID
   * @param channelId - The channel ID
   * @param afterTimestamp - Only check messages created after this timestamp (typically lastReadTimestamp)
   * @returns Promise<boolean> - true if there are unread messages, false otherwise
   */
  /**
   * Get the first unread message in a channel
   *
   * This query is used for auto-jump navigation to help users land at the first
   * unread message when entering a channel with unreads.
   *
   * The query:
   * 1. Uses the existing by_conversation_time index
   * 2. Gets the first message after lastReadTimestamp
   * 3. Returns messageId and timestamp for cursor calculation
   *
   * @param spaceId - The space ID
   * @param channelId - The channel ID
   * @param afterTimestamp - Only get messages created after this timestamp (typically lastReadTimestamp)
   * @returns Promise with messageId and timestamp, or null if no unread messages
   */
  async getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp,
  }: {
    spaceId: string;
    channelId: string;
    afterTimestamp: number;
  }): Promise<{ messageId: string; timestamp: number } | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      // Use existing index to get messages after timestamp
      const range = IDBKeyRange.bound(
        [spaceId, channelId, afterTimestamp],
        [spaceId, channelId, Number.MAX_VALUE],
        true, // Exclude afterTimestamp itself
        false
      );

      const request = index.openCursor(range, 'next');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const message = cursor.value as Message;
          // Return the first unread message
          resolve({
            messageId: message.messageId,
            timestamp: message.createdDate,
          });
        } else {
          // No unread messages found
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Bookmarks Methods
  async addBookmark(bookmark: Bookmark): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readwrite');
      const store = transaction.objectStore('bookmarks');

      // SECURITY: Atomic limit check to prevent client-side bypass
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        if (countRequest.result >= BOOKMARKS_CONFIG.MAX_BOOKMARKS) {
          reject(new Error('BOOKMARK_LIMIT_EXCEEDED'));
          return;
        }

        // Only add if under limit
        const request = store.add(bookmark);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      };

      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readwrite');
      const store = transaction.objectStore('bookmarks');
      const request = store.delete(bookmarkId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeBookmarkByMessageId(messageId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readwrite');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('by_message');

      const request = index.get(messageId);

      request.onsuccess = () => {
        const bookmark = request.result;
        if (bookmark) {
          const deleteRequest = store.delete(bookmark.bookmarkId);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve(); // Bookmark doesn't exist, that's fine
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getBookmarks(): Promise<Bookmark[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readonly');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('by_created');

      // Get all bookmarks sorted by creation date (newest first)
      const request = index.getAll();

      request.onsuccess = () => {
        const bookmarks = request.result || [];
        // Sort newest first
        bookmarks.sort((a, b) => b.createdAt - a.createdAt);
        resolve(bookmarks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getBookmarksBySourceType(sourceType: 'channel' | 'dm'): Promise<Bookmark[]> {
    const allBookmarks = await this.getBookmarks();
    return allBookmarks.filter(bookmark => bookmark.sourceType === sourceType);
  }

  async getBookmarksBySpace(spaceId: string): Promise<Bookmark[]> {
    const allBookmarks = await this.getBookmarks();
    return allBookmarks.filter(bookmark => bookmark.spaceId === spaceId);
  }

  async getBookmarkCount(): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readonly');
      const store = transaction.objectStore('bookmarks');
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async isBookmarked(messageId: string): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readonly');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('by_message');

      const request = index.get(messageId);

      request.onsuccess = () => {
        resolve(!!request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getBookmarkByMessageId(messageId: string): Promise<Bookmark | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('bookmarks', 'readonly');
      const store = transaction.objectStore('bookmarks');
      const index = store.index('by_message');

      const request = index.get(messageId);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // DEBUG UTILITIES FOR ENCRYPTION STATE ANALYSIS
  // ============================================
  // See: .agents/bugs/encryption-state-evals-bloat.md
  //
  // Usage (browser console):
  //   await window.__messageDB.analyzeEncryptionStates()
  //   await window.__messageDB.deleteBloatedEncryptionState(conversationId, inboxId)

  /**
   * Analyzes all encryption states and returns a report of their sizes and structure.
   * Bloated states (>100KB) get deep analysis to identify the cause.
   */
  async analyzeEncryptionStates(): Promise<{
    total: number;
    bloated: number;
    healthy: number;
    states: Array<{
      conversationId: string;
      inboxId: string;
      sizeBytes: number;
      isBloated: boolean;
      analysis?: {
        outerKeys?: string[];
        innerKeys?: string[];
        skippedKeysHeaders?: number;
        skippedKeysTotal?: number;
        participantCount?: number;
        participantSkippedKeys?: Array<{ index: number; headers: number; total: number }>;
        idPeerMapSize?: number;
        peerIdMapSize?: number;
      };
    }>;
  }> {
    await this.init();
    const BLOAT_THRESHOLD = 100000; // 100KB

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('encryption_states', 'readonly');
      const store = transaction.objectStore('encryption_states');
      const request = store.getAll();

      request.onsuccess = () => {
        const allStates = request.result as EncryptionState[];
        const results = allStates.map(es => {
          const stateJson = JSON.stringify(es);
          const sizeBytes = stateJson.length;
          const isBloated = sizeBytes > BLOAT_THRESHOLD;

          const result: any = {
            conversationId: es.conversationId,
            inboxId: es.inboxId,
            sizeBytes,
            isBloated,
          };

          // Deep analysis for bloated states
          if (isBloated) {
            try {
              const outerState = JSON.parse(es.state);
              result.analysis = {
                outerKeys: Object.keys(outerState),
              };

              if (outerState.state) {
                const innerState = JSON.parse(outerState.state);
                result.analysis.innerKeys = Object.keys(innerState);

                // Double Ratchet skipped keys
                if (innerState.skipped_keys_map) {
                  const skippedKeys = innerState.skipped_keys_map;
                  result.analysis.skippedKeysHeaders = Object.keys(skippedKeys).length;
                  result.analysis.skippedKeysTotal = 0;
                  for (const header of Object.values(skippedKeys) as any[]) {
                    result.analysis.skippedKeysTotal += Object.keys(header).length;
                  }
                }

                // Triple Ratchet peer maps
                if (innerState.id_peer_map) {
                  result.analysis.idPeerMapSize = Object.keys(innerState.id_peer_map).length;
                }
                if (innerState.peer_id_map) {
                  result.analysis.peerIdMapSize = Object.keys(innerState.peer_id_map).length;
                }

                // Triple Ratchet participants
                if (innerState.participants && Array.isArray(innerState.participants)) {
                  result.analysis.participantCount = innerState.participants.length;
                  result.analysis.participantSkippedKeys = [];
                  for (let i = 0; i < innerState.participants.length; i++) {
                    const p = innerState.participants[i];
                    if (p.skipped_keys_map) {
                      const skippedKeys = p.skipped_keys_map;
                      const headers = Object.keys(skippedKeys).length;
                      let total = 0;
                      for (const header of Object.values(skippedKeys) as any[]) {
                        total += Object.keys(header).length;
                      }
                      if (headers > 0 || total > 0) {
                        result.analysis.participantSkippedKeys.push({ index: i, headers, total });
                      }
                    }
                  }
                }
              }
            } catch (e) {
              result.analysis = { error: String(e) };
            }
          }

          return result;
        });

        resolve({
          total: results.length,
          bloated: results.filter(r => r.isBloated).length,
          healthy: results.filter(r => !r.isBloated).length,
          states: results.sort((a, b) => b.sizeBytes - a.sizeBytes),
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes a specific bloated encryption state entirely.
   * WARNING: This will require re-establishing the encryption session for that space/conversation.
   * Use from browser console: await window.__messageDB.deleteBloatedEncryptionState(conversationId, inboxId)
   */
  async deleteBloatedEncryptionState(conversationId: string, inboxId: string): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('encryption_states', 'readwrite');
      const store = transaction.objectStore('encryption_states');
      const request = store.delete([conversationId, inboxId]);

      request.onsuccess = () => {
        logger.log(`Deleted encryption state for ${conversationId} / ${inboxId}`);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== Muted Users Methods =====

  /**
   * Get all muted users for a space
   */
  async getMutedUsers(spaceId: string): Promise<MutedUserRecord[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('muted_users', 'readonly');
      const store = transaction.objectStore('muted_users');
      const index = store.index('by_space');
      const request = index.getAll(spaceId);

      request.onsuccess = () => {
        resolve(request.result as MutedUserRecord[]);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a mute action has already been processed (deduplication)
   */
  async getMuteByMuteId(muteId: string): Promise<MutedUserRecord | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('muted_users', 'readonly');
      const store = transaction.objectStore('muted_users');
      const index = store.index('by_mute_id');
      const request = index.get(muteId);

      request.onsuccess = () => {
        resolve(request.result as MutedUserRecord | undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mute a user in a space
   */
  async muteUser(
    spaceId: string,
    targetUserId: string,
    mutedBy: string,
    muteId: string,
    timestamp: number,
    expiresAt?: number
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('muted_users', 'readwrite');
      const store = transaction.objectStore('muted_users');

      const record: MutedUserRecord = {
        spaceId,
        targetUserId,
        mutedAt: timestamp,
        mutedBy,
        lastMuteId: muteId,
        ...(expiresAt !== undefined && { expiresAt }),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Unmute a user in a space
   */
  async unmuteUser(spaceId: string, targetUserId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('muted_users', 'readwrite');
      const store = transaction.objectStore('muted_users');
      const request = store.delete([spaceId, targetUserId]);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a user is muted in a space (considers expiration)
   */
  async isUserMuted(spaceId: string, targetUserId: string): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('muted_users', 'readonly');
      const store = transaction.objectStore('muted_users');
      const request = store.get([spaceId, targetUserId]);

      request.onsuccess = () => {
        const record = request.result as MutedUserRecord | undefined;
        if (!record) {
          resolve(false);
          return;
        }
        // Check if mute has expired
        if (record.expiresAt && record.expiresAt <= Date.now()) {
          resolve(false);
          return;
        }
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== Action Queue Methods =====

  /**
   * Add a task to the action queue
   */
  async addQueueTask(task: Omit<QueueTask, 'id'>): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readwrite');
      const store = tx.objectStore('action_queue');
      const request = store.add(task);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending tasks by dedup key.
   * Used for deduplication - find existing pending tasks with same key.
   */
  async getPendingTasksByKey(key: string): Promise<QueueTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const index = store.index('key');
      const request = index.getAll(key);

      request.onsuccess = () => {
        const tasks = (request.result || []) as QueueTask[];
        // Filter to only pending tasks
        resolve(tasks.filter((t) => t.status === 'pending'));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if there's a currently processing task with the given key.
   * Used to skip enqueueing new tasks while one is actively being processed.
   */
  async hasProcessingTaskWithKey(key: string): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const index = store.index('key');
      const request = index.getAll(key);

      request.onsuccess = () => {
        const tasks = (request.result || []) as QueueTask[];
        resolve(tasks.some((t) => t.status === 'processing'));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single task by ID
   */
  async getQueueTask(id: number): Promise<QueueTask | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get tasks by status with optional limit
   */
  async getQueueTasksByStatus(
    status: TaskStatus,
    limit = 50
  ): Promise<QueueTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const index = store.index('status');
      const request = index.getAll(status, limit);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all tasks in the queue
   */
  async getAllQueueTasks(): Promise<QueueTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing task
   */
  async updateQueueTask(task: QueueTask): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readwrite');
      const store = tx.objectStore('action_queue');
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a task from the queue
   */
  async deleteQueueTask(id: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readwrite');
      const store = tx.objectStore('action_queue');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    await this.init();
    const all = await this.getAllQueueTasks();

    return {
      pending: all.filter((t) => t.status === 'pending').length,
      processing: all.filter((t) => t.status === 'processing').length,
      failed: all.filter((t) => t.status === 'failed').length,
      completed: all.filter((t) => t.status === 'completed').length,
      total: all.length,
    };
  }

  /**
   * Prune completed tasks older than the specified age
   */
  async pruneCompletedTasks(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    await this.init();
    const cutoff = Date.now() - olderThanMs;
    const completed = await this.getQueueTasksByStatus('completed', 1000);

    let deleted = 0;
    for (const task of completed) {
      if (task.processedAt && task.processedAt < cutoff) {
        await this.deleteQueueTask(task.id!);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Reset tasks stuck in 'processing' state after crash.
   * Only resets tasks that have been processing for longer than the timeout.
   * Call this on app startup.
   */
  async resetStuckProcessingTasks(stuckTimeoutMs = 60000): Promise<number> {
    await this.init();
    const cutoff = Date.now() - stuckTimeoutMs;
    const processing = await this.getQueueTasksByStatus('processing');

    let reset = 0;
    for (const task of processing) {
      // Only reset if stuck for more than timeout
      if (task.processingStartedAt && task.processingStartedAt < cutoff) {
        task.status = 'pending';
        task.processingStartedAt = undefined;
        task.retryCount = (task.retryCount || 0) + 1;
        await this.updateQueueTask(task);
        reset++;
        logger.log(
          `[ActionQueue] Reset stuck task ${task.id} (${task.taskType})`
        );
      }
    }

    return reset;
  }
}
