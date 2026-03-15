import { getConfig } from '../config/config';

// Desktop-only API parameter types
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
