/**
 * IndexedDBAdapter - StorageAdapter implementation wrapping MessageDB
 *
 * This adapter wraps the existing MessageDB class to conform to the
 * @quilibrium/quorum-shared StorageAdapter interface.
 */

import type {
  StorageAdapter,
  GetMessagesParams,
  GetMessagesResult,
  Space,
  Channel,
  Message,
  Conversation,
  UserConfig,
  SpaceMember,
} from '@quilibrium/quorum-shared';
import { MessageDB } from '../db/messages';

export class IndexedDBAdapter implements StorageAdapter {
  private db: MessageDB;

  constructor(db?: MessageDB) {
    this.db = db || new MessageDB();
  }

  async init(): Promise<void> {
    await this.db.init();
  }

  // ============ Spaces ============

  async getSpaces(): Promise<Space[]> {
    return this.db.getSpaces();
  }

  async getSpace(spaceId: string): Promise<Space | null> {
    return this.db.getSpace(spaceId);
  }

  async saveSpace(space: Space): Promise<void> {
    return this.db.saveSpace(space);
  }

  async deleteSpace(spaceId: string): Promise<void> {
    await this.db.deleteSpace(spaceId);
  }

  // ============ Channels ============

  async getChannels(spaceId: string): Promise<Channel[]> {
    const space = await this.getSpace(spaceId);
    if (!space) return [];
    return space.groups.flatMap((g) => g.channels);
  }

  // ============ Messages ============

  async getMessages(params: GetMessagesParams): Promise<GetMessagesResult> {
    const { spaceId, channelId, cursor, direction = 'backward', limit = 50 } = params;

    return this.db.getMessages({
      spaceId,
      channelId,
      cursor,
      direction,
      limit,
    });
  }

  async getMessage(params: {
    spaceId: string;
    channelId: string;
    messageId: string;
  }): Promise<Message | undefined> {
    return this.db.getMessage(params);
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
    return this.db.saveMessage(
      message,
      lastMessageTimestamp,
      address,
      conversationType,
      icon,
      displayName,
      currentUserAddress
    );
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.db.deleteMessage(messageId);
  }

  // ============ Conversations ============

  async getConversations(params: {
    type: 'direct' | 'group';
    cursor?: number;
    limit?: number;
  }): Promise<{ conversations: Conversation[]; nextCursor: number | null }> {
    return this.db.getConversations(params);
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const result = await this.db.getConversation({ conversationId });
    return result.conversation;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    return this.db.saveConversation(conversation);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.db.deleteConversation(conversationId);
  }

  // ============ User Config ============

  async getUserConfig(address: string): Promise<UserConfig | undefined> {
    return this.db.getUserConfig({ address });
  }

  async saveUserConfig(userConfig: UserConfig): Promise<void> {
    return this.db.saveUserConfig(userConfig);
  }

  // ============ Space Members ============

  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    const members = await this.db.getSpaceMembers(spaceId);
    return members as SpaceMember[];
  }

  async getSpaceMember(spaceId: string, address: string): Promise<SpaceMember | undefined> {
    const member = await this.db.getSpaceMember(spaceId, address);
    return member as SpaceMember | undefined;
  }

  async saveSpaceMember(spaceId: string, member: SpaceMember): Promise<void> {
    return this.db.saveSpaceMember(spaceId, member as any);
  }

  // ============ Sync Metadata ============
  // Note: MessageDB doesn't have built-in sync time tracking,
  // we can use a simple localStorage fallback or add to DB later

  private syncTimeCache = new Map<string, number>();

  async getLastSyncTime(key: string): Promise<number | undefined> {
    // Try localStorage first
    const stored = localStorage.getItem(`sync:${key}`);
    if (stored) {
      return parseInt(stored, 10);
    }
    return this.syncTimeCache.get(key);
  }

  async setLastSyncTime(key: string, time: number): Promise<void> {
    this.syncTimeCache.set(key, time);
    localStorage.setItem(`sync:${key}`, time.toString());
  }
}

// Singleton instance
let adapter: IndexedDBAdapter | null = null;

export function getIndexedDBAdapter(db?: MessageDB): IndexedDBAdapter {
  if (!adapter) {
    adapter = new IndexedDBAdapter(db);
  }
  return adapter;
}
