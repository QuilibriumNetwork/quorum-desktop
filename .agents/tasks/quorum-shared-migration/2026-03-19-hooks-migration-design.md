# Hooks Migration to quorum-shared — Design & Inventory

> **Status**: BLOCKED — Waiting for access to latest quorum-mobile codebase
> **Prep branch**: `feat/hooks-prep-for-sharing` (current, for this design doc and audit updates)
> **Migration branch (future)**: `feat/shared-hooks-migration` (to be created from `main` when ready)
> **Spec Date**: 2026-03-19

---

## Executive Summary

Migrate business logic hooks from quorum-desktop to quorum-shared so both desktop and mobile consume the same hook implementations. This eliminates the current situation where mobile independently reimplements the same business logic (channel management, role management, user kicking, etc.), creating divergent behavior and double maintenance burden.

**Scale**: ~265 hook files in desktop, classified as:

| Category | Count | Description |
|----------|-------|-------------|
| A: Pure business hooks | ~74 | No context deps — shareable with minimal work |
| A2: Query helpers | ~55 | buildFetcher, buildKey, useInvalidate — pure utilities |
| B: Context-dependent hooks | ~63 | Need storage/crypto abstraction layer |
| B2: Query hooks with contexts | ~18 | Query hooks using useMessageDB or useQuorumApiClient |
| C: Platform-specific | ~11 | Adapter pattern — stay in desktop/mobile repos |
| Uncategorized | ~8 | Root-level, ui/, utils/, mutations — see classification below |

Note: Counts include `.native.ts` and `.web.ts` platform variants as separate files.

**Blocker**: The storage/crypto abstraction interface design requires understanding mobile's current architecture (MMKV storage, NativeCryptoProvider, broadcastSpaceUpdate pattern) to ensure compatibility. We need access to the latest quorum-mobile codebase before proceeding.

---

## Current State

### What quorum-shared already has (migrated)

| Module | Status | Notes |
|--------|--------|-------|
| Types | Done | Space, Message, Channel, User, Conversation, Bookmark types |
| Utils | Done | 22 utility modules (validation, formatting, mentions, etc.) |
| Primitives | Done | 22 cross-platform UI components with web/native variants |
| Query hooks | Partial | useSpaces, useSpace, useSpaceMembers, useChannels, useMessages |
| Mutation hooks | Partial | useSendMessage, useEditMessage, useDeleteMessage, useAddReaction, useRemoveReaction |
| Query keys | Partial | queryKeys factory for spaces, channels, messages, conversations, user, bookmarks |

### What quorum-desktop has (to migrate)

```
src/hooks/
├── queries/           ~88 files — React Query adapters by domain
├── mutations/         1 file   — useUploadRegistration
├── business/          ~160 files — organized by domain
│   ├── bookmarks/     1 hook
│   ├── channels/      10 hooks
│   ├── conversations/ 9 hooks
│   ├── dm/            3 hooks
│   ├── files/         1 hook
│   ├── folders/       6 hooks (5 + useNavItems)
│   ├── invites/       3 hooks
│   ├── mentions/      6 hooks
│   ├── messages/      13 hooks
│   ├── replies/       3 hooks
│   ├── search/        ~20 hooks
│   ├── spaces/        14 hooks (includes useSpaceDragAndDrop)
│   ├── threads/       2 hooks
│   ├── ui/            ~16 hooks
│   ├── user/          ~18 hooks
│   └── validation/    6 hooks
├── platform/          ~11 files — adapter pattern (clipboard, files, passkeys, hotkeys)
├── ui/                3 files  — useConfirmation, useScrollTracking, useWindowResize
├── utils/             1 file   — forceUpdate
└── root-level         8 files  — useClickOutside, useContextMenuPrevention, useKeyBackup,
                                  useLongPress, useResponsiveLayout (.ts/.native.ts),
                                  useSearchContext (.ts/.native.ts)
```

### What quorum-mobile has (duplicated independently)

Based on the (outdated) local copy, mobile has its own implementations of:

| Mobile Hook | Desktop Equivalent | Duplication Risk |
|------------|-------------------|-----------------|
| `useChannelManagement.ts` (376 lines) | `business/channels/useChannelManagement.ts` (396 lines) | HIGH — same CRUD ops, different storage |
| `useRoleManagement.ts` (449 lines) | `business/spaces/useRoleManagement.ts` (150 lines) | HIGH — same role ops, different broadcast |
| `useUserKicking.ts` (143 lines) | `business/user/useUserKicking.ts` | HIGH — same confirmation flow + kick |
| `useInviteManagement.ts` | `business/spaces/useInviteManagement.ts` | HIGH — same invite ops |
| `useSpaceActions.ts` | `business/spaces/useSpaceManagement.ts` | MEDIUM — similar space CRUD |
| `useSpaceSettings.ts` | `business/spaces/useSpaceSettings.ts` | MEDIUM |
| `useSendMessage.ts` | Already in quorum-shared | Shared version exists |
| `useMessages.ts` | Already in quorum-shared | Shared version exists |
| `useSpaces.ts` | Already in quorum-shared | Shared version exists |
| `useChannels.ts` | Already in quorum-shared | Shared version exists |
| `useConversations.ts` | `business/conversations/` | MEDIUM |
| `useReactions.ts` | Already in quorum-shared | Shared version exists |

**Key architectural difference**: Desktop hooks use `useMessageDB()` context (wraps IndexedDB + crypto + broadcast). Mobile hooks call lower-level services directly (`saveSpace()`, `getMMKVAdapter()`, `broadcastSpaceUpdate()`).

---

## Hook Classification

### Category A: Pure Hooks (No Context Dependencies) — ~74 hooks

These have no direct context imports. However, see the "Transitive Dependencies" note below — some call query hooks that internally use contexts, so they still require the provider tree to be present.

**Validation (6)**:
- `useChannelValidation`, `useDisplayNameValidation`, `useGroupNameValidation`
- `useMessageValidation`, `useProfileValidation`, `useSpaceNameValidation`

**UI State Management (16)**:
- `useClickToCopyInteractionLogic`, `useCopyToClipboardLogic`
- `useCustomAssets`, `useDragState`
- `useFileUpload` (UI state), `useImageLoading`, `useModalManagement`
- `useModalSaveState`*, `useModalState`, `useSpaceFileUploads`
- `useTooltipInteraction` (.ts/.native.ts/.web.ts), `useUserProfileModal`

**Messages — Pure (8)**:
- `useEmojiPicker`, `useMessageComposer` (UI state)
- `useMessageFormatting`, `useMessageHighlight`, `useMessageInteractions`
- `useQuickReactions`, `useViewportMentionHighlight`

**Mentions — Pure (2)**:
- `useMentionInput`, `useMentionPillEditor`

**Search — Pure (19)**:
- `useGlobalSearchNavigation` (.ts/.native.ts), `useGlobalSearchState`
- `useKeyboardNavigation`, `useKeyboardShortcuts` (.ts/.native.ts)
- `useSearchFocusManager`, `useSearchResultDisplaySpace`
- `useSearchResultFormatting`, `useSearchResultHighlight`
- `useSearchResultsKeyboard`, `useSearchResultsOutsideClick` (.ts/.native.ts)
- `useSearchResultsResponsive` (.ts/.native.ts), `useSearchResultsState`
- `useSearchResultsVirtualization`, `useSearchSuggestions`

**Channels — Pure (2)**:
- `useChannelPermissions`, `useSpaceGroups`

**Folders — Pure (2)**:
- `useFolderStates`, `useNavItems`

**Invites — Pure (1)**:
- `useInviteUI`

**Spaces — Pure (3)**:
- `useSpaceOrdering`, `useSpaceSettings`, `useSpaceTag`

**User — Pure (7)**:
- `useFileUpload` (.ts/.native.ts), `useLocaleSettings`
- `useNotificationSettings` (.ts/.native.ts), `useOnboardingFlow`
- `useUserProfileActions`, `useUserRoleDisplay`

> **Transitive dependencies**: The following hooks are "pure" in that they don't directly import contexts, but they call query hooks (e.g., `useConversations()`, `useSpace()`) that internally use `useMessageDB()`. They will need the provider tree present at runtime:
> - `useChannelData` (calls `useSpace`, `useSpaceMembers`)
> - `useConversationPolling` (calls `useConversations`)
> - `useConversationsData` (calls `useConversations`)
> - `useShowHomeScreen` (calls `useConversations`)
> - `useSpaceHeader` (calls `useSpace`, `useResponsiveLayout`)
> - `useRoleManagement` display hooks (calls `useSpace`)
>
> These can still migrate to shared, but only after the query hooks they depend on are also migrated with proper abstraction.

> **localStorage/window dependencies**: Some "pure" hooks access browser APIs directly:
> - `useAccentColor` — reads/writes `localStorage`
> - `useFrequentEmojis` — reads `localStorage` via `useSyncExternalStore`
> - `useShowHomeScreen` — reads/writes `localStorage`
> - `useElectronDetection` — accesses `window.process`
> - `useModalSaveState` — reads/writes `localStorage`
>
> These need a thin `useStorage` abstraction (localStorage on web, AsyncStorage/MMKV on native) to be truly cross-platform. They are NOT shareable without modification on React Native.

### Category A2: Query Helpers — Pure (~55 hooks)

These are pure utility functions with zero context or platform dependencies:
- All `build*Fetcher.ts` files (~13)
- All `build*Key.ts` files (~13)
- All `useInvalidate*.ts` files (~13)
- `loadMessagesAround`, `useGlobalSearch`

These can move to shared at any time with no abstraction work.

### Category B: Context-Dependent Hooks — ~63 hooks

These use `useMessageDB()`, `usePasskeysContext()`, `useRegistrationContext()`, or `useQuorumApiClient()`. They need a storage/crypto abstraction layer before they can be shared.

**useMessageDB only (10)**:
- `useBookmarks`, `useChannelManagement`, `useGroupManagement`
- `useUpdateReadTime`, `useUpdateThreadReadTime`, `useInviteProcessing`
- `useChannelThreads`, `useThreadMessages`, `useUserRoleManagement`
- `useConversationPreviews`

**useMessageDB + usePasskeysContext (27)**:
- `useChannelMute`, `useDirectMessagesList`, `useDMFavorites`, `useDMMute`
- `useDeleteFolder`, `useFolderManagement`, `useInviteJoining`
- `useAllMentions`, `useChannelMentionCounts`, `useMentionNotificationSettings`, `useSpaceMentionCounts`
- `useChannelUnreadCounts`, `useDirectMessageUnreadCount`, `useMessageActions`, `usePinnedMessages`, `useSpaceUnreadCounts`
- `useAllReplies`, `useReplyNotificationCounts`, `useSpaceReplyCounts`
- `useBatchSearchResultsDisplay`, `useSearchResultDisplay`, `useSearchResultDisplayDM`
- `useSpaceProfile`, `useSpaceTagStartupRefresh`, `useUserMuting`
- `useSpaceJoining`, `useSpaceDragAndDrop`

**useMessageDB + usePasskeysContext + useRegistrationContext (7)**:
- `useInviteManagement`, `useSpaceCreation`, `useSpaceLeaving`
- `useSpaceManagement`, `useSpaceRecovery`, `useUserKicking`, `useUserSettings`

**useQuorumApiClient only (5)**:
- `useAddressValidation` (.ts/.native.ts), `useInviteValidation`
- `useAuthenticationFlow`, `useOnboardingFlowLogic`

**Other contexts (8)**:
- `usePasskeysContext` only: `useChannelMessages`, `useDirectMessageData`, `useMutedConversationsSync`, `useKeyBackupLogic`, `useProfileImage`, `useWebKeyBackup`
- `useClipboardAdapter` only: `useCopyToClipboard`
- `useModalContext` only: `useGroupEditor`, `useSpacePermissions`, `useDirectMessageCreation`
- `useDragStateContext + useMessageDB`: `useFolderDragAndDrop`, `useSpaceDragAndDrop`

### Category B2: Query Hooks with Contexts (~18 hooks)

These are the actual query hooks (not helpers) that depend on contexts:
- 13 use `useMessageDB` (useConfig, useConversation, useConversations, useMessages, useSpaces, useSpaceMembers, useSpaceOwner, useEncryptionStates, useMutedUsers, useBookmarks, useResolvedBookmark, useUserInfo)
- 5 use `useQuorumApiClient` (useChannel, useGlobal, useInbox, useRegistration, useRegistrationOptional)

These cannot migrate until the abstraction layer (Decision 1) is resolved.

### Category C: Platform-Specific (Stay in Desktop) — ~11 hooks

Already using adapter pattern, stay in their respective platform repos:

- `platform/clipboard/useClipboard.web.ts` / `.native.ts`
- `platform/files/useFileDownload.web.ts` / `.native.ts`
- `platform/interactions/useNavigationHotkeys.ts` / `.native.ts`
- `platform/user/usePasskeyAdapter.web.ts` / `.native.ts`

### Uncategorized / Special Cases (~8 hooks)

| Hook | Location | Decision |
|------|----------|----------|
| `useClickOutside` | root | Platform-specific (DOM events) — stays in desktop |
| `useContextMenuPrevention` | root | Platform-specific (DOM events) — stays in desktop |
| `useKeyBackup` | root | Composed hook (logic + adapter) — already uses hybrid pattern, good reference for Decision 1 |
| `useLongPress` | root | Has platform detection logic — needs review |
| `useResponsiveLayout` (.ts/.native.ts) | root | Already has platform variants — shareable |
| `useSearchContext` (.ts/.native.ts) | root | Already has platform variants — shareable |
| `useConfirmation` | ui/ | Pure state machine — shareable. Used as dependency by multiple Category B hooks |
| `useScrollTracking` | ui/ | Pure — shareable |
| `useWindowResize` | ui/ | Platform-specific (DOM) — stays in desktop |
| `useUploadRegistration` | mutations/ | Uses useQuorumApiClient — Category B |
| `forceUpdate` | utils/ | Pure utility — shareable |
| `useSearchService` | business/search/ | Imports `SearchService` class from services/ — service class must also migrate or hook needs factory pattern |

---

## Open Design Decisions

### Decision 1: Storage/Crypto Abstraction Interface

Desktop hooks use `useMessageDB()` which provides a high-level API wrapping IndexedDB + crypto + WebSocket broadcast. Mobile calls lower-level services directly (MMKV, NativeCryptoProvider, broadcastSpaceUpdate).

**Options**:

**(A) Shared context interface** — Define a `useMessageDB()` interface in quorum-shared. Both platforms provide their own implementation via React context. Hooks call `useMessageDB()` and get platform-appropriate storage.
- Pro: Hooks don't change their call pattern, minimal refactoring
- Con: Need to define a stable interface that works for both, mobile needs to wrap its services

**(B) Dependency injection** — Shared hooks accept `storage`, `crypto`, `broadcast` as parameters (like the existing shared query hooks use `storage` and `apiClient`).
- Pro: Hooks are pure and testable, no context coupling
- Con: Every component call site needs to pass these deps, or a wrapper hook bridges the gap

**(C) Hybrid** — Category A (pure) hooks move as-is. Category B hooks use a thin adapter context that's defined in shared but implemented per-platform.
- Pro: Best of both worlds
- Con: More architectural pieces to maintain

**Precedent**: The existing `useKeyBackup` root-level hook already implements the hybrid pattern — it composes `useKeyBackupLogic` (pure business logic) with `useFileDownloadAdapter` (platform-specific). This is a working in-repo example of Option C.

**Recommendation**: Decision blocked until we can inspect mobile's architecture. Lean toward (C) since it matches what's already working for the existing shared hooks and has in-repo precedent.

### Decision 2: Query Hooks — Consolidate or Keep Separate?

quorum-shared already has some query hooks (useSpaces, useChannels, useMessages). Desktop has ~88 more query hooks following a different pattern (using useMessageDB directly vs accepting storage as parameter).

**Important constraint**: Only the ~55 query helpers (buildFetcher, buildKey, useInvalidate) can migrate independently. The 18 actual query hooks using useMessageDB or useQuorumApiClient need the abstraction layer from Decision 1 first.

**Options**:
- Migrate query helpers first (PR 1a), then query hooks with abstraction later (part of PR 4)
- Keep all query hooks together in one PR after abstraction is designed
- Migrate all at once

**Recommendation**: Split query migration: helpers first (safe, no deps), actual query hooks later with abstraction.

### Decision 3: Hook Extractions Still Needed

Two components still have inline business logic that should be extracted before migration:

1. **UserSettingsModal/Privacy.tsx** — QR code display logic, backup management → `usePrivateKeyQR`, `useBackupManagement`
2. **SpaceSettingsModal/Invites.tsx** — Inline SearchableConversationSelect component → `useSearchableSelect` + extracted component

These extractions should happen as part of the migration work, not separately.

### Decision 4: What About New Hooks?

Between now and migration, new features will create new hooks. This is fine — as long as they follow the existing patterns (business hooks in `src/hooks/business/`, organized by domain), they'll be migration-ready by default.

### Decision 5: i18n Dependency (@lingui/core/macro)

Multiple hooks import `t` from `@lingui/core/macro` for internationalized error messages (validation hooks, useChannelManagement, etc.). If these hooks move to quorum-shared, the shared package would need to handle i18n.

**Open question**: Does mobile use `@lingui` or a different i18n solution? This affects whether error message strings stay in hooks or get passed in as parameters.

### Decision 6: Import Transition Strategy

When hooks move to shared, desktop needs to update all import paths. Two options:
- **Re-export pattern**: Desktop's `src/hooks/` becomes a barrel that re-exports from `@quilibrium/quorum-shared` (same pattern used for utils migration)
- **Bulk import update**: Update all consumer files to import directly from `@quilibrium/quorum-shared`

The re-export pattern was used successfully for the utils migration and minimizes the diff in consumer files.

---

## Prep Work Completed (This Session)

Even though we're not executing the migration now, this session accomplished:

- [x] Full inventory of all ~265 hook files with dependency classification
- [x] Identification of mobile code duplication (12+ hooks reimplemented independently)
- [x] Classification into Pure (A) / Context-dependent (B) / Platform-specific (C) categories
- [x] Identification of transitive dependencies and localStorage concerns in "pure" hooks
- [x] Analysis of 12 subcomponents — determined only 2 need extraction, 10 are correctly pure presentation
- [x] Identified the architectural blocker (storage abstraction needs mobile context)
- [x] Documented open design decisions with options and recommendations
- [x] Branch renamed from `feat/shared-hooks-migration` to `feat/hooks-prep-for-sharing`

## When Ready: Migration Execution Order

> **Important**: The hook inventory in this spec is a snapshot from 2026-03-19. Before starting migration, re-audit the hooks directory to capture any hooks added/changed/removed by new features since this spec was written. The classification approach (Pure / Context-dependent / Platform-specific) and the open design decisions remain valid — only the specific file lists need refreshing.

1. **Get mobile access** — inspect current storage/crypto/broadcast architecture
2. **Re-audit hooks** — refresh the inventory against current codebase
3. **Design abstraction layer** — resolve Decisions 1, 5, 6
4. **Create `feat/shared-hooks-migration` branch** on both repos
5. **PR 1: Query helpers** — migrate pure query helpers (buildFetcher, buildKey, useInvalidate)
6. **PR 2: Pure business hooks** — migrate Category A hooks
7. **PR 3: Hook extractions** — extract remaining inline logic (Privacy.tsx, Invites.tsx, plus any new ones found in re-audit)
8. **PR 4: Abstraction layer + context-dependent hooks** — design shared context interface, migrate Category B + B2 hooks
9. **PR 5: Desktop cleanup** — update imports to re-export from `@quilibrium/quorum-shared`, remove local copies, verify builds
10. **Mobile integration** — update mobile to consume shared hooks, remove duplicate implementations, integration testing to verify behavior parity

---

## Reference: Existing Documentation

- [Business Logic Extraction Plan](.agents/tasks/mobile-dev/business-logic-extraction-plan.md) — Phase 1 complete, lessons learned
- [Cross-Platform Hooks Refactoring Plan](.agents/tasks/mobile-dev/cross-platform-hooks-refactoring-plan.md) — Adapter pattern architecture (partially outdated, written for single-repo approach)
- [Component Audit](src/dev/components-audit/audit.json) — Component status tracking
- [Utils Migration Design](.agents/tasks/quorum-shared-migration/2026-03-18-utils-migration-design.md) — Reference for migration pattern

---

_Last updated: 2026-03-19_
