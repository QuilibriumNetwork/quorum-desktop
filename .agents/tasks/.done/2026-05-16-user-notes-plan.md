# User Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private per-user note field to the UserProfile popup — visible only to the author, stored locally in IndexedDB, never synced or transmitted.

**Architecture:** New `user_notes` IndexedDB store (DB v11→12) holds one note per target address. A 4-file React Query layer (key / fetcher / hook / invalidate) follows the existing `mutedUsers` pattern exactly. The note textarea is inserted into `UserProfile.tsx` between the roles block and the action buttons, with auto-save on blur.

**Tech Stack:** TypeScript, React, TanStack Query v5, IndexedDB (via `MessageDB`), Lingui (i18n macros), SCSS (BEM-flat conventions)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/queries/userNotes/buildUserNoteKey.ts` | Query key builder |
| Create | `src/hooks/queries/userNotes/buildUserNoteFetcher.ts` | Async fetcher calling MessageDB |
| Create | `src/hooks/queries/userNotes/useUserNote.ts` | TanStack Query hook |
| Create | `src/hooks/queries/userNotes/useInvalidateUserNote.ts` | Cache invalidation helper |
| Create | `src/hooks/queries/userNotes/index.ts` | Barrel export |
| Modify | `src/db/messages.ts` | Add `UserNote` interface, `user_notes` store (v12), 3 DB methods |
| Modify | `src/hooks/business/validation/useSpaceNameValidation.ts` | Add `validateUserNote` function |
| Modify | `src/components/user/UserProfile.tsx` | Note textarea section (between roles and action buttons) |
| Modify | `src/components/user/UserProfile.scss` | Styles for note section |

---

## Task 1: Add `user_notes` store and methods to MessageDB

**Files:**
- Modify: `src/db/messages.ts`

- [ ] **Step 1: Add the `UserNote` interface**

In `src/db/messages.ts`, find the block of interface/type definitions near the top of the file (around line 48 where `UserConfig` is defined). Add the new interface immediately after the `UserConfig` type block:

```typescript
export interface UserNote {
  targetAddress: string;
  note: string;
  updatedAt: number;
}
```

- [ ] **Step 2: Bump DB_VERSION from 11 to 12**

At line 153 in `src/db/messages.ts`:

```typescript
// Before
private readonly DB_VERSION = 11;

// After
private readonly DB_VERSION = 12;
```

- [ ] **Step 3: Create the `user_notes` store in `onupgradeneeded`**

Find the `onupgradeneeded` handler in `src/db/messages.ts`. There will be a chain of `if (event.oldVersion < N)` blocks (the last one is `if (event.oldVersion < 11)`). Add a new block immediately after it:

```typescript
if (event.oldVersion < 12) {
  db.createObjectStore('user_notes', {
    keyPath: 'targetAddress',
  });
}
```

No indexes are needed — notes are always fetched by exact `targetAddress` key.

- [ ] **Step 4: Add `getUserNote` method to the `MessageDB` class**

Add after the existing `getMutedUsers` method (around line 2603):

```typescript
async getUserNote(targetAddress: string): Promise<UserNote | undefined> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('user_notes', 'readonly');
    const store = transaction.objectStore('user_notes');
    const request = store.get(targetAddress);

    request.onsuccess = () => resolve(request.result as UserNote | undefined);
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 5: Add `saveUserNote` method**

Add immediately after `getUserNote`:

```typescript
async saveUserNote(targetAddress: string, note: string): Promise<void> {
  await this.init();
  const trimmed = note.trim();
  if (!trimmed) {
    return this.deleteUserNote(targetAddress);
  }
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('user_notes', 'readwrite');
    const store = transaction.objectStore('user_notes');
    const record: UserNote = {
      targetAddress,
      note: trimmed,
      updatedAt: Date.now(),
    };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 6: Add `deleteUserNote` method**

Add immediately after `saveUserNote`:

```typescript
async deleteUserNote(targetAddress: string): Promise<void> {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction('user_notes', 'readwrite');
    const store = transaction.objectStore('user_notes');
    const request = store.delete(targetAddress);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/db/messages.ts
git commit -m "feat: add user_notes IndexedDB store and MessageDB methods"
```

---

## Task 2: React Query layer

**Files:**
- Create: `src/hooks/queries/userNotes/buildUserNoteKey.ts`
- Create: `src/hooks/queries/userNotes/buildUserNoteFetcher.ts`
- Create: `src/hooks/queries/userNotes/useUserNote.ts`
- Create: `src/hooks/queries/userNotes/useInvalidateUserNote.ts`
- Create: `src/hooks/queries/userNotes/index.ts`

- [ ] **Step 1: Create `buildUserNoteKey.ts`**

```typescript
// src/hooks/queries/userNotes/buildUserNoteKey.ts
const buildUserNoteKey = ({ targetAddress }: { targetAddress: string }) => [
  'userNote',
  targetAddress,
];

export { buildUserNoteKey };
```

- [ ] **Step 2: Create `buildUserNoteFetcher.ts`**

```typescript
// src/hooks/queries/userNotes/buildUserNoteFetcher.ts
import { MessageDB } from '../../../db/messages';

const buildUserNoteFetcher =
  ({ messageDB, targetAddress }: { messageDB: MessageDB; targetAddress: string }) =>
  async () => {
    return await messageDB.getUserNote(targetAddress);
  };

export { buildUserNoteFetcher };
```

- [ ] **Step 3: Create `useUserNote.ts`**

```typescript
// src/hooks/queries/userNotes/useUserNote.ts
import { useQuery } from '@tanstack/react-query';
import { buildUserNoteFetcher } from './buildUserNoteFetcher';
import { buildUserNoteKey } from './buildUserNoteKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useUserNote = ({ targetAddress }: { targetAddress: string }) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: buildUserNoteKey({ targetAddress }),
    queryFn: buildUserNoteFetcher({ messageDB, targetAddress }),
    staleTime: Infinity, // Note state is invalidated manually after save
    enabled: !!targetAddress,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useUserNote };
```

- [ ] **Step 4: Create `useInvalidateUserNote.ts`**

```typescript
// src/hooks/queries/userNotes/useInvalidateUserNote.ts
import { useQueryClient } from '@tanstack/react-query';
import { buildUserNoteKey } from './buildUserNoteKey';

const useInvalidateUserNote = () => {
  const queryClient = useQueryClient();

  return ({ targetAddress }: { targetAddress: string }) => {
    queryClient.invalidateQueries({
      queryKey: buildUserNoteKey({ targetAddress }),
    });
  };
};

export { useInvalidateUserNote };
```

- [ ] **Step 5: Create the barrel `index.ts`**

```typescript
// src/hooks/queries/userNotes/index.ts
export { buildUserNoteKey } from './buildUserNoteKey';
export { buildUserNoteFetcher } from './buildUserNoteFetcher';
export { useUserNote } from './useUserNote';
export { useInvalidateUserNote } from './useInvalidateUserNote';
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/queries/userNotes/
git commit -m "feat: add userNote React Query hooks"
```

---

## Task 3: Add `validateUserNote` validation function

**Files:**
- Modify: `src/hooks/business/validation/useSpaceNameValidation.ts`

The existing `validateUserBio` lives here and uses `validateNameForXSS` + a `MAX_BIO_LENGTH` constant. We follow the same pattern.

- [ ] **Step 1: Add the constant and function**

In `src/hooks/business/validation/useSpaceNameValidation.ts`, find `MAX_BIO_LENGTH` constant and `validateUserBio`. Add the following immediately after `validateUserBio`:

```typescript
const MAX_USER_NOTE_LENGTH = 256;

export const validateUserNote = (note: string): string[] => {
  const errors: string[] = [];

  if (!validateNameForXSS(note)) {
    errors.push(t`Note cannot contain special characters`);
  }

  if (note.length > MAX_USER_NOTE_LENGTH) {
    errors.push(t`Note must be ${MAX_USER_NOTE_LENGTH} characters or less`);
  }

  return errors;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/validation/useSpaceNameValidation.ts
git commit -m "feat: add validateUserNote validation helper"
```

---

## Task 4: UserProfile UI — note textarea

**Files:**
- Modify: `src/components/user/UserProfile.tsx`
- Modify: `src/components/user/UserProfile.scss`

- [ ] **Step 1: Add imports to `UserProfile.tsx`**

At the top of `src/components/user/UserProfile.tsx`, add these imports alongside the existing ones:

```typescript
import { useUserNote, useInvalidateUserNote } from '../../hooks/queries/userNotes';
import { validateUserNote } from '../../hooks/business/validation';
```

- [ ] **Step 2: Add state and data hooks inside the `UserProfile` component**

Inside the `UserProfile` function component, after the existing `isOwnProfile` line (line 76), add:

```typescript
// User note state
const { data: userNoteData } = useUserNote({ targetAddress: props.user.address });
const invalidateUserNote = useInvalidateUserNote();
const [noteValue, setNoteValue] = React.useState('');
const [noteCharCount, setNoteCharCount] = React.useState(0);
const [isNoteFocused, setIsNoteFocused] = React.useState(false);

// Sync note value from DB when data loads
React.useEffect(() => {
  setNoteValue(userNoteData?.note ?? '');
  setNoteCharCount((userNoteData?.note ?? '').length);
}, [userNoteData?.note]);

const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value;
  if (val.length <= 256) {
    setNoteValue(val);
    setNoteCharCount(val.length);
  }
};

const handleNoteBlur = async () => {
  setIsNoteFocused(false);
  const errors = validateUserNote(noteValue);
  if (errors.length > 0) return;
  await messageDB.saveUserNote(props.user.address, noteValue);
  invalidateUserNote({ targetAddress: props.user.address });
};
```

- [ ] **Step 3: Insert the note section into the JSX**

Find the JSX return in `UserProfile.tsx`. The roles block ends around line 190 with `</div>` closing the roles section. The action buttons section starts with `{(!isOwnProfile || canMuteUsers || canKickUsers) && (`. Insert the note section **between** them — after the roles closing `</div>` and before the action buttons `{(!isOwnProfile`:

```tsx
{/* User note — private, only visible to author */}
{!isOwnProfile && (
  <div className="user-profile-note-section">
    <div className="user-profile-content-section-header">
      <span className="text-sm">{t`NOTE — only visible to you`}</span>
    </div>
    <textarea
      className="user-profile-note-textarea"
      placeholder={t`Click to add a note`}
      value={noteValue}
      maxLength={256}
      onChange={handleNoteChange}
      onFocus={() => setIsNoteFocused(true)}
      onBlur={handleNoteBlur}
    />
    {isNoteFocused && (
      <div className="user-profile-note-char-count">
        {noteCharCount}/256
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Add styles to `UserProfile.scss`**

At the end of `src/components/user/UserProfile.scss`, add:

```scss
.user-profile-note-section {
  padding: $s-2 $s-2 0;
}

.user-profile-note-textarea {
  width: 100%;
  min-height: $s-16;
  padding: $s-2;
  background: var(--surface-5);
  border: 1px solid var(--border-subtle);
  border-radius: $rounded-md;
  color: var(--color-text-main);
  font-size: 0.8125rem; // ~13px — readable but compact
  line-height: 1.4;
  resize: none;
  box-sizing: border-box;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--accent);
  }
}

.user-profile-note-char-count {
  text-align: right;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  padding: $s-1 0 $s-2;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit --jsx react-jsx --skipLibCheck
```

Expected: no errors.

- [ ] **Step 6: Run lint**

```bash
yarn lint
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/user/UserProfile.tsx src/components/user/UserProfile.scss
git commit -m "feat: add private user note field to UserProfile popup"
```

---

## Task 5: Manual verification

The app has no automated UI tests, so verify manually in the browser.

- [ ] **Step 1: Start the dev server**

```bash
yarn dev
```

- [ ] **Step 2: Test the happy path**

1. Open the app, join a space with at least one other member.
2. Click on another member's avatar to open their `UserProfile` popup.
3. Confirm the note section appears between the roles block and the action buttons.
4. Confirm the placeholder text reads "Click to add a note".
5. Click the textarea — confirm it focuses and the character counter `0/256` appears.
6. Type a note (e.g. "Test note"). Confirm counter updates.
7. Click outside the textarea (blur). No visible error.
8. Close the profile popup. Re-open the same user's profile.
9. Confirm the note text persisted ("Test note" is still there).

- [ ] **Step 3: Test note deletion**

1. Open the same user's profile.
2. Clear the note textarea entirely.
3. Blur.
4. Close and re-open the profile.
5. Confirm the note is gone (placeholder shows again).

- [ ] **Step 4: Test 256-char limit**

1. Open a user profile.
2. Paste 300 characters into the note field.
3. Confirm only the first 256 are accepted (the textarea stops accepting input at 256).

- [ ] **Step 5: Test own profile**

1. Click on your own profile/avatar.
2. Confirm the note section does NOT appear on your own profile card.

- [ ] **Step 6: Final commit if any fixes were needed**

If any bugs were found and fixed above, commit them:

```bash
git add -p
git commit -m "fix: user notes edge cases from manual testing"
```

---

*Last updated: 2026-05-16*
