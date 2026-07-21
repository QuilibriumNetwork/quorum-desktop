import { logger, isValidIPFSCID } from '@quilibrium/quorum-shared';
import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Conversation, Message, Space, Bookmark, BroadcastSpaceTag, ChannelThread, UserNote, FarcasterLink, SpaceMemberDevice, ConversationSettingOverrides } from '@quilibrium/quorum-shared';
import { BOOKMARKS_CONFIG } from '@quilibrium/quorum-shared';
import type { SpaceNotificationSettings } from '../types/notifications';
import type { IconColor } from '../components/space/IconPicker/types';
import type { IconName } from '../components/primitives';
import type { QueueTask, TaskStatus, QueueStats } from '../types/actionQueue';
import MiniSearch, { type Options } from 'minisearch';

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

// Local copy of `@quilibrium/quorum-shared` `UserConfig`. Any field added
// here MUST also be added to the shared type, or it won't sync to other devices.
export type UserConfig = {
  address: string;
  spaceIds: string[];               // KEPT for backwards compatibility (derived from items)
  items?: NavItem[];                // Single source of truth for ordering & folders
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  name?: string;                    // User's display name (synced from profile)
  profile_image?: string;           // User's profile image as data URI (synced from profile)
  bio?: string;                     // User's bio; synced cross-device via UserConfig and included in the public-profile payload when isProfilePublic=true.
  isProfilePublic?: boolean;        // Whether the user's profile is discoverable; mirror of shared UserConfig.
  farcasterLink?: FarcasterLink;    // Bidirectional FC ↔ Quorum identity link; mirror of shared UserConfig.
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
    [spaceId: string]: SpaceNotificationSettings;
  };
  bookmarks?: Bookmark[];
  deletedBookmarkIds?: string[];
  userNotes?: UserNote[];
  deletedUserNoteAddresses?: string[];
  mutedChannels?: {
    [spaceId: string]: string[];
  };
  // Default true; muted channels still visible at 60% opacity unless turned off.
  showMutedChannels?: boolean;
  hideMutedSpacesFromSidebar?: boolean;
  favoriteDMs?: string[];
  // Muted DMs — no unread indicators or notifications.
  mutedConversations?: string[];
  // Per-conversation DM setting overrides (save-edit-history, always-sign,
  // delivery/read receipts), keyed by conversationId. Synced cross-device via
  // the UserConfig blob; merged per-entry last-write-wins in ConfigService.
  conversationSettings?: {
    [conversationId: string]: ConversationSettingOverrides;
  };
  // Personal "block user", scoped per space: addresses whose messages the
  // viewer hides from their OWN stream. Viewer-side only (no moderation effect,
  // no permission needed) — distinct from the role-gated moderation mute
  // (muted_users / MuteMessage). Synced cross-device via the UserConfig blob.
  blockedUsers?: {
    [spaceId: string]: string[];
  };
  deliveryReceipts?: boolean;
  readReceipts?: boolean;
  typingIndicatorsDM?: boolean;
  typingIndicatorsSpaces?: boolean;
  // Sender-side gate for fetching YouTube thumbnails — fetching leaks IP to Google.
  generateYouTubePreviews?: boolean;
  spaceTagId?: string;
  // Snapshot of the last broadcast so startup refresh can detect owner changes.
  lastBroadcastSpaceTag?: {
    letters: string;
    url: string;
  };
  // inbox_address → user-given label, synced.
  deviceNames?: { [inboxAddress: string]: string };
  // Tombstones so removed device names don't resurrect via sync.
  deletedDeviceNameAddresses?: string[];
};

export type { UserNote } from '@quilibrium/quorum-shared';

// The desktop space-member row as stored in IndexedDB: the SDK UserProfile plus
// the local-only fields. Single source of truth for the shape — the two-slot
// GLOBAL identity slots (global_*) and the per-slot LWW timestamps used to be
// read via `as any` casts scattered across the receive handlers and hooks.
// Storage names mirror the existing user_icon/profile_image split (desktop uses
// *_user_icon); the WIRE names (globalUserIcon) are shared and identical.
export type SpaceMemberRow = channel.UserProfile & {
  inbox_address: string;
  isKicked?: boolean;
  spaceTag?: BroadcastSpaceTag;
  joinedAt?: number;
  bio?: string;
  // GLOBAL identity slot (two-slot model) — the sender's current global
  // identity, kept separate from the per-space override fields above.
  global_display_name?: string;
  global_user_icon?: string;
  global_bio?: string;
  // Per-slot last-write-wins guards: the override fields and the global slot
  // each track the createdDate of the newest update-profile that set them, so
  // an out-of-order rebroadcast can't let an older value win. Mirrors mobile.
  profileTimestamp?: number;
  globalProfileTimestamp?: number;
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

interface StoredSearchIndex {
  indexKey: string;
  serializedIndex: string;
  messageCount: number;
  lastUpdated: number;
}

export class MessageDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'quorum_db';
  private readonly DB_VERSION = 14;
  private searchIndices: Map<string, MiniSearch<SearchableMessage>> = new Map();
  private indexLoadPromises: Map<string, Promise<void>> = new Map();
  private dirtyIndices: Set<string> = new Set();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private indexAccessTimes: Map<string, number> = new Map();
  private static readonly FLUSH_DEBOUNCE_MS = 5000;
  // Phase 1.4: cap in-memory indices. Evicted indices are reloaded
  // transparently from IndexedDB (Phase 1.3) on next access, so the
  // tradeoff is one ~10ms deserialize hit vs unbounded memory growth.
  private static readonly MAX_IN_MEMORY_INDICES = 10;

  async init() {
    if (this.db) return;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      // A version bump can't apply while another tab holds an older connection
      // open — the upgrade blocks until that connection closes. Log it so the
      // stuck state is diagnosable rather than a silent hang.
      request.onblocked = () => {
        logger.warn(
          '[MessageDB] DB upgrade blocked by another open tab; close other tabs to finish upgrading'
        );
      };
      request.onsuccess = () => {
        this.db = request.result;
        // If another tab later requests a higher version, yield: close this
        // connection so its upgrade isn't blocked (prevents a wedged DB across
        // version bumps). The next DB call reopens via init().
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
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

        if (event.oldVersion < 8) {
          // Add spaceTag field to space_members records (optional field, no data migration needed)
          // space_members records now support: spaceTag?: BroadcastSpaceTag
          // No schema changes required - IndexedDB is schemaless for object values.
          // DB_VERSION bump ensures clients re-open the DB with the new version.
        }

        if (event.oldVersion < 9) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const messageStore = transaction.objectStore('messages');
            messageStore.createIndex('by_thread', [
              'spaceId',
              'channelId',
              'threadId',
              'createdDate',
            ]);
          }
        }

        if (event.oldVersion < 10) {
          const channelThreadsStore = db.createObjectStore('channel_threads', {
            keyPath: 'threadId',
          });
          channelThreadsStore.createIndex('by_channel', ['spaceId', 'channelId']);
        }

        if (event.oldVersion < 11) {
          const threadReadTimesStore = db.createObjectStore('thread_read_times', {
            keyPath: 'threadId',
          });
          threadReadTimesStore.createIndex('by_channel', ['spaceId', 'channelId']);
        }

        if (event.oldVersion < 12) {
          db.createObjectStore('user_notes', {
            keyPath: 'targetAddress',
          });
        }

        if (event.oldVersion < 13) {
          // Phase 1.3: persist serialized MiniSearch indices so they survive
          // app restarts. Key shape: 'space:<id>' | 'dm:<conversationId>'.
          const indexStore = db.createObjectStore('search_indices', {
            keyPath: 'indexKey',
          });
          indexStore.createIndex('by_lastUpdated', 'lastUpdated');
        }

        if (event.oldVersion < 14) {
          // Per-device space signing keys admitted via master-signed statements.
          // Keyed by the device's DM inbox tag so announce/revoke upsert one row
          // per device; the resolver scans a space's rows and matches on the
          // signing-key `inboxAddress` field (see utils/deviceKeys in shared).
          const memberDevices = db.createObjectStore('space_member_devices', {
            keyPath: ['spaceId', 'deviceInboxAddress'],
          });
          memberDevices.createIndex('by_member', ['spaceId', 'userAddress']);
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

  async updateMessageDeliveredAt(messageId: string, deliveredAt: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const request = store.get(messageId);

      request.onsuccess = () => {
        const msg = request.result;
        if (msg && !msg.deliveredAt) {
          msg.deliveredAt = deliveredAt;
          store.put(msg);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessagesReadAt(
    spaceId: string,
    channelId: string,
    ownAddress: string,
    upToTimestamp: number,
    readAt: number
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const index = store.index('by_conversation_time');
      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, upToTimestamp]
      );
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const msg = cursor.value;
          if (msg.content?.senderId === ownAddress && !msg.readAt) {
            msg.readAt = readAt;
            // Reading implies delivery
            if (!msg.deliveredAt) {
              msg.deliveredAt = readAt;
            }
            cursor.update(msg);
          }
          cursor.continue();
        } else {
          resolve();
        }
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

    const space = await this.getSpace(spaceId);
    if (!space || !space.groups || space.groups.length === 0) {
      return [];
    }

    const channelIds = space.groups
      .flatMap((g) => g.channels.map((c) => c.channelId))
      .sort();

    if (channelIds.length === 0) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      const range = IDBKeyRange.bound(
        [spaceId, channelIds[0], 0],
        [spaceId, channelIds[channelIds.length - 1], Number.MAX_VALUE]
      );

      const request = index.getAll(range);

      request.onsuccess = () => {
        resolve(request.result);
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
    includeThreadReplies = false,
  }: {
    spaceId: string;
    channelId: string;
    cursor?: number;
    direction?: 'forward' | 'backward';
    limit?: number;
    includeThreadReplies?: boolean;
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
          if (!includeThreadReplies && cursor.value.isThreadReply) {
            cursor.continue();
            return;
          }
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

  async getThreadMessages({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<{
    messages: Message[];
    replyCount: number;
    lastReplyAt: number | null;
    lastReplyBy: string | null;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_thread');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, threadId, 0],
        [spaceId, channelId, threadId, Number.MAX_VALUE]
      );

      const request = index.openCursor(range, 'next');
      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          resolve({
            messages,
            replyCount: messages.length,
            lastReplyAt: lastMessage?.createdDate ?? null,
            lastReplyBy: lastMessage?.content?.senderId ?? null,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Find the root message for a thread by scanning channel messages.
   * Root messages have threadMeta.threadId but NOT a top-level threadId field,
   * so they are NOT in the by_thread index. This scans the by_conversation_time
   * index instead. Only called on user-initiated navigation (bookmark/pin/search click).
   */
  async getRootMessageByThreadId({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<Message | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, 0],
        [spaceId, channelId, Number.MAX_VALUE]
      );

      const request = index.openCursor(range, 'next');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const message = cursor.value as Message;
          if (message.threadMeta?.threadId === threadId) {
            resolve(message);
            return;
          }
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getThreadStats({
    spaceId,
    channelId,
    threadId,
  }: {
    spaceId: string;
    channelId: string;
    threadId: string;
  }): Promise<{
    replyCount: number;
    lastReplyAt: number | null;
    lastReplyBy: string | null;
  }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_thread');

      const range = IDBKeyRange.bound(
        [spaceId, channelId, threadId, 0],
        [spaceId, channelId, threadId, Number.MAX_VALUE]
      );

      const countRequest = index.count(range);

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        if (count === 0) {
          resolve({ replyCount: 0, lastReplyAt: null, lastReplyBy: null });
          return;
        }

        const cursorRequest = index.openCursor(range, 'prev');
        cursorRequest.onsuccess = () => {
          const cursor = (cursorRequest as IDBRequest).result;
          if (cursor) {
            const msg = cursor.value as Message;
            resolve({
              replyCount: count,
              lastReplyAt: msg.createdDate,
              lastReplyBy: msg.content?.senderId ?? null,
            });
          } else {
            resolve({ replyCount: count, lastReplyAt: null, lastReplyBy: null });
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      };
      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  async saveChannelThread(thread: ChannelThread): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('channel_threads', 'readwrite');
      const store = transaction.objectStore('channel_threads');
      const request = store.put(thread);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChannelThreads({
    spaceId,
    channelId,
  }: {
    spaceId: string;
    channelId: string;
  }): Promise<ChannelThread[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('channel_threads', 'readonly');
      const store = transaction.objectStore('channel_threads');
      const index = store.index('by_channel');
      const range = IDBKeyRange.only([spaceId, channelId]);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result as ChannelThread[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getChannelThread(threadId: string): Promise<ChannelThread | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('channel_threads', 'readonly');
      const store = transaction.objectStore('channel_threads');
      const request = store.get(threadId);
      request.onsuccess = () => resolve(request.result as ChannelThread | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteChannelThread(threadId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('channel_threads', 'readwrite');
      const store = transaction.objectStore('channel_threads');
      const request = store.delete(threadId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveThreadReadTime({
    threadId,
    spaceId,
    channelId,
    lastReadTimestamp,
  }: {
    threadId: string;
    spaceId: string;
    channelId: string;
    lastReadTimestamp: number;
  }): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('thread_read_times', 'readwrite');
      const store = transaction.objectStore('thread_read_times');
      const request = store.put({ threadId, spaceId, channelId, lastReadTimestamp });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getThreadReadTime(threadId: string): Promise<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number } | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('thread_read_times', 'readonly');
      const store = transaction.objectStore('thread_read_times');
      const request = store.get(threadId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Returns a threadId → lastReadTimestamp map for the channel. */
  async getThreadReadTimesForChannel({
    spaceId,
    channelId,
  }: {
    spaceId: string;
    channelId: string;
  }): Promise<Record<string, number>> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('thread_read_times', 'readonly');
      const store = transaction.objectStore('thread_read_times');
      const index = store.index('by_channel');
      const range = IDBKeyRange.only([spaceId, channelId]);
      const request = index.getAll(range);
      request.onsuccess = () => {
        const map: Record<string, number> = {};
        for (const entry of request.result) {
          map[entry.threadId] = entry.lastReadTimestamp;
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Single-transaction bulk write for "Mark All as Read". */
  async bulkSaveThreadReadTimes(
    entries: Array<{ threadId: string; spaceId: string; channelId: string; lastReadTimestamp: number }>
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('thread_read_times', 'readwrite');
      const store = transaction.objectStore('thread_read_times');
      for (const entry of entries) {
        store.put(entry);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
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

    // Guard: a direct conversation must be keyed by the partner's Qm… address
    // ("<Qm…>/<Qm…>"), never a QNS @username. Persisting a name-keyed row splits
    // one partner into two contacts and leaves the name-keyed one unusable (no
    // registration → can't send, can't re-resolve). Reject loudly so a leaking
    // call site is caught instead of silently corrupting the contact list.
    if (conversation.type === 'direct') {
      const [a, b] = String(conversation.conversationId).split('/');
      const keyedByAddress =
        !!a && a === b && isValidIPFSCID(a, true);
      if (!keyedByAddress) {
        logger.error(
          '[messageDB] Refusing to save direct conversation not keyed by a Qm… address',
          { conversationId: conversation.conversationId, address: conversation.address },
        );
        return Promise.reject(
          new Error(
            'Direct conversation must be keyed by a Qm… address, got: ' +
              conversation.conversationId,
          ),
        );
      }
    }

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
    userProfile: SpaceMemberRow
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
  ): Promise<SpaceMemberRow> {
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
  ): Promise<SpaceMemberRow[]> {
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

  /**
   * Per-device signing-key admissions (and revocation tombstones), one row per
   * device tag. Never derived from the member row — admitted only via a
   * master-signed statement (see MessageService announce-keys/revoke-device
   * handlers). Passed to resolveVerifiedSender as its optional 3rd arg.
   */
  async saveSpaceMemberDevice(device: SpaceMemberDevice): Promise<void> {
    await this.init();
    // Degrade gracefully if the v14 store isn't present yet (e.g. an upgrade
    // blocked by another open tab). Never let an optional write crash a caller.
    if (!this.db!.objectStoreNames.contains('space_member_devices')) return;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        'space_member_devices',
        'readwrite'
      );
      transaction.objectStore('space_member_devices').put(device);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /** The stored admission/tombstone for a device tag, if any (for LWW). */
  async getSpaceMemberDevice(
    spaceId: string,
    deviceInboxAddress: string
  ): Promise<SpaceMemberDevice | undefined> {
    await this.init();
    if (!this.db!.objectStoreNames.contains('space_member_devices')) return undefined;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_member_devices', 'readonly');
      const request = transaction
        .objectStore('space_member_devices')
        .get([spaceId, deviceInboxAddress]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** All device admissions for a space (revoked rows included; resolver skips them). */
  async getSpaceMemberDevices(spaceId: string): Promise<SpaceMemberDevice[]> {
    await this.init();
    // Missing store (upgrade not yet applied) → no admissions; the resolver
    // falls back to join-bound member rows. Keeps the receive path alive.
    if (!this.db!.objectStoreNames.contains('space_member_devices')) return [];
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('space_member_devices', 'readonly');
      const store = transaction.objectStore('space_member_devices');
      const range = IDBKeyRange.bound(
        [spaceId, ' '],
        [spaceId, '￿']
      );
      const request = store.getAll(range);
      request.onsuccess = () => resolve(request.result ?? []);
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

  /**
   * Clear all tombstones for a space.
   * Used when rejoining a space to allow messages to be synced again.
   */
  async clearTombstonesForSpace(spaceId: string): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['deleted_messages'], 'readwrite');
      const store = transaction.objectStore('deleted_messages');
      const index = store.index('by_space_channel');

      // Get all tombstones for this space (any channel)
      const range = IDBKeyRange.bound(
        [spaceId, ''],
        [spaceId, '\uffff']
      );

      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        logger.log(`[MessageDB] Cleared ${deletedCount} tombstones for space ${spaceId}`);
        resolve(deletedCount);
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

  /**
   * Single source of truth for MiniSearch config. Used by both index creation
   * and deserialization (MiniSearch.loadJSON requires the SAME options to
   * correctly restore an index). Drift between create and load silently
   * breaks fuzzy/boost/stored-field behavior — keep them aligned via this
   * constant.
   */
  private static readonly MINISEARCH_OPTIONS: Options<SearchableMessage> = {
    fields: ['content', 'senderId'],
    storeFields: ['messageId', 'spaceId', 'channelId', 'createdDate', 'type'],
    searchOptions: {
      boost: { content: 2, senderId: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  };

  private createSearchIndex(): MiniSearch<SearchableMessage> {
    return new MiniSearch(MessageDB.MINISEARCH_OPTIONS);
  }

  private getIndexKey(context: SearchContext): string {
    if (context.type === 'space') {
      return `space:${context.spaceId}`;
    } else {
      return `dm:${context.conversationId}`;
    }
  }

  /**
   * Legacy entry point. Phase 1.2 (lazy loading) means we no longer build all
   * indices at startup. Kept as a no-op for API back-compat with existing
   * callers (e.g. SearchService.initialize()) until they're cleaned up.
   *
   * Indices are now built on first search per-space/DM via ensureIndexReady().
   */
  async initializeSearchIndices(): Promise<void> {
    return;
  }

  /**
   * Ensures the search index for a given context is loaded in memory.
   * No-op if already loaded; otherwise builds the index from messages.
   *
   * Storage-adapter-shaped: this is the IndexedDB implementation of what
   * will become a SearchAdapter method once quorum-shared migration unblocks.
   * Per `.agents/tasks/search-optimization/decisions.md` decision #9.
   */
  async ensureIndexReady(context: SearchContext): Promise<void> {
    const indexKey = this.getIndexKey(context);
    if (this.searchIndices.has(indexKey)) {
      this.trackIndexAccess(indexKey);
      return;
    }

    const existing = this.indexLoadPromises.get(indexKey);
    if (existing) return existing;

    const loadPromise = this.loadIndexLazily(context, indexKey)
      .then(() => {
        this.trackIndexAccess(indexKey);
      })
      .finally(() => {
        this.indexLoadPromises.delete(indexKey);
      });
    this.indexLoadPromises.set(indexKey, loadPromise);
    return loadPromise;
  }

  private async loadIndexLazily(
    context: SearchContext,
    indexKey: string
  ): Promise<void> {
    await this.init();

    // Phase 1.3: try persisted cache first; falls through to fresh build if
    // miss or load fails.
    const cached = await this.loadSearchIndexFromDB(indexKey);
    if (cached) {
      this.searchIndices.set(indexKey, cached);
      return;
    }

    const messages =
      context.type === 'space'
        ? await this.getAllSpaceMessages({ spaceId: context.spaceId! })
        : await this.getDirectMessages(context.conversationId!);

    const searchIndex = this.createSearchIndex();
    searchIndex.addAll(messages.map((msg) => this.messageToSearchable(msg)));
    this.searchIndices.set(indexKey, searchIndex);

    // First-build for this context — schedule a persist so the next restart
    // hits the cache. Debounced; not a per-message write.
    this.markIndexDirty(indexKey);
  }

  /**
   * Persist a serialized MiniSearch index to IndexedDB.
   *
   * Adapter-shape note: when quorum-shared migration unblocks, this method's
   * signature becomes the IndexedDB implementation of a SearchAdapter method.
   * Mobile will write a SQLite/MMKV variant. See decisions.md #9.
   */
  private async saveSearchIndexToDB(
    indexKey: string,
    searchIndex: MiniSearch<SearchableMessage>
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('search_indices', 'readwrite');
      const store = tx.objectStore('search_indices');
      const record: StoredSearchIndex = {
        indexKey,
        serializedIndex: JSON.stringify(searchIndex.toJSON()),
        messageCount: searchIndex.documentCount,
        lastUpdated: Date.now(),
      };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load a serialized MiniSearch index from IndexedDB.
   *
   * Uses MiniSearch.loadJSON (NOT addAll(JSON.parse(...)) which would
   * re-tokenize and defeat the cache). The same MINISEARCH_OPTIONS must
   * be passed as were used to create the original index. See decisions.md #10.
   *
   * Returns null on miss or any load failure (caller falls back to fresh build).
   */
  private async loadSearchIndexFromDB(
    indexKey: string
  ): Promise<MiniSearch<SearchableMessage> | null> {
    await this.init();
    const stored = await new Promise<StoredSearchIndex | undefined>(
      (resolve, reject) => {
        const tx = this.db!.transaction('search_indices', 'readonly');
        const store = tx.objectStore('search_indices');
        const request = store.get(indexKey);
        request.onsuccess = () =>
          resolve(request.result as StoredSearchIndex | undefined);
        request.onerror = () => reject(request.error);
      }
    );

    if (!stored) return null;

    try {
      return MiniSearch.loadJSON<SearchableMessage>(
        stored.serializedIndex,
        MessageDB.MINISEARCH_OPTIONS
      );
    } catch (error) {
      logger.warn(
        `Failed to deserialize search index for ${indexKey}, will rebuild:`,
        error
      );
      return null;
    }
  }

  /**
   * Mark an index as dirty and schedule a debounced flush. Coalesces bursts
   * of message activity into a single write per FLUSH_DEBOUNCE_MS window.
   * See decisions.md #11.
   */
  private markIndexDirty(indexKey: string): void {
    this.dirtyIndices.add(indexKey);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      // Clear BEFORE flushing so a dirty mark during the async flush
      // schedules a fresh window. Otherwise the stale (already-fired) timer
      // ID would block every subsequent markIndexDirty from rescheduling.
      this.flushTimer = null;
      this.flushDirtyIndices().catch((error) => {
        logger.warn('Failed to flush dirty search indices:', error);
      });
    }, MessageDB.FLUSH_DEBOUNCE_MS);
  }

  private trackIndexAccess(indexKey: string): void {
    this.indexAccessTimes.set(indexKey, Date.now());
  }

  /**
   * Phase 1.4: drop least-recently-used indices once we exceed
   * MAX_IN_MEMORY_INDICES. Safe because Phase 1.3 persists indices to
   * IndexedDB — evicted indices reload transparently on next access.
   *
   * Always flushes dirty state before dropping, so we never lose pending
   * writes to eviction.
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.searchIndices.size <= MessageDB.MAX_IN_MEMORY_INDICES) return;

    // Only consider keys actually loaded in memory. Without this filter,
    // ghost entries in indexAccessTimes (e.g. from a future code path that
    // drops a key from searchIndices without cleaning up accessTimes) would
    // consume eviction slots without freeing any memory, leaving the cap
    // unenforced.
    const entries = Array.from(this.indexAccessTimes.entries())
      .filter(([key]) => this.searchIndices.has(key))
      .sort((a, b) => a[1] - b[1]);
    const evictCount = this.searchIndices.size - MessageDB.MAX_IN_MEMORY_INDICES;
    const toEvict = entries.slice(0, evictCount);

    for (const [indexKey] of toEvict) {
      if (this.dirtyIndices.has(indexKey)) {
        const index = this.searchIndices.get(indexKey);
        if (index) {
          try {
            await this.saveSearchIndexToDB(indexKey, index);
          } catch (error) {
            // If the flush failed, keep the index in memory rather than
            // losing data — eviction will retry on the next cycle.
            logger.warn(
              `Failed to flush ${indexKey} before eviction; keeping in memory:`,
              error
            );
            continue;
          }
        }
        this.dirtyIndices.delete(indexKey);
      }
      this.searchIndices.delete(indexKey);
      this.indexAccessTimes.delete(indexKey);
    }
  }

  /**
   * Persist all dirty indices. Safe to call from lifecycle hooks
   * (visibilitychange, beforeunload) or LRU eviction.
   */
  async flushDirtyIndices(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.dirtyIndices.size === 0) return;

    const toFlush = Array.from(this.dirtyIndices);
    this.dirtyIndices.clear();
    await Promise.all(
      toFlush.map((indexKey) => {
        const index = this.searchIndices.get(indexKey);
        if (!index) return Promise.resolve();
        return this.saveSearchIndexToDB(indexKey, index).catch((error) => {
          logger.warn(`Failed to persist search index ${indexKey}:`, error);
          // Re-mark dirty so we retry on the next flush.
          this.dirtyIndices.add(indexKey);
        });
      })
    );
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
      this.markIndexDirty(spaceIndexKey);
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
      this.markIndexDirty(dmIndexKey);
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
      this.markIndexDirty(spaceIndexKey);
    }

    // Remove from DM index if applicable
    const conversationId = `${spaceId}/${channelId}`;
    const dmIndexKey = `dm:${conversationId}`;
    const dmIndex = this.searchIndices.get(dmIndexKey);
    if (dmIndex) {
      dmIndex.discard(messageId);
      this.markIndexDirty(dmIndexKey);
    }
  }

  async searchMessages(
    query: string,
    context: SearchContext,
    limit: number = 50
  ): Promise<SearchResult[]> {
    await this.ensureIndexReady(context);

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

    // Phase 1.4: trim memory after each search. Fire-and-forget — eviction
    // touches IndexedDB but we don't want to block returning results on it.
    this.evictLeastRecentlyUsed().catch((error) => {
      logger.warn('LRU eviction failed:', error);
    });

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

  /**
   * Collects all DM-related data for backup export.
   * Fetches DM conversations, their messages, encryption states, and user config.
   */
  async getAllDMData({ address }: { address: string }): Promise<{
    messages: Message[];
    conversations: Conversation[];
    encryption_states: EncryptionState[];
    user_config?: UserConfig;
  }> {
    await this.init();

    // Fetch all DM conversations (paginate to collect all)
    const allConversations: Conversation[] = [];
    let cursor: number | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getConversations({ type: 'direct', cursor, limit: 1000 });
      allConversations.push(...result.conversations);
      if (result.nextCursor) {
        cursor = result.nextCursor;
      } else {
        hasMore = false;
      }
    }

    // Fetch all messages for each DM conversation
    const allMessages: Message[] = [];
    for (const conv of allConversations) {
      const [spaceId, channelId] = conv.conversationId.split('/');
      if (!spaceId || !channelId) continue;
      const messages = await this.getAllConversationMessages({ spaceId, channelId });
      allMessages.push(...messages);
    }

    // Fetch all encryption states (DM Double Ratchet states)
    const encryption_states = await this.getAllEncryptionStates();

    // Fetch user config (covers allowSync=false users)
    const user_config = await this.getUserConfig({ address });

    return {
      messages: allMessages,
      conversations: allConversations,
      encryption_states,
      user_config,
    };
  }

  /**
   * Imports DM data from a backup into IndexedDB using a single atomic transaction.
   * Deduplicates messages/conversations by key using put() (existing records kept).
   * Skips encryption_states and user_config (Phase 2: user has active sessions).
   * Returns the count of messages and conversations written.
   */
  async importDMData({ messages, conversations }: {
    messages: Message[];
    conversations: Conversation[];
  }): Promise<{ messagesWritten: number; conversationsWritten: number }> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'conversations'], 'readwrite');
      const messageStore = transaction.objectStore('messages');
      const conversationStore = transaction.objectStore('conversations');

      let messagesWritten = 0;
      let conversationsWritten = 0;

      // Write conversations first (metadata)
      for (const conv of conversations) {
        const request = conversationStore.put(conv);
        request.onsuccess = () => { conversationsWritten++; };
      }

      // Write messages (dedup by messageId via put)
      for (const msg of messages) {
        const request = messageStore.put(msg);
        request.onsuccess = () => { messagesWritten++; };
      }

      transaction.oncomplete = () => {
        resolve({ messagesWritten, conversationsWritten });
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Import transaction aborted'));
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
          } catch { /* ignore */ }

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

  /** For optimistic updates. */
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
        const pinnedMessages = allMessages.filter(
          (msg) => msg.isPinned === true
        );
        // Sort by pin time, falling back to createdDate for legacy records.
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

  // No dedicated mention index — filters in memory after the timestamp range
  // scan. A compound [spaceId, channelId, mentionedUserId, createdDate] index
  // would scale better but needs a DB migration.
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

          // Caller still filters by userAddress since there's no mention index.
          if (message.mentions) {
            messages.push(message);
          }

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

  // Filters by replyMetadata.parentAuthor in memory after timestamp range scan.
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

          if (message.replyMetadata?.parentAuthor === userAddress) {
            messages.push(message);
          }

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

  /** First unread message for auto-jump navigation when entering a channel. */
  async getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp,
    includeThreadReplies = false,
  }: {
    spaceId: string;
    channelId: string;
    afterTimestamp: number;
    includeThreadReplies?: boolean;
  }): Promise<{ messageId: string; timestamp: number } | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

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
          // Thread replies shouldn't trigger unread navigation
          if (!includeThreadReplies && message.isThreadReply) {
            cursor.continue();
            return;
          }
          resolve({
            messageId: message.messageId,
            timestamp: message.createdDate,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

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

      const request = index.getAll();

      request.onsuccess = () => {
        const bookmarks = request.result || [];
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

  async getAllUserNotes(): Promise<UserNote[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_notes', 'readonly');
      const store = transaction.objectStore('user_notes');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as UserNote[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserNote(targetAddress: string): Promise<UserNote | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_notes', 'readonly');
      const store = transaction.objectStore('user_notes');
      const request = store.get(targetAddress);

      request.onsuccess = () => resolve(request.result as UserNote | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserNote(targetAddress: string, note: string): Promise<void> {
    await this.init();
    const trimmed = note.trim();
    if (!trimmed) {
      return this.deleteUserNote(targetAddress);
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_notes', 'readwrite');
      const store = transaction.objectStore('user_notes');
      const record: UserNote = {
        targetAddress,
        note: trimmed,
        updatedAt: Date.now(),
      };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteUserNote(targetAddress: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('user_notes', 'readwrite');
      const store = transaction.objectStore('user_notes');
      const request = store.delete(targetAddress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Used for mute-action deduplication. */
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

  /** Considers expiration when determining mute status. */
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

  /** Used to find existing pending tasks for dedup. */
  async getPendingTasksByKey(key: string): Promise<QueueTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('action_queue', 'readonly');
      const store = tx.objectStore('action_queue');
      const index = store.index('key');
      const request = index.getAll(key);

      request.onsuccess = () => {
        const tasks = (request.result || []) as QueueTask[];
        resolve(tasks.filter((t) => t.status === 'pending'));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Used to skip enqueueing while an identical task is already running. */
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

  /** Call on app startup to recover tasks left in 'processing' by a crash. */
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
