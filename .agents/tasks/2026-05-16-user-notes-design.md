---
type: task
title: User Notes Feature — Design Spec
status: design
created: 2026-05-16T00:00:00.000Z
updated: 2026-05-16T00:00:00.000Z
---

# User Notes — Design Spec

Private annotations a user can write about another user. Visible only to the author. Similar to Discord's "Note" field in user profiles.

**Scope**: Local-only v1. No quorum-shared changes. Sync extension is a follow-up.

---

## 1. Feature Overview

- Any user can write a free-text note about another user
- Notes are keyed on the target user's address (global — not per-space)
- Notes are never transmitted, shared, or visible to anyone other than the author
- Notes persist across app restarts via IndexedDB
- Max 256 characters per note
- Auto-saved on blur (no explicit save button)

---

## 2. Data Model

### New IndexedDB Store: `user_notes`

```typescript
interface UserNote {
  targetAddress: string; // keyPath — the address of the user being annotated
  note: string;          // max 256 chars, XSS-sanitized
  updatedAt: number;     // Unix timestamp ms
}
```

**Store config:**
- keyPath: `targetAddress`
- No indexes needed (always fetched by exact key)

**DB version**: bump from 11 → 12.

### New MessageDB Methods

```typescript
getUserNote(targetAddress: string): Promise<UserNote | undefined>
saveUserNote(targetAddress: string, note: string): Promise<void>
deleteUserNote(targetAddress: string): Promise<void>
```

`saveUserNote` upserts: creates if absent, updates if present. Sets `updatedAt = Date.now()`. If `note` is empty string after trimming, calls `deleteUserNote` instead (no orphan empty records).

---

## 3. React Query Layer

New directory: `src/hooks/queries/userNotes/`

Four files following the established pattern (see `src/hooks/queries/mutedUsers/`):

| File | Purpose |
|---|---|
| `buildUserNoteKey.ts` | `['user_note', targetAddress]` |
| `buildUserNoteFetcher.ts` | Calls `messageDB.getUserNote(targetAddress)` |
| `useUserNote.ts` | `staleTime: Infinity`, `networkMode: 'always'` |
| `useInvalidateUserNote.ts` | Invalidates `['user_note', targetAddress]` |

No mutation hook needed — save is called directly from the component on blur, then invalidation is triggered manually (same approach as `bio` in `useUserSettings`).

---

## 4. UI

### Placement in `UserProfile.tsx`

```
┌─────────────────────────────┐
│  Avatar   DisplayName       │
│           address suffix    │
├─────────────────────────────┤
│  Roles section              │
├─────────────────────────────┤
│  NOTE — only visible to you │  ← new section
│  ┌─────────────────────────┐│
│  │ Click to add a note...  ││
│  └─────────────────────────┘│
│                      42/256 │  ← shown when focused
├─────────────────────────────┤
│  [Send Message] [Mute] ...  │
└─────────────────────────────┘
```

**Visibility rule**: shown only when `user.address !== currentUserAddress`. Not shown on own profile.

### Textarea behavior

- Placeholder: `"Click to add a note"`
- Label above: `"NOTE — only visible to you"` (small, muted, uppercase)
- Character counter: shown only when focused, aligned right below textarea, format `{n}/256`
- Auto-save on `onBlur`: trims whitespace, saves if changed, deletes record if empty
- No save button, no loading spinner (optimistic — IndexedDB writes are fast)
- On save, invalidates the React Query cache for this `targetAddress`

### Validation

- Max 256 chars (enforced at `maxLength` on the textarea + in `saveUserNote`)
- XSS-sanitize via `validateUserNote` (new function mirroring `validateUserBio`)
- Input is stored as plain text, never rendered as HTML

---

## 5. Files to Create / Modify

### Create

| File | Description |
|---|---|
| `src/hooks/queries/userNotes/buildUserNoteKey.ts` | Query key builder |
| `src/hooks/queries/userNotes/buildUserNoteFetcher.ts` | Fetcher |
| `src/hooks/queries/userNotes/useUserNote.ts` | React Query hook |
| `src/hooks/queries/userNotes/useInvalidateUserNote.ts` | Invalidation hook |
| `src/hooks/queries/userNotes/index.ts` | Barrel export |

### Modify

| File | Change |
|---|---|
| `src/db/messages.ts` | Add `UserNote` interface, `user_notes` store (DB v12), `getUserNote`, `saveUserNote`, `deleteUserNote` methods |
| `src/components/user/UserProfile.tsx` | Add note textarea section between roles and action buttons |
| `src/components/user/UserProfile.scss` | Style the note section |
| `src/utils/validation.ts` (or equivalent) | Add `validateUserNote` function |

---

## 6. Out of Scope (v1)

- Cross-device sync (requires adding `userNotes` to `UserConfig` in quorum-shared — follow-up PR)
- Note history or timestamps shown in UI
- Searching notes
- Notes in DM conversation headers (could be added later as a small extension)

---

## 7. Open Questions / Follow-up

- **Sync (v2)**: Add `userNotes?: UserNote[]` and `deletedUserNoteAddresses?: string[]` to `UserConfig` in quorum-shared. Merge by `updatedAt`. Only sync when `allowSync` is true. Requires quorum-shared PR first.

---

*Last updated: 2026-05-16*
