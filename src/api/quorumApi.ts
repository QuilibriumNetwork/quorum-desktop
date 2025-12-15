import { getConfig } from '../config/config';

// Note: 'user:kick' was removed - kick requires owner's ED448 key, cannot be delegated via roles
export type Permission = 'message:delete' | 'message:pin' | 'mention:everyone' | 'user:mute';

export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
  isPublic?: boolean; // Whether the role is visible to other users in UserProfile (defaults to true)
};

export type Emoji = {
  name: string;
  id: string;
  imgUrl: string;
};

export type Sticker = {
  name: string;
  id: string;
  imgUrl: string;
};

export type Space = {
  spaceId: string;
  spaceName: string;
  description?: string;
  vanityUrl: string;
  inviteUrl: string;
  iconUrl: string;
  bannerUrl: string;
  defaultChannelId: string;
  hubAddress: string;
  createdDate: number;
  modifiedDate: number;
  isRepudiable: boolean;
  isPublic: boolean;
  saveEditHistory?: boolean;
  groups: Group[];
  roles: Role[];
  emojis: Emoji[];
  stickers: Sticker[];
};

export type Group = {
  groupName: string;
  channels: Channel[];
  icon?: string;
  iconColor?: string;
  iconVariant?: 'outline' | 'filled';
};

export type Channel = {
  channelId: string;
  spaceId: string;
  channelName: string;
  channelTopic: string;
  channelKey?: string;
  createdDate: number;
  modifiedDate: number;
  mentionCount?: number;
  mentions?: string;
  isReadOnly?: boolean;
  managerRoleIds?: string[]; // Roles that can manage this read-only channel
  isPinned?: boolean; // Whether the channel is pinned to the top of its group
  pinnedAt?: number; // Timestamp when the channel was pinned (for stack ordering)
  icon?: string; // Custom icon name
  iconColor?: string; // Custom icon color
  iconVariant?: 'outline' | 'filled'; // Icon style variant
};

export type Conversation = {
  conversationId: string;
  type: 'direct' | 'group';
  timestamp: number;
  address: string;
  icon: string;
  displayName: string;
  lastReadTimestamp?: number;
  // Not persisted by server, but may be stored client-side for DMs
  isRepudiable?: boolean;
  saveEditHistory?: boolean;
  lastMessageId?: string; // For showing message previews in conversation list
};

export type Message = {
  channelId: string;
  spaceId: string;
  messageId: string;
  digestAlgorithm: string;
  nonce: string;
  createdDate: number;
  modifiedDate: number;
  lastModifiedHash: string;
  content:
    | PostMessage
    | EventMessage
    | EmbedMessage
    | ReactionMessage
    | RemoveReactionMessage
    | RemoveMessage
    | JoinMessage
    | LeaveMessage
    | KickMessage
    | MuteMessage
    | UpdateProfileMessage
    | StickerMessage
    | PinMessage
    | DeleteConversationMessage
    | EditMessage;
  reactions: Reaction[];
  mentions: Mentions;
  replyMetadata?: {
    parentAuthor: string;
    parentChannelId: string;
  };
  publicKey?: string;
  signature?: string;
  isPinned?: boolean;
  pinnedAt?: number;
  pinnedBy?: string;
  edits?: Array<{
    text: string | string[];
    modifiedDate: number;
    lastModifiedHash: string;
  }>;
};

export type PostMessage = {
  senderId: string;
  type: 'post';
  text: string | string[];
  repliesToMessageId?: string;
};

export type UpdateProfileMessage = {
  senderId: string;
  type: 'update-profile';
  displayName: string;
  userIcon: string;
};

export type RemoveMessage = {
  senderId: string;
  type: 'remove-message';
  removeMessageId: string;
};

export type EventMessage = {
  senderId: string;
  type: 'event';
  text: string;
  repliesToMessageId?: string;
};

export type EmbedMessage = {
  senderId: string;
  type: 'embed';
  imageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  width?: string;
  height?: string;
  isLargeGif?: boolean;
  repliesToMessageId?: string;
};

export type ReactionMessage = {
  senderId: string;
  type: 'reaction';
  reaction: string;
  messageId: string;
};

export type RemoveReactionMessage = {
  senderId: string;
  type: 'remove-reaction';
  reaction: string;
  messageId: string;
};

export type JoinMessage = {
  senderId: string;
  type: 'join';
};

export type LeaveMessage = {
  senderId: string;
  type: 'leave';
};

export type KickMessage = {
  senderId: string;
  type: 'kick';
};

export type MuteMessage = {
  senderId: string;
  type: 'mute';
  targetUserId: string;
  muteId: string;
  timestamp: number;
  action: 'mute' | 'unmute';
};

export type StickerMessage = {
  senderId: string;
  type: 'sticker';
  stickerId: string;
  repliesToMessageId?: string;
};

export type PinMessage = {
  senderId: string;
  type: 'pin';
  targetMessageId: string;
  action: 'pin' | 'unpin';
};

export type DeleteConversationMessage = {
  senderId: string;
  type: 'delete-conversation';
};

export type EditMessage = {
  senderId: string;
  type: 'edit-message';
  originalMessageId: string;
  editedText: string | string[];
  editedAt: number;
  editNonce: string;
  editSignature?: string;
};

export type Reaction = {
  emojiId: string;
  spaceId: string;
  emojiName: string;
  count: number;
  memberIds: string[];
};

export type Mentions = {
  memberIds: string[];
  roleIds: string[];
  channelIds: string[];
  everyone?: boolean;
  totalMentionCount?: number; // Total number of mention instances (including duplicates)
};

export type Bookmark = {
  bookmarkId: string;           // UUID
  messageId: string;            // Reference to original message
  spaceId?: string;             // For space messages (undefined for DMs)
  channelId?: string;           // For channel messages (undefined for DMs)
  conversationId?: string;      // For DM messages (undefined for channels)
  sourceType: 'channel' | 'dm';
  createdAt: number;            // Timestamp for sorting

  // Cached preview - avoids cross-context message resolution
  // Stored at bookmark creation time, acceptable if slightly stale
  cachedPreview: {
    senderAddress: string;      // For avatar/name lookup
    senderName: string;         // Display name at bookmark time
    textSnippet: string;        // First ~150 chars, markdown stripped (empty for media-only)
    messageDate: number;        // Original message timestamp
    sourceName: string;         // "Space Name > #channel" or "Contact Name"

    // Media content info for visual rendering
    contentType: 'text' | 'image' | 'sticker';
    imageUrl?: string;          // For embed messages (image URL)
    thumbnailUrl?: string;      // For embed messages (smaller preview)
    stickerId?: string;         // For sticker messages (resolve at render time)
  };

  // Future: notes?: string; tags?: string[];
};

// Configuration
export const BOOKMARKS_CONFIG = {
  MAX_BOOKMARKS: 200,           // Maximum number of bookmarks per user
  PREVIEW_SNIPPET_LENGTH: 150,  // Character limit for cached text snippet
} as const;

export type GetChannelParams = {
  spaceId: string;
  channelId: string;
};

export type GetChannelMessagesParams = {
  spaceId: string;
  channelId: string;
  nextPageToken?: string;
};

// -----------------
// APIs
export const getUserRegistrationUrl: (address: string) => `/${string}` = (
  address: string
) => `/users/${address}`;

export const getInboxUrl: () => `/${string}` = () => `/inbox`;

export const getInboxDeleteUrl: () => `/${string}` = () => `/inbox/delete`;

export const getInboxFetchUrl: (address: string) => `/${string}` = (
  address: string
) => `/inbox/${address}`;

export const getSpaceUrl: (a: string) => `/${string}` = (
  spaceAddress: string
) => `/spaces/${spaceAddress}`;

export const getUserSettingsUrl: (address: string) => `/${string}` = (
  address: string
) => `/users/${address}/config`;

export const getSpaceManifestUrl: (spaceAddress: string) => `/${string}` = (
  spaceAddress: string
) => `/spaces/${spaceAddress}/manifest`;

export const getHubUrl: () => `/${string}` = () => `/hub`;

export const getHubAddUrl: () => `/${string}` = () => `/hub/add`;

export const getHubDeleteUrl: () => `/${string}` = () => `/hub/delete`;

export const getSpaceInviteEvalsUrl: () => `/${string}` = () => `/invite/evals`;

export const getSpaceInviteEvalUrl: () => `/${string}` = () => `/invite/eval`;
