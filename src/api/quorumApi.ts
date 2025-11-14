import { getConfig } from '../config/config';

export type Permission = 'message:delete' | 'message:pin' | 'user:kick' | 'mention:everyone';

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
};

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
