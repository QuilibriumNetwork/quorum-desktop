# Shared Types Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all desktop-only types and missing fields to `@quilibrium/quorum-shared`, then update quorum-desktop to import from shared instead of defining locally.

**Architecture:** All type changes are additive (new types + optional fields) — non-breaking for quorum-mobile. Phase 1 modifies quorum-shared type files and bumps the version. Phase 2 removes local definitions from quorum-desktop and updates all imports. Phase 3 verifies builds and cleans up.

**Tech Stack:** TypeScript, `@quilibrium/quorum-shared` (currently `2.1.0-1`), yarn

---

## Type Audit Results

### New types to add to quorum-shared

| Type | Desktop source | Shared destination |
|------|---------------|-------------------|
| `SpaceTag` | `quorumApi.ts:6-9` | `space.ts` |
| `BroadcastSpaceTag` | `quorumApi.ts:12-14` | `space.ts` |
| `ThreadMeta` | `quorumApi.ts:157-165` | `message.ts` |
| `ThreadMessage` | `quorumApi.ts:275-281` | `message.ts` |
| `ChannelThread` | `quorumApi.ts:167-180` | `message.ts` |

### Missing fields on existing shared types

| Shared type | Missing fields | Source |
|------------|---------------|--------|
| `Space` | `spaceTag?: SpaceTag`, `allowThreads?: boolean` | `quorumApi.ts:57-58` |
| `Channel` | `allowThreads?: boolean` | `quorumApi.ts:86` |
| `Message` | `ThreadMessage` in content union, `threadMeta?: ThreadMeta`, `threadId?: string`, `isThreadReply?: boolean` | `quorumApi.ts:131,152-154` |
| `UpdateProfileMessage` | `spaceTag?: BroadcastSpaceTag` | `quorumApi.ts:194` |
| `EditMessage` | `mentions?: Mentions` | `quorumApi.ts:296` |
| `Bookmark` | `threadId?: string` | `quorumApi.ts:323` |
| `UserConfig` | `bio?: string`, `mutedChannels?`, `showMutedChannels?: boolean`, `favoriteDMs?: string[]`, `mutedConversations?: string[]`, `spaceTagId?: string`, `lastBroadcastSpaceTag?` | `db/messages.ts:56,78-94` |
| `SpaceMember` | `joinedAt?: number` | GitHub issue #1 |
| `NavItem` (folder) | `iconVariant?: 'outline' \| 'filled'` | `db/messages.ts:41` |

### Bookmark `cachedPreview` field difference

Desktop is **missing** `senderAddress` in `cachedPreview` — shared already has it. This means desktop's local `Bookmark` type is _behind_ shared. Once desktop imports from shared, it will get `senderAddress` for free. No action needed in shared.

### Types that stay desktop-only (NOT migrated)

| Type | Location | Why |
|------|----------|-----|
| `GetChannelParams` | `quorumApi.ts:349` | API-layer parameter type |
| `GetChannelMessagesParams` | `quorumApi.ts:354` | API-layer parameter type |
| `EncryptedMessage`, `EncryptionState`, `DecryptionResult` | `db/messages.ts` | IndexedDB/encryption internals |
| `SearchableMessage`, `SearchContext`, `MutedUserRecord`, `DeletedMessageRecord`, `SearchResult` | `db/messages.ts` | IndexedDB storage schemas |
| `FolderColor` (as `IconColor` alias) | `db/messages.ts:30` | Desktop UI dependency (`IconColor`) |
| `NavItem` (desktop version) | `db/messages.ts:33-45` | Uses `IconName`/`IconColor` — desktop-specific UI types |
| All `src/types/actionQueue.ts` types | `types/actionQueue.ts` | Client-side queue internals |
| All `src/types/notifications.ts` types | `types/notifications.ts` | Desktop notification types (different from shared `NotificationSettings`) |
| All `src/utils/` types | Various | UI/utility helpers |
| All `src/services/` types | Various | Service internals |
| All `src/components/` types | Various | Component props, contexts |

---

## Chunk 1: quorum-shared Changes

All work in `d:\GitHub\Quilibrium\quorum-shared`.

### Task 1: Add SpaceTag types and extend Space/Channel

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\space.ts`
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\index.ts`

- [x] **Step 1: Add SpaceTag and BroadcastSpaceTag to space.ts**

Add before the `Role` type:

```typescript
export type SpaceTag = {
  letters: string;
  url: string;
};

export type BroadcastSpaceTag = SpaceTag & {
  spaceId: string;
};
```

- [x] **Step 2: Add missing fields to Space**

Add to the end of the `Space` type (before the closing `};`):

```typescript
  spaceTag?: SpaceTag;
  allowThreads?: boolean;
```

- [x] **Step 3: Add missing field to Channel**

Add to the end of the `Channel` type (before the closing `};`):

```typescript
  allowThreads?: boolean;
```

- [x] **Step 4: Export new types from index.ts**

Update the space types export in `index.ts` to include:

```typescript
export type {
  Permission,
  Role,
  Emoji,
  Sticker,
  Group,
  Channel,
  Space,
  SpaceTag,
  BroadcastSpaceTag,
} from './space';
```

- [x] **Step 5: Verify build**

Run: `cd d:/GitHub/Quilibrium/quorum-shared && yarn build`
Expected: Build passes with no errors

- [x] **Step 6: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add src/types/space.ts src/types/index.ts
git commit -m "feat: add SpaceTag types and thread fields to Space/Channel"
```

### Task 2: Add thread types and extend Message types

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\message.ts`
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\index.ts`

- [x] **Step 1: Add ThreadMeta, ThreadMessage, and ChannelThread to message.ts**

Add after the `EditMessage` type (before `MessageContent`):

```typescript
export type ThreadMeta = {
  threadId: string;
  createdBy: string;
  customTitle?: string;
  isClosed?: boolean;
  closedBy?: string;
  autoCloseAfter?: number;
  lastActivityAt?: number;
};

export type ThreadMessage = {
  senderId: string;
  type: 'thread';
  targetMessageId: string;
  action: 'create' | 'updateTitle' | 'close' | 'reopen' | 'updateSettings' | 'remove';
  threadMeta: ThreadMeta;
};

export type ChannelThread = {
  threadId: string;
  spaceId: string;
  channelId: string;
  rootMessageId: string;
  createdBy: string;
  createdAt: number;
  lastActivityAt: number;
  replyCount: number;
  isClosed: boolean;
  customTitle?: string;
  titleSnapshot?: string;
  hasParticipated: boolean;
};
```

- [x] **Step 2: Add ThreadMessage to MessageContent union**

Update the `MessageContent` type to include `ThreadMessage`:

```typescript
export type MessageContent =
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
  | EditMessage
  | ThreadMessage;
```

- [x] **Step 3: Add thread fields to Message**

Add to the end of the `Message` type (before the closing `};`), after `sendError`:

```typescript
  threadMeta?: ThreadMeta;
  threadId?: string;
  isThreadReply?: boolean;
```

- [x] **Step 4: Add spaceTag field to UpdateProfileMessage**

Add to `UpdateProfileMessage`:

```typescript
export type UpdateProfileMessage = {
  senderId: string;
  type: 'update-profile';
  displayName: string;
  userIcon: string;
  spaceTag?: BroadcastSpaceTag;
};
```

This requires adding an import at the top of message.ts:

```typescript
import type { BroadcastSpaceTag } from './space';
```

- [x] **Step 5: Add mentions field to EditMessage**

Update `EditMessage`:

```typescript
export type EditMessage = {
  senderId: string;
  type: 'edit-message';
  originalMessageId: string;
  editedText: string | string[];
  editedAt: number;
  editNonce: string;
  editSignature?: string;
  mentions?: Mentions;
};
```

- [x] **Step 6: Export new types from index.ts**

Update the message types export in `index.ts`:

```typescript
export type {
  MessageSendStatus,
  PostMessage,
  UpdateProfileMessage,
  RemoveMessage,
  EventMessage,
  EmbedMessage,
  ReactionMessage,
  RemoveReactionMessage,
  JoinMessage,
  LeaveMessage,
  KickMessage,
  MuteMessage,
  StickerMessage,
  PinMessage,
  DeleteConversationMessage,
  EditMessage,
  ThreadMessage,
  ThreadMeta,
  ChannelThread,
  MessageContent,
  Reaction,
  Mentions,
  Message,
} from './message';
```

- [x] **Step 7: Verify build**

Run: `cd d:/GitHub/Quilibrium/quorum-shared && yarn build`
Expected: Build passes with no errors

- [x] **Step 8: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add src/types/message.ts src/types/index.ts
git commit -m "feat: add thread types and extend Message/EditMessage/UpdateProfileMessage"
```

### Task 3: Extend Bookmark, UserConfig, SpaceMember, NavItem

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\bookmark.ts`
- Modify: `d:\GitHub\Quilibrium\quorum-shared\src\types\user.ts`

- [x] **Step 1: Add threadId to Bookmark**

Add `threadId?: string;` to the `Bookmark` type, after `createdAt`:

```typescript
export type Bookmark = {
  bookmarkId: string;
  messageId: string;
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
  sourceType: 'channel' | 'dm';
  createdAt: number;
  threadId?: string;
  cachedPreview: {
    senderAddress: string;
    senderName: string;
    textSnippet: string;
    messageDate: number;
    sourceName: string;
    contentType: 'text' | 'image' | 'sticker';
    imageUrl?: string;
    thumbnailUrl?: string;
    stickerId?: string;
  };
};
```

- [x] **Step 2: Add missing fields to UserConfig**

Add the following fields to the end of `UserConfig` (before the closing `};`):

```typescript
  bio?: string;
  mutedChannels?: {
    [spaceId: string]: string[];
  };
  showMutedChannels?: boolean;
  favoriteDMs?: string[];
  mutedConversations?: string[];
  spaceTagId?: string;
  lastBroadcastSpaceTag?: {
    letters: string;
    url: string;
  };
```

- [x] **Step 3: Add joinedAt to SpaceMember**

Add `joinedAt?: number;` to `SpaceMember`:

```typescript
export type SpaceMember = UserProfile & {
  inbox_address: string;
  isKicked?: boolean;
  joinedAt?: number;
};
```

- [x] **Step 4: Add iconVariant to NavItem**

Add `iconVariant?: 'outline' | 'filled';` to the folder variant of `NavItem`:

```typescript
export type NavItem =
  | { type: 'space'; id: string }
  | {
      type: 'folder';
      id: string;
      name: string;
      spaceIds: string[];
      icon?: string;
      color?: FolderColor;
      iconVariant?: 'outline' | 'filled';
      createdDate: number;
      modifiedDate: number;
    };
```

- [x] **Step 5: Verify build**

Run: `cd d:/GitHub/Quilibrium/quorum-shared && yarn build`
Expected: Build passes with no errors

- [x] **Step 6: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add src/types/bookmark.ts src/types/user.ts
git commit -m "feat: extend Bookmark, UserConfig, SpaceMember, NavItem with desktop fields"
```

### Task 4: Version bump and final build verification

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-shared\package.json`

- [x] **Step 1: Bump version**

Change `"version": "2.1.0-1"` to `"version": "2.1.0-3"` in `package.json`.

> **Note:** `2.1.0-2` is already published to the npm registry, so we skip to `2.1.0-3`.

- [x] **Step 2: Full build verification**

Run: `cd d:/GitHub/Quilibrium/quorum-shared && yarn build`
Expected: Build passes with no errors

- [x] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-shared
git add package.json
git commit -m "chore: bump version to 2.1.0-3"
```

> **After PR is merged:** The lead dev (or you, once you have npm access) runs `npm publish` to push `2.1.0-3` to the registry. Then update quorum-desktop's `package.json` from `file:../quorum-shared` back to `"2.1.0-3"`. See `tasks/2026-03-15-npm-publish-access-quorum-shared.md` for getting publish access.

---

## Chunk 2: quorum-desktop Import Refactoring

All work in `d:\GitHub\Quilibrium\quorum-desktop`.

> **Important:** Task 5 (point at local shared) must run first so that `@quilibrium/quorum-shared` resolves to the local checkout with the new types. Otherwise Tasks 6-7 will fail because the published version doesn't have the new types yet.

### Task 5: Point quorum-desktop at local quorum-shared

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-desktop\package.json`

- [x] **Step 1: Switch to file: dependency for development**

Update `"@quilibrium/quorum-shared"` in `package.json` from:

```json
"@quilibrium/quorum-shared": "2.1.0-2",
```

to:

```json
"@quilibrium/quorum-shared": "file:../quorum-shared",
```

- [x] **Step 2: Install updated dependency**

Run: `cd d:/GitHub/Quilibrium/quorum-desktop && yarn install`
Expected: Install completes successfully, `yarn.lock` is updated, quorum-shared now resolves to local checkout

- [x] **Step 3: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add package.json yarn.lock
git commit -m "chore: point quorum-shared to local checkout for types migration"
```

> **Before final PR:** Once the quorum-shared PR is merged and a new version is published to npm, switch this back to a registry version (e.g., `"2.1.0-3"`) and run `yarn install` again. The final desktop PR should NOT have `file:` in it.

### Task 6: Strip quorumApi.ts down to API functions only

**Files:**
- Modify: `d:\GitHub\Quilibrium\quorum-desktop\src\api\quorumApi.ts`

Remove all type definitions. After this, `quorumApi.ts` will only contain:
- API URL functions (kept)
- `GetChannelParams`, `GetChannelMessagesParams` (desktop-only API types, kept)

- [x] **Step 1: Remove all type definitions from quorumApi.ts**

Replace the entire file with:

```typescript
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
```

- [x] **Step 2: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add src/api/quorumApi.ts
git commit -m "refactor: remove all type definitions from quorumApi.ts"
```

### Task 7: Update all imports across the codebase

**Files:**
- Modify: ~100 files across `src/`

This is the bulk of the work. Every file that imported types from `quorumApi` must be updated to import from `@quilibrium/quorum-shared` instead.

**Rules:**
- Type imports → `import type { ... } from '@quilibrium/quorum-shared'`
- `BOOKMARKS_CONFIG` (value) → `import { BOOKMARKS_CONFIG } from '@quilibrium/quorum-shared'`
- API URL functions → keep importing from `quorumApi` (e.g., `import { getUserRegistrationUrl } from '../api/quorumApi'`)
- `GetChannelParams` / `GetChannelMessagesParams` → keep importing from `quorumApi`
- If a file imports both types AND API functions from quorumApi, split into two import statements

**Shared types to import from `@quilibrium/quorum-shared`:**
`Permission`, `SpaceTag`, `BroadcastSpaceTag`, `Role`, `Emoji`, `Sticker`, `Space`, `Group`, `Channel`, `Conversation`, `MessageSendStatus`, `Message`, `ThreadMeta`, `ChannelThread`, `ThreadMessage`, `PostMessage`, `UpdateProfileMessage`, `RemoveMessage`, `EventMessage`, `EmbedMessage`, `ReactionMessage`, `RemoveReactionMessage`, `JoinMessage`, `LeaveMessage`, `KickMessage`, `MuteMessage`, `StickerMessage`, `PinMessage`, `DeleteConversationMessage`, `EditMessage`, `Reaction`, `Mentions`, `Bookmark`, `BOOKMARKS_CONFIG`

- [x] **Step 1: Update `src/api/baseTypes.ts`**

This file only imports API URL functions (values) from quorumApi — no changes needed to this file.

- [x] **Step 2: Update `src/db/messages.ts`**

Change:
```typescript
import { Conversation, Message, Space, Bookmark, BOOKMARKS_CONFIG, BroadcastSpaceTag, ChannelThread } from '../api/quorumApi';
```
To:
```typescript
import type { Conversation, Message, Space, Bookmark, BroadcastSpaceTag, ChannelThread } from '@quilibrium/quorum-shared';
import { BOOKMARKS_CONFIG } from '@quilibrium/quorum-shared';
```

- [x] **Step 3: Update all remaining files**

For each file, change the import source from the relative `quorumApi` path to `@quilibrium/quorum-shared`. Use `import type` for type-only imports (prefer `import type` whenever possible).

There are ~100 files to update. Process them systematically by directory:

**Directories to process (in order):**
1. `src/utils/` (~8 files)
2. `src/types/` (~1 file)
3. `src/services/` (~8 files)
4. `src/hooks/` (~25 files)
5. `src/components/` (~35 files)
6. `src/dev/tests/` (~5 files)

**Example transformations:**

File with types only:
```typescript
// Before:
import { Message as MessageType } from '../../api/quorumApi';
// After:
import type { Message as MessageType } from '@quilibrium/quorum-shared';
```

File with types + values from quorumApi (API functions stay):
```typescript
// Before:
import { Message, getSpaceUrl } from '../../api/quorumApi';
// After:
import type { Message } from '@quilibrium/quorum-shared';
import { getSpaceUrl } from '../../api/quorumApi';
```

File with types + BOOKMARKS_CONFIG:
```typescript
// Before:
import { Bookmark, Message, BOOKMARKS_CONFIG } from '../../../api/quorumApi';
// After:
import type { Bookmark, Message } from '@quilibrium/quorum-shared';
import { BOOKMARKS_CONFIG } from '@quilibrium/quorum-shared';
```

- [x] **Step 4: Type-check**

Run: `cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No type errors (only pre-existing errors remain)

- [x] **Step 5: Commit**

```bash
cd d:/GitHub/Quilibrium/quorum-desktop
git add -A
git commit -m "refactor: update all imports to use @quilibrium/quorum-shared directly"
```

### Task 8: Full build verification

- [x] **Step 1: Type-check**

Run: `cd d:/GitHub/Quilibrium/quorum-desktop && npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No type errors (only pre-existing errors remain)

- [x] **Step 2: Full build**

Run: `cd d:/GitHub/Quilibrium/quorum-desktop && yarn build`
Expected: Build passes with no errors

- [x] **Step 3: Fix any errors**

If type errors occur, they will likely be due to:
1. The `Bookmark.cachedPreview` gaining `senderAddress` (shared has it, desktop doesn't use it yet — should be fine since it's just a type widening)
2. `Conversation` gaining Farcaster fields (additive, non-breaking)
3. `NavItem` folder variant: shared uses `icon?: string` while desktop uses `icon?: IconName` — desktop's `db/messages.ts` `NavItem` is desktop-only and won't conflict since it's a separate type

---

## Chunk 3: Cleanup

### Task 9: Archive completed sub-tasks

- [x] **Step 1: Move absorbed task files**

Move these files to `.agents/tasks/.done/`:
- `tasks/2026-03-14-migrate-thread-types-to-quorum-shared.md`
- `tasks/quorum-shared-space-tags.md`

- [x] **Step 2: Update the parent audit task**

Mark completed items in `tasks/2026-03-14-audit-types-for-quorum-shared-migration.md`

- [x] **Step 3: Update thread-panel.md**

Remove "Migrate thread types to quorum-shared" from the Future Work section if it exists in `.agents/docs/features/messages/thread-panel.md`.

---

## Key Decisions & Notes

1. **Direct imports**: All ~100 files that imported types from `quorumApi` are updated to import directly from `@quilibrium/quorum-shared`. No re-export layer — clean, no tech debt. `quorumApi.ts` is stripped down to API URL functions and desktop-only parameter types only.

2. **Desktop-only `NavItem` and `UserConfig`**: The `db/messages.ts` file has its own `NavItem` and `UserConfig` types that use desktop-specific types (`IconName`, `IconColor`). These are _not_ migrated and remain desktop-only. The shared `NavItem` and `UserConfig` are the canonical wire format; desktop extends them locally for UI concerns.

3. **`Conversation` type**: Desktop's local `Conversation` is _behind_ shared (missing Farcaster fields). Once desktop imports from shared, it will get these fields for free. No action needed.

4. **Development dependency strategy**: During development, desktop uses `"file:../quorum-shared"` to resolve the local checkout. Before the final desktop PR, this must be switched back to a published registry version (e.g., `"2.1.0-3"`). The quorum-shared PR must be merged and published first. See `tasks/2026-03-15-npm-publish-access-quorum-shared.md` for getting npm publish access.

---

_Created: 2026-03-15_
