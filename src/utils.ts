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
    // 0, not Date.now(). This config has published nothing and read nothing, so
    // it has no claim on being newer than anything. A fresh Date.now() here
    // outranks the account's real blob at getConfig's timestamp comparison, so
    // the device discards it unopened and — once sync is enabled — publishes
    // this empty config over every other device. Mobile already uses 0.
    // See .agents/issues/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md
    timestamp: 0,
    name: undefined,
    profile_image: undefined,
  };
};

// Address truncation moved to formatAddress in @quilibrium/quorum-shared.
