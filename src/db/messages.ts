import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Conversation, Message, Space } from '../api/quorumApi';
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
  private readonly DB_VERSION = 2;
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

  async getAllSpaceMessages({
    spaceId,
  }: {
    spaceId: string;
  }): Promise<Message[]> {
    await this.init();
    return new Promise(async (resolve, reject) => {
      const space = await this.getSpace(spaceId);
      const channelIds = space!.groups
        .flatMap((g) => g.channels.map((c) => c.channelId))
        .sort();
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
    userProfile: channel.UserProfile & { inbox_address: string }
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
  ): Promise<channel.UserProfile & { inbox_address: string }> {
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
  ): Promise<(channel.UserProfile & { inbox_address: string })[]> {
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
      const request = conversationStore.put({
        conversationId: message.spaceId + '/' + message.channelId,
        address: address,
        icon: icon,
        displayName: displayName,
        type: conversationType,
        timestamp: message.createdDate,
      });
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const messageRequest = store.delete(messageId);
      messageRequest.onerror = () => reject(messageRequest.error);

      transaction.oncomplete = () => resolve();
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

  async getSpace(spaceId: string): Promise<Space | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('spaces', 'readonly');
      const store = transaction.objectStore('spaces');

      const request = store.get(spaceId);

      request.onsuccess = () => resolve(request.result);
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

    console.log('MessageDB: Initializing search indices...');
    await this.init();

    // Get all spaces and conversations to build indices
    const spaces = await this.getSpaces();
    const dmConversations = await this.getConversations({ type: 'direct' });

    console.log(
      'MessageDB: Found',
      spaces.length,
      'spaces and',
      dmConversations.conversations.length,
      'DM conversations'
    );

    // Initialize space indices
    for (const space of spaces) {
      const indexKey = `space:${space.spaceId}`;
      const messages = await this.getAllSpaceMessages({
        spaceId: space.spaceId,
      });

      console.log(
        `MessageDB: Building index for space ${space.spaceId} with ${messages.length} messages`
      );

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
      console.log(
        `MessageDB: Created index ${indexKey} with ${searchableMessages.length} searchable messages`
      );
    }

    // Initialize DM indices
    for (const conversation of dmConversations.conversations) {
      const indexKey = `dm:${conversation.conversationId}`;
      // Get DM messages (need to implement this method)
      const messages = await this.getDirectMessages(
        conversation.conversationId
      );

      console.log(
        `MessageDB: Building index for DM ${conversation.conversationId} with ${messages.length} messages`
      );

      const searchIndex = this.createSearchIndex();
      const searchableMessages = messages.map((msg) =>
        this.messageToSearchable(msg)
      );
      searchIndex.addAll(searchableMessages);

      this.searchIndices.set(indexKey, searchIndex);
      console.log(
        `MessageDB: Created index ${indexKey} with ${searchableMessages.length} searchable messages`
      );
    }

    console.log(
      'MessageDB: Search indices initialized. Total indices:',
      this.searchIndices.size
    );
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
          spaceId: result.match?.spaceId?.[0] || result.spaceId || '',
          channelId: result.match?.channelId?.[0] || result.channelId || '',
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

    return results.sort((a, b) => b.score - a.score);
  }

  private async getDirectMessages(conversationId: string): Promise<Message[]> {
    // Parse conversationId to get spaceId and channelId
    const [spaceId, channelId] = conversationId.split('/');
    if (!spaceId || !channelId) return [];

    const result = await this.getMessages({ spaceId, channelId, limit: 1000 });
    return result.messages;
  }
}
