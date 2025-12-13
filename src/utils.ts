import { UserConfig } from '../src/db/messages';

export enum DefaultImages {
  UNKNOWN_USER = '/unknown.png',
}

// Re-export date formatting utilities
export { formatMessageDate } from './utils/dateFormatting';

export const getDefaultUserConfig = (address: string): UserConfig => {
  return {
    address: address,
    allowSync: false,
    nonRepudiable: true,
    spaceKeys: [],
    spaceIds: [],
    bookmarks: [],
    deletedBookmarkIds: [],
    timestamp: Date.now(),
    name: undefined,
    profile_image: undefined,
  };
};

export const truncateAddress = (
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};
