---
type: task
title: "Migrate Thread Types to quorum-shared"
status: open
complexity: medium
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - "docs/features/messages/thread-panel.md"
  - "docs/quorum-shared-architecture.md"
related_tasks: []
---

# Migrate Thread Types to quorum-shared

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Files**:
- Source (quorum-desktop): `src/api/quorumApi.ts:157-180, 275-281`
- Source (quorum-desktop): `src/services/channelThreadHelpers.ts`
- Target (quorum-shared): `src/types/message.ts`
- Target (quorum-shared): `src/types/index.ts`
- Target (quorum-shared): `src/types/space.ts`
- Target (quorum-shared): `src/types/bookmark.ts`

## What & Why

The thread feature is fully implemented in quorum-desktop but all thread-related types live locally in `src/api/quorumApi.ts`. These types need to move to `@quilibrium/quorum-shared` so that quorum-mobile can consume the same type definitions, ensuring sync compatibility and consistent data structures across platforms.

**Current state**: Thread types (`ThreadMeta`, `ThreadMessage`, `ChannelThread`) and thread-related fields on `Message`, `PostMessage`, `Bookmark`, `Space`, and `Channel` exist only in quorum-desktop.

**Desired state**: Shared types live in `@quilibrium/quorum-shared/src/types/`, quorum-desktop imports them from the shared package, and quorum-mobile can consume them when implementing threads.

**Scope decision**: This task covers **types and pure helper functions only**. Hooks (`useThreadMessages`, `useThreadStats`, `useChannelThreads`) are tightly coupled to desktop's `MessageDB` / IndexedDB layer and React Query patterns. Moving hooks requires broader architectural decisions (StorageAdapter extensions, shared hook patterns) and should be a separate task discussed with the lead dev.

## Context

- **Existing pattern**: quorum-shared already has `Message`, `PostMessage`, `PinMessage`, `Bookmark`, `Space`, `Channel` types that quorum-desktop imports and extends locally. Thread types follow the exact same pattern as `PinMessage` (a message content variant with `targetMessageId` and an `action` field).
- **quorum-shared repo**: `d:\GitHub\Quilibrium\quorum-shared` — currently has **zero** thread-related code.
- **No breaking changes**: Adding new types and optional fields to existing types is additive and non-breaking for quorum-mobile.
- **Constraint**: quorum-shared is published as `@quilibrium/quorum-shared@2.1.0-1`. Changes require a version bump and publish cycle.

## Prerequisites
- [ ] Confirm with lead dev that moving types (not hooks) to quorum-shared is approved
- [ ] Ensure local quorum-shared repo is on the correct branch (likely `main` or `develop`)
- [ ] No conflicting PRs on quorum-shared

## Implementation

### Phase 1: Add Thread Types to quorum-shared

All work in `d:\GitHub\Quilibrium\quorum-shared`.

1. **Add `ThreadMeta` type** (`src/types/message.ts`)
   - Add before the `Message` type definition:
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
   ```

2. **Add `ThreadMessage` content type** (`src/types/message.ts`)
   - Add alongside other message content types (after `PinMessage`):
   ```typescript
   export type ThreadMessage = {
     senderId: string;
     type: 'thread';
     targetMessageId: string;
     action: 'create' | 'updateTitle' | 'close' | 'reopen' | 'updateSettings' | 'remove';
     threadMeta: ThreadMeta;
   };
   ```
   - Add `ThreadMessage` to the `MessageContent` union type

3. **Add `ChannelThread` type** (`src/types/message.ts`)
   - Add the denormalized thread summary type:
   ```typescript
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

4. **Extend `Message` type with thread fields** (`src/types/message.ts`)
   - Add three optional fields to the existing `Message` type:
   ```typescript
   threadMeta?: ThreadMeta;
   threadId?: string;
   isThreadReply?: boolean;
   ```

5. **Extend `PostMessage` with `threadId`** (`src/types/message.ts`)
   - Add optional `threadId` field for thread reply posts:
   ```typescript
   export type PostMessage = {
     senderId: string;
     type: 'post';
     text: string | string[];
     repliesToMessageId?: string;
     threadId?: string;
   };
   ```

6. **Extend `Space` with `allowThreads`** (`src/types/space.ts`)
   - Add optional field to `Space` type:
   ```typescript
   allowThreads?: boolean;
   ```

7. **Extend `Channel` with `allowThreads`** (`src/types/space.ts`)
   - Add optional field to `Channel` type:
   ```typescript
   allowThreads?: boolean;
   ```

8. **Extend `Bookmark` with `threadId`** (`src/types/bookmark.ts`)
   - Add optional field to `Bookmark` type:
   ```typescript
   threadId?: string;
   ```

9. **Export new types** (`src/types/index.ts`)
   - Add to the message exports:
   ```typescript
   export type { ThreadMeta, ThreadMessage, ChannelThread } from './message';
   ```

10. **Build and verify** — Run the quorum-shared build to ensure no type errors:
    ```bash
    cd d:\GitHub\Quilibrium\quorum-shared && yarn build
    ```

### Phase 2: Update quorum-desktop Imports

All work in `d:\GitHub\Quilibrium\quorum-desktop`.

1. **Remove local type definitions** (`src/api/quorumApi.ts`)
   - Remove `ThreadMeta`, `ThreadMessage`, `ChannelThread` type definitions
   - Remove `threadMeta`, `threadId`, `isThreadReply` from the local `Message` type
   - Remove `threadId` from local `PostMessage` type
   - Remove `allowThreads` from local `Space` and `Channel` types
   - Remove `threadId` from local `Bookmark` type

2. **Add imports from quorum-shared** (`src/api/quorumApi.ts`)
   - Import `ThreadMeta`, `ThreadMessage`, `ChannelThread` from `@quilibrium/quorum-shared`
   - Verify that `Message`, `PostMessage`, `Space`, `Channel`, `Bookmark` imports already come from shared (they should, since shared already defines the base types)

3. **Update all consumer files** — Search for any file that imports `ThreadMeta`, `ThreadMessage`, or `ChannelThread` from `quorumApi` and update the import path to `@quilibrium/quorum-shared`:
   - `src/services/ThreadService.ts`
   - `src/services/channelThreadHelpers.ts`
   - `src/services/MessageService.ts`
   - `src/components/thread/ThreadPanel.tsx`
   - `src/components/thread/ThreadsListPanel.tsx`
   - `src/components/thread/ThreadListItem.tsx`
   - `src/components/thread/ThreadIndicator.tsx`
   - `src/components/modals/ThreadSettingsModal.tsx`
   - `src/components/space/Channel.tsx`
   - `src/hooks/business/threads/*.ts`
   - Any other files importing these types (search: `import.*Thread.*from.*quorumApi`)

4. **Build and verify** — Run the quorum-desktop build:
    ```bash
    yarn build
    ```

### Phase 3: Optional — Migrate Pure Helpers

**Only if approved**: Move `channelThreadHelpers.ts` pure functions to quorum-shared.

1. **Move `buildChannelThreadFromCreate()`** to quorum-shared
   - Depends on `stripMarkdown` — either move that too or accept the dependency
   - This function is a pure data transformer with no platform-specific code

2. **Move `updateChannelThreadOnReply()`** to quorum-shared
   - Fully portable — no external dependencies beyond the types

**Note**: Phase 3 is lower priority and can be deferred. The helpers have a dependency on `stripMarkdown` (which uses `remark` npm packages) that may not be desirable in the shared package.

## What's Explicitly OUT of Scope

These items require separate tasks and broader discussion:

| Item | Why deferred |
|------|-------------|
| **React hooks** (`useThreadMessages`, `useThreadStats`, `useChannelThreads`, `useUpdateThreadReadTime`) | Tightly coupled to desktop's `MessageDB` context provider. Requires `StorageAdapter` extensions and shared hook architecture decisions. |
| **ThreadService class** | Coupled to `MessageDB`, React Query `QueryClient`, and `@lingui/core` i18n. Core logic could be extracted but needs abstraction design. |
| **DB operations** (`getThreadMessages`, `saveChannelThread`, etc.) | Platform-specific IndexedDB implementations. Would need `StorageAdapter` interface extensions. |
| **StorageAdapter extensions** | Adding thread methods to the shared `StorageAdapter` interface affects both platforms and needs coordinated rollout. |
| **Thread-aware cache patterns** | React Query key strategies and cache invalidation are app-specific. |

## Verification

✅ **quorum-shared builds successfully**
   - Run: `cd d:\GitHub\Quilibrium\quorum-shared && yarn build`
   - Verify: No TypeScript errors, declarations generated

✅ **quorum-desktop builds successfully**
   - Run: `cd d:\GitHub\Quilibrium\quorum-desktop && yarn build`
   - Verify: No TypeScript errors

✅ **quorum-desktop type-checks**
   - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
   - Verify: No type errors

✅ **Thread feature works end-to-end**
   - Test: Create thread → reply → view in thread panel → close thread
   - Test: Thread settings modal works (title edit, close, reopen)
   - Test: Threads list panel shows threads correctly
   - Test: Thread-aware navigation (bookmarks, search, pins jump into threads)

✅ **No regressions in non-thread features**
   - Test: Regular messaging, reactions, pinning still work
   - Test: Bookmarks panel still works

## Definition of Done
- [ ] Lead dev approves moving types to quorum-shared
- [ ] All Phase 1 changes implemented and quorum-shared builds
- [ ] All Phase 2 changes implemented and quorum-desktop builds
- [ ] TypeScript passes in both repos
- [ ] Thread feature manually tested end-to-end
- [ ] quorum-shared version bumped and published (or linked locally)
- [ ] PR created for quorum-shared
- [ ] PR created for quorum-desktop (depends on shared PR merge)

---

_Created: 2026-03-14_
