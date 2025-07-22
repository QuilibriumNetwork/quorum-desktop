import { channel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Conversation, Message, Space } from '../api/quorumApi';
import { SpacesDB } from './spaces';
import { SpaceMembersDB } from './spaceMembers';
import { EncryptionStatesDB, EncryptionState } from './encryptionStates';
import { UsersDB, UserConfig } from './users';
import { SpaceKeysDB, SpaceKey } from './spaceKeys';
import { SearchDB, SearchableMessage, SearchContext, SearchResult } from './search';
import { ConversationsDB } from './conversations';
import { MessagesDB, EncryptedMessage, DecryptionResult } from './messages';


export class QuorumDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'quorum_db';
  private readonly DB_VERSION = 2;
  private spacesDB!: SpacesDB;
  private spaceMembersDB!: SpaceMembersDB;
  private encryptionStatesDB!: EncryptionStatesDB;
  private usersDB!: UsersDB;
  private spaceKeysDB!: SpaceKeysDB;
  private searchDB!: SearchDB;
  private conversationsDB!: ConversationsDB;
  private messagesDB!: MessagesDB;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.spacesDB = new SpacesDB(this.db);
        this.spaceMembersDB = new SpaceMembersDB(this.db);
        this.encryptionStatesDB = new EncryptionStatesDB(this.db);
        this.usersDB = new UsersDB(this.db);
        this.spaceKeysDB = new SpaceKeysDB(this.db);
        this.conversationsDB = new ConversationsDB(this.db);
        this.messagesDB = new MessagesDB(this.db);

        // Initialize SearchDB with dependencies
        this.searchDB = new SearchDB({
          getSpaces: () => this.spacesDB.getSpaces(),
          getConversations: (params) => this.conversationsDB.getConversations(params),
          getAllSpaceMessages: (params) => this.messagesDB.getAllSpaceMessages({
            spaceId: params.spaceId,
            getSpace: (spaceId) => this.spacesDB.getSpace(spaceId),
          }),
          getDirectMessages: (conversationId) => this.messagesDB.getDirectMessages(conversationId),
          getMessage: (params) => this.messagesDB.getMessage(params),
        });

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

  // Ensure database is initialized before any operations
  private ensureInitialized(): Promise<void> {
    return this.initPromise;
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
    return this.ensureInitialized().then(() =>
      this.messagesDB.getMessage({ spaceId, channelId, messageId })
    );
  }

  async getAllSpaceMessages({
    spaceId,
  }: {
    spaceId: string;
  }): Promise<Message[]> {
    return this.ensureInitialized().then(() =>
      this.messagesDB.getAllSpaceMessages({
        spaceId,
        getSpace: (spaceId) => this.spacesDB.getSpace(spaceId),
      })
    );
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
    return this.ensureInitialized().then(() =>
      this.messagesDB.getMessages({ spaceId, channelId, cursor, direction, limit })
    );
  }

  async getUser({
    address,
  }: {
    address: string;
  }): Promise<{ userProfile: channel.UserProfile }> {
    return this.ensureInitialized().then(() =>
      this.usersDB.getUser({ address })
    );
  }

  async getUserConfig({ address }: { address: string }): Promise<UserConfig> {
    return this.ensureInitialized().then(() =>
      this.usersDB.getUserConfig({ address })
    );
  }

  async getAllEncryptionStates(): Promise<EncryptionState[]> {
    return this.ensureInitialized().then(() =>
      this.encryptionStatesDB.getAllEncryptionStates()
    );
  }

  async getEncryptionStates({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<EncryptionState[]> {
    return this.ensureInitialized().then(() =>
      this.encryptionStatesDB.getEncryptionStates({ conversationId })
    );
  }

  async getInboxMapping(inboxId: string): Promise<string | null> {
    return this.ensureInitialized().then(() =>
      this.conversationsDB.getInboxMapping(inboxId)
    );
  }

  async saveReadTime({
    conversationId,
    lastMessageTimestamp,
  }: {
    conversationId: string;
    lastMessageTimestamp: number;
  }): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.conversationsDB.saveReadTime({ conversationId, lastMessageTimestamp })
    );
  }

  async getConversation({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<{ conversation?: Conversation }> {
    return this.ensureInitialized().then(() =>
      this.conversationsDB.getConversation({ conversationId })
    );
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.conversationsDB.saveConversation(conversation)
    );
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
    return this.ensureInitialized().then(() =>
      this.conversationsDB.getConversations({ type, cursor, limit })
    );
  }

  async saveUserProfile(userProfile: channel.UserProfile): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.usersDB.saveUserProfile(userProfile)
    );
  }

  async saveUserConfig(userConfig: UserConfig): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.usersDB.saveUserConfig(userConfig)
    );
  }

  async saveConversationUsers(
    conversationId: string,
    addresses: string[]
  ): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.conversationsDB.saveConversationUsers(conversationId, addresses)
    );
  }

  async getSpaces(): Promise<Space[]> {
    return this.ensureInitialized().then(() =>
      this.spacesDB.getSpaces()
    );
  }

  async getSpace(spaceId: string): Promise<Space | undefined> {
    return this.ensureInitialized().then(() =>
      this.spacesDB.getSpace(spaceId)
    );
  }

  async saveSpace(space: Space): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.spacesDB.saveSpace(space)
    );
  }

  async deleteSpace(spaceId: string): Promise<Space | undefined> {
    return this.ensureInitialized().then(() =>
      this.spacesDB.deleteSpace(spaceId)
    );
  }

  async saveSpaceMember(
    spaceId: string,
    userProfile: channel.UserProfile & { inbox_address: string }
  ): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.spaceMembersDB.saveSpaceMember(spaceId, userProfile)
    );
  }

  async getSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<channel.UserProfile & { inbox_address: string }> {
    return this.ensureInitialized().then(() =>
      this.spaceMembersDB.getSpaceMember(spaceId, user_address)
    );
  }

  async getSpaceMembers(
    spaceId: string
  ): Promise<(channel.UserProfile & { inbox_address: string })[]> {
    return this.ensureInitialized().then(() =>
      this.spaceMembersDB.getSpaceMembers(spaceId)
    );
  }

  async deleteSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.spaceMembersDB.deleteSpaceMember(spaceId, user_address)
    );
  }

  async saveMessage(
    message: Message,
    lastMessageTimestamp: number,
    address: string,
    conversationType: string,
    icon: string,
    displayName: string
  ): Promise<void> {
    return this.ensureInitialized().then(async () => {
      // Save the message using MessagesDB
      await this.messagesDB.saveMessage(message);

      // Save the conversation using ConversationsDB
      await this.conversationsDB.saveConversationFromMessage(
        message,
        address,
        conversationType,
        icon,
        displayName
      );
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.messagesDB.deleteMessage(messageId)
    );
  }

  async saveEncryptionState(
    state: EncryptionState,
    wasFirstAttempt: boolean
  ): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.encryptionStatesDB.saveEncryptionState(state, wasFirstAttempt)
    );
  }

  async getSpaceKey(
    spaceId: string,
    keyId: string
  ): Promise<SpaceKey> {
    return this.ensureInitialized().then(() =>
      this.spaceKeysDB.getSpaceKey(spaceId, keyId)
    );
  }

  async getSpaceKeys(spaceId: string): Promise<SpaceKey[]> {
    return this.ensureInitialized().then(() =>
      this.spaceKeysDB.getSpaceKeys(spaceId)
    );
  }

  async saveSpaceKey(key: SpaceKey): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.spaceKeysDB.saveSpaceKey(key)
    );
  }

  async deleteSpaceKey(spaceId: string, keyId: string): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.spaceKeysDB.deleteSpaceKey(spaceId, keyId)
    );
  }

  async deleteEncryptionState(state: EncryptionState): Promise<void> {
    return this.ensureInitialized().then(() => {
      if (!state) return;
      return this.encryptionStatesDB.deleteEncryptionState(state);
    });
  }

  // Search functionality - delegated to SearchDB
  async initializeSearchIndices(): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.searchDB.initializeSearchIndices()
    );
  }

  async addMessageToIndex(message: Message): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.searchDB.addMessageToIndex(message)
    );
  }

  async removeMessageFromIndex(
    messageId: string,
    spaceId: string,
    channelId: string
  ): Promise<void> {
    return this.ensureInitialized().then(() =>
      this.searchDB.removeMessageFromIndex(messageId, spaceId, channelId)
    );
  }

  async searchMessages(
    query: string,
    context: SearchContext,
    limit: number = 50
  ): Promise<SearchResult[]> {
    return this.ensureInitialized().then(() =>
      this.searchDB.searchMessages(query, context, limit)
    );
  }
}
