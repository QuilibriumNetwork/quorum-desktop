import { getConfig } from '../config/config';

export type Permission = 'message:delete';

export type Role = {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
  members: string[];
  permissions: Permission[];
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
  description: string;
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
  groups: Group[];
  roles: Role[];
  emojis: Emoji[];
  stickers: Sticker[];
};

export type Group = {
  groupName: string;
  channels: Channel[];
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
};

export type Conversation = {
  conversationId: string;
  type: 'direct' | 'group';
  timestamp: number;
  address: string;
  icon: string;
  displayName: string;
  lastReadTimestamp?: number;
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
    | StickerMessage;
  reactions: Reaction[];
  mentions: Mentions;
  publicKey?: string;
  signature?: string;
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
  videoUrl?: string;
  width?: string;
  height?: string;
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
