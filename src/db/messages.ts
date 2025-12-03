import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Conversation, Message, Space, Bookmark } from '../api/quorumApi';
import type { NotificationSettings } from '../types/notifications';
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

export type UserConfig = {
  address: string;
  spaceIds: string[];
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
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

export interface SearchResult {
  message: Message;
  score: number;
  highlights: string[];
}

export class MessageDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'quorum_db';
  private readonly DB_VERSION = 4;
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
    displayName: string
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
        const request = conversationStore.put({
          ...existingConv, // Preserve existing fields including isRepudiable
          conversationId,
          address: address,
          icon: icon,
          displayName: displayName,
          type: conversationType,
          timestamp: message.createdDate,
          lastMessageId: message.messageId, // Track last message for previews
        });
        request.onerror = () => reject(request.error);
      };
      getRequest.onerror = () => reject(getRequest.error);

      transaction.oncomplete = () => {
        // Add message to search index after saving
        this.addMessageToIndex(message).catch((error) => {
          console.warn('Failed to add message to search index:', error);
        });
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.init();

    // Get message first to extract spaceId and channelId for search index removal
    const message = await new Promise<Message | undefined>((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.get(messageId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return new Promise((resolve, reject) => {
      // Include 'bookmarks' store to cascade delete any bookmarks pointing to this message
      const transaction = this.db!.transaction(['messages', 'bookmarks'], 'readwrite');
      const messageStore = transaction.objectStore('messages');
      const bookmarkStore = transaction.objectStore('bookmarks');

      // Delete the message
      const messageRequest = messageStore.delete(messageId);
      messageRequest.onerror = () => reject(messageRequest.error);

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
            console.warn('Failed to remove message from search index:', error);
          });
        }
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
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
    // Add to space index
    const spaceIndexKey = `space:${message.spaceId}`;
    const spaceIndex = this.searchIndices.get(spaceIndexKey);
    if (spaceIndex) {
      spaceIndex.add(this.messageToSearchable(message));
    }

    // If it's a DM, also add to DM index
    const conversationId = `${message.spaceId}/${message.channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.add(this.messageToSearchable(message));
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
      spaceIndex.removeById(messageId);
    }

    // Remove from DM index if applicable
    const conversationId = `${spaceId}/${channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.removeById(messageId);
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
        console.warn(
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
            if (spaceIndex) spaceIndex.removeById(msg.messageId);

            const dmIndexKey = `dm:${msg.spaceId}/${msg.channelId}`;
            const dmIndex = this.searchIndices.get(dmIndexKey);
            if (dmIndex) dmIndex.removeById(msg.messageId);
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
      const request = store.add(bookmark);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
}
