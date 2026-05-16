---
type: doc
title: "User Notes"
status: done
ai_generated: true
created: 2026-05-16
updated: 2026-05-16
related_docs:
  - docs/quorum-db-schema.md
  - docs/config-sync-system.md
  - docs/features/user-config-sync.md
  - docs/features/messages/bookmarks.md
related_tasks:
  - tasks/.done/2026-05-16-user-notes-plan.md
---

# User Notes

> **AI-Generated**: May contain errors. Verify before use.

## Overview

User Notes lets any user write a private freeform note about another user. Notes are visible only to the author, never transmitted to other users, and never rendered as HTML. They appear in the UserProfile popup and the DM sidebar, gated on viewing another user's profile (not your own).

When allowSync is enabled, notes sync across the author's own devices via the encrypted UserConfig config sync channel.

## Architecture

### Storage

Notes live in a dedicated user_notes IndexedDB store (DB version 12), keyed on targetAddress.

```typescript
interface UserNote {
  targetAddress: string; // address of the user being annotated
  note: string;          // max 256 chars, XSS-validated
  updatedAt: number;     // Unix timestamp ms — used for last-write-wins merge
}
```

MessageDB methods (src/db/messages.ts):
- getAllUserNotes(): Promise<UserNote[]> — full scan, used by sync
- getUserNote(targetAddress): Promise<UserNote | undefined>
- saveUserNote(targetAddress, note): Promise<void> — trims; delegates to deleteUserNote if empty
- deleteUserNote(targetAddress): Promise<void>

### React Query Layer

Four files in src/hooks/queries/userNotes/, following the mutedUsers pattern:

| File | Purpose |
|------|---------|
| buildUserNoteKey.ts | Key: ['userNote', targetAddress] |
| buildUserNoteFetcher.ts | Returns null (not undefined) when no note exists |
| useUserNote.ts | staleTime: Infinity, networkMode: always |
| useInvalidateUserNote.ts | Cache invalidation helper |

TanStack Query v5 throws and retries if a query function returns undefined. null is the correct empty-result sentinel for IndexedDB-backed queries.

### Validation

validateUserNote and MAX_USER_NOTE_LENGTH (256) are exported from src/hooks/business/validation/useSpaceNameValidation.ts. The validator blocks script injection patterns only — notes are private plaintext, never rendered as HTML, so the full validateNameForXSS pattern would be overly restrictive.

### UI

The note UI is in UserProfile (src/components/user/UserProfile.tsx) and the DM sidebar, gated on !isOwnProfile.

Collapsed state (no note): A small "+ Add a note" link. Clicking opens the textarea with autoFocus.

Expanded state:
- Compact uppercase label: NOTE — ONLY VISIBLE TO YOU
- Textarea with auto-save on blur, maxLength={256}
- Character counter (n/256) shown only while focused
- Inline error message if validation fails

Auto-save on blur (handleNoteBlur):
1. Empty after trim: delete from DB, write tombstone to UserConfig.deletedUserNoteAddresses, collapse to link, set cache to null
2. Validation failure: show inline error, do not save
3. Otherwise: save to DB, update cache via queryClient.setQueryData

Cache is updated with setQueryData directly (not invalidateQueries) because staleTime: Infinity means invalidation alone does not trigger a refetch — the UI would show stale data until a page reload.

The useEffect syncing from userNoteData uses setIsNoteOpen(!!existing) so expanded/collapsed state resets correctly if the component re-renders for a different user.

### Sync

Notes are included in the encrypted UserConfig payload when allowSync is enabled, following the same pattern as bookmarks.

Outbound (ConfigService.saveConfig):
- config.userNotes = await messageDB.getAllUserNotes() — collected before AES-GCM encryption
- config.deletedUserNoteAddresses = [] — tombstones cleared only after successful remote POST

Inbound (ConfigService.getConfig):
- Tombstone deletions applied unconditionally — outside the userNotes.length > 0 guard — so remote deletions propagate even when the sender has no notes left
- Non-deleted remote notes merged with local using last-write-wins by updatedAt
- Merged result written to local IndexedDB

Tombstone on UI delete: clearing a note writes the targetAddress to config.deletedUserNoteAddresses and saves the config immediately so the tombstone is present on the next sync.

UserConfig fields (src/db/messages.ts and @quilibrium/quorum-shared):
- userNotes?: UserNote[]
- deletedUserNoteAddresses?: string[]

Both initialised to [] in getDefaultUserConfig (src/utils.ts).

## Technical Decisions

- **null not undefined from fetcher**: TQ v5 treats undefined as an error and retries. null is the correct empty-result sentinel.

- **setQueryData not invalidateQueries**: With staleTime: Infinity, invalidation marks the cache stale but does not trigger a refetch. setQueryData updates the cache synchronously at write time — correct when the app owns the data source.

- **Tombstone-based deletion**: A plain DB deletion does not propagate to other devices. deletedUserNoteAddresses tells other devices to delete on their next sync. Tombstones are cleared after a successful push to avoid unbounded growth.

- **Script-injection-only XSS check**: Notes are stored as plaintext and never passed through innerHTML or a markdown renderer. The full validateNameForXSS would reject common note content like "a < b" or angle-bracket email addresses.

- **Local-only v1, sync added immediately after**: The quorum-shared type change (userNotes, deletedUserNoteAddresses) was merged before sync was wired on the desktop side, making the rollout clean and non-breaking.

## Known Limitations

- **No sync when allowSync is off**: Notes are device-local only. By design.
- **Tombstone growth**: deletedUserNoteAddresses grows until the next successful sync, then clears. Same limitation as deletedBookmarkIds.
- **No note history**: Only the current note is stored; previous content is not recoverable.
- **256-char limit**: Intentional, matches Discord's note field.

## Related Documentation

- [IndexedDB Schema Reference](../quorum-db-schema.md) — user_notes store at DB version 12
- [Config Sync System](../config-sync-system.md) — UserConfig sync and tombstone pattern
- [User Config Sync on Existing Accounts](user-config-sync.md) — sync architecture overview
- [Bookmarks Feature](messages/bookmarks.md) — the sync pattern user notes follows

*Last updated: 2026-05-16*
