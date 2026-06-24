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
    userNotes: [],
    deletedUserNoteAddresses: [],
    timestamp: Date.now(),
    name: undefined,
    profile_image: undefined,
  };
};

// Address truncation moved to formatAddress in @quilibrium/quorum-shared.
