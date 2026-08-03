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
    return this.db.getUserConfig({ address }) as unknown as Promise<UserConfig | undefined>;
  }

  async saveUserConfig(userConfig: UserConfig): Promise<void> {
    return this.db.saveUserConfig(userConfig as unknown as Parameters<typeof this.db.saveUserConfig>[0]);
  }

  // ============ Space Members ============
  // Desktop IndexedDB stores members with SDK field names (user_address, user_icon)
  // while quorum-shared SpaceMember uses (address, profile_image).
  // This adapter maps between the two conventions.

  // These two carry the GLOBAL identity slot as well as the per-space override.
  // Dropping it here was invisible but load-bearing: the sync layer builds its
  // member digest from whatever `dbMemberToShared` returns, and since the
  // follow-global work stopped stamping the override fields, the global slot is
  // where most members' identity actually lives. Without it every member hashed
  // as "no identity", so two clients that disagreed completely still agreed they
  // were in sync and exchanged nothing.
  // See 2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md under .agents/issues/

  private dbMemberToShared(dbMember: any): SpaceMember {
    return {
      address: dbMember.user_address ?? dbMember.address ?? '',
      display_name: dbMember.display_name,
      profile_image: dbMember.user_icon ?? dbMember.profile_image,
      user_address: dbMember.user_address ?? dbMember.address ?? '',
      user_icon: dbMember.user_icon ?? dbMember.profile_image,
      inbox_address: dbMember.inbox_address ?? '',
      isKicked: dbMember.isKicked,
      joinedAt: dbMember.joinedAt,
      spaceTag: dbMember.spaceTag,
      bio: dbMember.bio,
      global_display_name: dbMember.global_display_name,
      global_user_icon: dbMember.global_user_icon,
      global_bio: dbMember.global_bio,
      profileTimestamp: dbMember.profileTimestamp,
      globalProfileTimestamp: dbMember.globalProfileTimestamp,
    };
  }

  private sharedMemberToDb(member: SpaceMember) {
    return {
      user_address: member.user_address ?? member.address,
      user_icon: member.user_icon ?? member.profile_image,
      display_name: member.display_name,
      inbox_address: member.inbox_address,
      isKicked: member.isKicked,
      joinedAt: member.joinedAt,
      spaceTag: member.spaceTag,
      bio: member.bio,
      global_display_name: member.global_display_name,
      global_user_icon: member.global_user_icon,
      global_bio: member.global_bio,
      profileTimestamp: member.profileTimestamp,
      globalProfileTimestamp: member.globalProfileTimestamp,
    };
  }

  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    const members = await this.db.getSpaceMembers(spaceId);
    return members.map((m) => this.dbMemberToShared(m));
  }

  async getSpaceMember(spaceId: string, address: string): Promise<SpaceMember | undefined> {
    const member = await this.db.getSpaceMember(spaceId, address);
    return member ? this.dbMemberToShared(member) : undefined;
  }

  async saveSpaceMember(spaceId: string, member: SpaceMember): Promise<void> {
    return this.db.saveSpaceMember(spaceId, this.sharedMemberToDb(member));
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
