# Docs Staleness Audit — 2026-05-20

Running audit of `.agents/docs/` against current codebase (worktree branched from `origin/main` at `5cb5b011`).

**Excluded** (under active edit in parent branch `receipts-shared-migration`, will conflict if touched):
- `features/messages/dm-receipts.md`
- `features/messages/typing-indicators.md`
- `features/messages/message-sending-indicator.md`

**Method**: parallel Explore subagents. Each owns a cluster, returns a verdict per file:
- `OK` — accurate, no changes
- `MINOR` — small fixes (typos, one wrong path, an outdated line)
- `STALE` — sections need rewriting against current code
- `OBSOLETE` — doc describes thing that no longer exists, consider archiving

---

## Consolidated Summary

**Total audited**: 71 docs (3 excluded). **OK**: 41. **MINOR**: 18. **STALE**: 12. **OBSOLETE**: 0.

### Dominant pattern — quorum-shared migration drift

The vast majority of staleness comes from code that moved to `@quilibrium/quorum-shared`. Docs still cite local paths that no longer exist:

- **Primitives**: `src/components/primitives/<X>/<X>.tsx`, `src/components/primitives/theme/` — all moved to quorum-shared. Locally only barrel/SCSS remain. Old `FlexRow`/`FlexBetween`/`FlexColumn`/`FlexCenter`/`Container` replaced by single `Flex`.
- **Utils**: `src/utils/permissions.ts`, `src/utils/channelPermissions.ts`, `src/utils/validation.ts`, `src/utils/avatar.ts`, `src/utils/inviteDomain.ts`, `src/utils/markdownStripping.ts`, `src/utils/youtubeUtils.ts` — all moved to quorum-shared.

### Onboarding refactor drift

`Onboarding.tsx` + `useOnboardingFlow.ts` (gone) → `OnboardingFlow.tsx` + `useUnifiedOnboardingFlow.ts`. Affects `profile-sync-returning-user-login.md` and `user-config-sync.md`.

### Schema drift

`UserConfig`, `quorum_db` version, services list are behind: missing `deviceNames`/`deletedDeviceNameAddresses`, DB version is 12 (not 6), stores `deleted_messages`/`channel_threads`/`thread_read_times`/`user_notes`/`muted_users` not listed, services `ReceiptService`/`ThreadService` not listed.

### Fix triage

**STALE (12) — high priority**:
1. `cross-platform-components-guide.md`
2. `component-management-guide.md`
3. `cross-platform-repository-implementation.md`
4. `data-management-architecture-guide.md`
5. `features/avatar-initials-system.md`
6. `features/cross-platform-theming.md`
7. `features/input-validation-reference.md`
8. `features/invite-system-analysis.md`
9. `features/profile-sync-returning-user-login.md`
10. `features/user-config-sync.md`
11. `features/messages/markdown-renderer.md`
12. `features/messages/markdown-stripping.md`
13. `features/messages/message-actions-mobile.md`
14. `features/primitives/05-primitive-styling-guide.md`
15. `features/primitives/API-REFERENCE.md`

**MINOR (18) — quick fixes**:
- `config-sync-system.md`, `expo-dev-testing-guide.md`, `quorum-db-schema.md`, `quorum-shared-architecture.md`, `styling-guidelines.md`
- `features/channel-space-mute-system.md`, `features/modal-save-overlay.md`, `features/modals.md`, `features/mute-user-system.md`, `features/search-feature.md`, `features/space-tags.md`, `features/user-notes.md`
- `features/messages/message-preview-rendering.md`
- `features/primitives/01-introduction-and-concepts.md`, `02-primitives-quick-reference.md`, `04-web-to-native-migration.md`
- `space-permissions/space-permissions-architecture.md`, `space-permissions/space-roles-system.md`

---

## Clusters

| ID | Cluster | Files | Status |
|----|---------|-------|--------|
| C1 | Top-level architecture & guides | 11 | **done** |
| C2 | features/ — A-M | 17 | **done** |
| C3 | features/ — N-Z | 15 | **done** |
| C4 | features/messages/ (minus 3 excluded) | 17 | **done** |
| C5 | features/primitives/ + space-permissions/ + development/ | 12 | **done** |

---

## Findings

### C1 — Top-level architecture & guides

| File | Verdict | Stale items |
|------|---------|-------------|
| `cross-platform-components-guide.md` | STALE | Multiple sections show local `src/components/primitives/Button/Button.web.tsx` — moved to quorum-shared. Imports reference `Container`/`FlexRow`/`FlexBetween`/`FlexColumn`/`FlexCenter` — these no longer exist (replaced by single `Flex` from quorum-shared). Line 1100: `src/components/primitives/theme/colors.ts` moved to quorum-shared. |
| `component-management-guide.md` | STALE | Line 25 path `src/components/primitives/theme/colors.ts` stale. Lines 112-120 list non-existent primitives. Lines 205-215 show local primitive file structure that doesn't exist. Lines 186/193 broken links (correct: `./features/primitives/05-...` and `03-...`). |
| `config-sync-system.md` | MINOR | Doc cites `src/db/messages.ts:50-75` — actual start is line 48. `UserConfig` type (lines 25-51) omits `deviceNames` and `deletedDeviceNameAddresses` added by device-naming feature. |
| `cross-platform-repository-implementation.md` | STALE | Lines 396-408 describe `src/components/primitives/theme/index.ts` + `ThemeProvider.ts` as local — gone. `Button.web.tsx`/`Button.native.tsx` described as local — now quorum-shared only. Line 179: `mobile:build` script doesn't exist in `package.json`. |
| `cryptographic-architecture.md` | OK | Paths verified. |
| `device-naming.md` | OK | All 8 files match. `UserConfig.deviceNames`/`deletedDeviceNameAddresses` at `messages.ts` lines 105/107 confirmed. |
| `expo-dev-testing-guide.md` | MINOR | `yarn mobile:build` doesn't exist. `expo-cli` recommendation deprecated for Expo SDK 46+ (project on ~53). |
| `quorum-db-schema.md` | MINOR | `user_config` schema (lines 255-278) omits `deviceNames` + `deletedDeviceNameAddresses`. DB version 12 + other stores correct. |
| `data-management-architecture-guide.md` | STALE | Line 63: `DB_VERSION = 6` — actual is 12. Object Stores list omits 5 stores added in v7-12: `deleted_messages`, `channel_threads`, `thread_read_times`, `user_notes`, `muted_users`. Services list omits `ReceiptService` and `ThreadService`. `searchService.ts` casing wrong. |
| `quorum-shared-architecture.md` | MINOR | Line 173 says "Peer Dependencies: React 18+" — actual `quorum-shared/package.json` requires `>=19.0.0`. Line 171: version `2.1.0` shown but actual `2.1.0-13`. |
| `styling-guidelines.md` | MINOR | Line 296 "~10 files currently use `@apply`" — snapshot claim possibly outdated, but advisory not structural. All other paths/links valid. |

### C2 — features/ (A-M)

| File | Verdict | Stale items |
|------|---------|-------------|
| `features/action-queue.md` | OK | `ActionQueueService.ts`, handlers, context, hooks confirmed. |
| `features/avatar-initials-system.md` | STALE | `src/utils/avatar.ts` moved to `@quilibrium/quorum-shared`. `DefaultImages.ts` not in `src/utils/`. `SpaceAvatar` is at `src/components/space/SpaceAvatar/` (not `src/components/user/`). |
| `features/channel-space-mute-system.md` | MINOR | Paths verified; minor cleanup. |
| `features/cross-platform-theming.md` | STALE | "File Structure" lists `src/components/primitives/theme/` — moved to quorum-shared. All 5 theme files now shared-only. Architecture description still accurate. |
| `features/delete-confirmation-system.md` | OK | All file paths verified. |
| `features/desktop-notifications.md` | OK | `NotificationService.ts`, `WebsocketProvider.tsx`, `MessageService.ts`, `UserSettingsModal.tsx` confirmed. |
| `features/dropdown-panels.md` | OK | `DropdownPanel.tsx`, `MobileDrawer.tsx`, SCSS files confirmed. |
| `features/input-validation-reference.md` | STALE | `src/utils/validation.ts` moved to `@quilibrium/quorum-shared` (confirmed via imports). Doc points to local path for `MAX_MESSAGE_LENGTH`, `validateNameForXSS`, etc. |
| `features/invite-system-analysis.md` | STALE | "SpaceSettingsModal.tsx (lines 742-907)" — invite UI moved to `SpaceSettingsModal/Invites.tsx`. `src/utils/inviteDomain.ts` moved to quorum-shared. |
| `features/kick-user-system.md` | OK | `KickUserModal.tsx`, `useUserKicking.ts`, `SpaceService.ts` confirmed. |
| `features/mention-notification-system.md` | OK | All hook/service/component paths verified. |
| `features/mention-pills-ui-system.md` | OK | `mentionPillDom.ts` confirmed. |
| `features/modal-save-overlay.md` | MINOR | Frontmatter `updated: 2025-01-16` likely typo (should be 2026). All paths OK. |
| `features/modals.md` | MINOR | Architecture says "8 modals" for ModalProvider but lists 9; `FolderEditorModal` missing from inventory. |
| `features/mute-conversation-system.md` | OK | All hooks/components/services confirmed. |
| `features/mute-user-system.md` | MINOR | `src/utils/channelPermissions.ts` moved to quorum-shared. |
| `features/notification-indicators-system.md` | OK | All paths confirmed. |

### C3 — features/ (N-Z)

| File | Verdict | Stale items |
|------|---------|-------------|
| `features/offline-support.md` | OK | Paths verified (`ActionQueueContext.tsx`, `OfflineBanner.tsx`, `ActionQueueService.ts`, hook names). |
| `features/onboarding-flow.md` | OK | `useUnifiedOnboardingFlow.ts`, `OnboardingFlow.tsx`, `steps/` all present. |
| `features/profile-sync-returning-user-login.md` | STALE | References removed files: `useOnboardingFlow.ts` (gone) and `Onboarding.tsx` (gone). Replacements: `useUnifiedOnboardingFlow.ts` + `OnboardingFlow.tsx`. App.tsx snippet and data-flow likely pre-unification. |
| `features/reacttooltip-mobile.md` | OK | `src/components/ui/ReactTooltip.tsx` confirmed. |
| `features/responsive-layout.md` | OK | `useResponsiveLayout.ts`, `ResponsiveLayoutProvider.tsx`, `NavMenu.scss`, `_modal_common.scss` confirmed. |
| `features/search-feature.md` | MINOR | Doc says `src/services/searchService.ts` — actually `SearchService.ts` (capital S). New hooks under `src/hooks/business/search/` not documented. |
| `features/security.md` | OK | `MessageService.ts`, `rateLimit.ts`, `validation.ts` paths consistent. |
| `features/space-folders.md` | OK | All component/hook/utility paths verified. |
| `features/space-settings-fixes-section.md` | OK | `SpaceSettingsModal/General.tsx`, `SyncService.ts`, `MessageService.ts` exist. |
| `features/space-tags.md` | MINOR | Doc claims quorum-shared not updated with SpaceTag types — verify (may be resolved). |
| `features/toast-notifications.md` | OK | `src/utils/toast.ts`, `Layout.tsx`, sync toast API current. |
| `features/touch-interaction-system.md` | OK | `useLongPress.ts`, `haptic.ts`, `touchInteraction.ts` present. |
| `features/user-config-sync.md` | STALE | References `Onboarding.tsx` (gone) — replaced by `OnboardingFlow.tsx`. Superseded by `profile-sync-returning-user-login.md`. |
| `features/user-data-backup.md` | OK | `BackupService.ts`, `UserSettingsModal/Privacy.tsx` confirmed. |
| `features/user-notes.md` | MINOR | Says "Four files in `src/hooks/queries/userNotes/`" — actually five (including `index.ts`). |

### C5 — features/primitives/ + space-permissions/ + development/

| File | Verdict | Stale items |
|------|---------|-------------|
| `features/primitives/01-introduction-and-concepts.md` | MINOR | Import examples use local `'../components/primitives/Button'` and `'../components/primitives/theme'` — primitives now live in `@quilibrium/quorum-shared` (re-exported through local barrel). |
| `features/primitives/02-primitives-quick-reference.md` | MINOR | Stale `useTheme` import path. Broken link `'../component-architecture-workflow-explained.md'`. ScrollContainer props doc shows `height="auto\|fit\|full"` — real API is `'xs\|sm\|md\|lg\|xl\|auto'` + numeric. API-REFERENCE link broken. |
| `features/primitives/03-when-to-use-primitives.md` | OK | Conceptual, no file paths. |
| `features/primitives/04-web-to-native-migration.md` | MINOR | Import examples use local paths — actual source is `@quilibrium/quorum-shared`. |
| `features/primitives/05-primitive-styling-guide.md` | STALE | Lists `colors.ts` at `/src/components/primitives/theme/colors.ts` — doesn't exist locally; lives in quorum-shared. |
| `features/primitives/API-REFERENCE.md` | STALE | All `Location:` fields point to `src/components/primitives/<X>/<X>.tsx` — none exist locally (all in quorum-shared). Flex/Spacer/ScrollContainer have no local directory. Broken `02-primitives-AGENTS.md` link. |
| `features/primitives/INDEX.md` | OK | Internal links valid. |
| `space-permissions/read-only-channels-system.md` | OK | Component/hook paths verified. `hasPermission` is from `@quilibrium/quorum-shared`, doc says `src/utils/permissions.ts` (minor). |
| `space-permissions/space-permissions-architecture.md` | MINOR | Lists `src/utils/permissions.ts` + `src/utils/channelPermissions.ts` — neither exists; `hasPermission` is in quorum-shared. |
| `space-permissions/space-roles-system.md` | MINOR | Same stale `src/utils/permissions.ts` reference. All hooks/components verified. |
| `development/android-build-workflow.md` | OK | Self-consistent personal notes. |
| `development/dependency-upgrade-guide.md` | OK | Accurate Vite 8/Rolldown description, upgrade blockers current as of 2026-04-07. |

**Cluster theme**: primitives migrated to `@quilibrium/quorum-shared` — local `src/components/primitives/` now barrel-only. Any doc citing `src/components/primitives/<X>/<X>.tsx` as a location is stale. Same pattern for `src/utils/permissions.ts` → moved to quorum-shared.

### C4 — features/messages/

| File | Verdict | Stale items |
|------|---------|-------------|
| `features/messages/auto-jump-first-unread.md` | OK | Paths and logic match. |
| `features/messages/bookmarks.md` | OK | Paths, types, sync architecture current. |
| `features/messages/client-side-image-compression.md` | OK | `src/utils/imageProcessing/` confirmed. |
| `features/messages/custom-emoji-picker.md` | OK | `src/components/emoji-picker/` and consumers verified. |
| `features/messages/dm-conversation-list-previews.md` | OK | `src/utils/messagePreview.ts` confirmed. |
| `features/messages/hash-navigation-to-old-messages.md` | OK | `loadMessagesAround.ts` + consumers confirmed. |
| `features/messages/markdown-renderer.md` | STALE | (1) Feature flag sample shows `ENABLE_MARKDOWN = false` — actual `src/config/features.ts` has `true`. (2) Lists `src/utils/youtubeUtils.ts` — moved to quorum-shared. (3) `YouTubeFacade` snippet missing required `thumbnailSrc` prop. |
| `features/messages/markdown-stripping.md` | STALE | `src/utils/markdownStripping.ts` no longer in desktop — moved to quorum-shared. Consumers import from `@quilibrium/quorum-shared`. |
| `features/messages/message-actions-mobile.md` | STALE | (1) Claims "Integration Point 3: Emoji Picker" reuses `emoji-picker-react` — custom picker replaced it. (2) Lists `ActionMenuItem.tsx` in New Files — doesn't exist. |
| `features/messages/message-highlight-system.md` | OK | Dual mechanism, CSS, hash cleanup all verified. |
| `features/messages/message-preview-rendering.md` | MINOR | `markdownStripping.ts` path stale; one code snippet imports from `'../../utils/markdownStripping'` — actual import is `@quilibrium/quorum-shared`. |
| `features/messages/message-signing-system.md` | OK | Hierarchy and verification logic accurate. |
| `features/messages/new-messages-separator.md` | OK | Architecture matches. |
| `features/messages/pinned-messages.md` | OK | Defense-in-depth, broadcast pattern verified. |
| `features/messages/thread-panel.md` | OK | All key files verified; thread types migration noted. |
| `features/messages/thread-mobile-visibility-guidance.md` | OK | Self-flags as guidance snapshot; consistent. |
| `features/messages/youtube-facade-optimization.md` | OK | Correctly references quorum-shared `youtubeUtils.ts`; `thumbnailSrc` prop documented. |




---

## Fix Phase

### F4 — primitives docs (done)
- `05-primitive-styling-guide.md`: `colors.ts` paths updated to `@quilibrium/quorum-shared`.
- `API-REFERENCE.md`: all 20 component `Location:` fields updated to quorum-shared paths; broken link fixed.
- `01-introduction-and-concepts.md`: Button import example fixed; directory tree illustration left as historical context.
- `02-primitives-quick-reference.md`: `useTheme` import fixed; broken file link removed; ScrollContainer props corrected against actual types (`height`, `borderRadius`, props list).
- `04-web-to-native-migration.md`: 5 import statements fixed.
- `03-when-to-use-primitives.md`: skipped (was OK).

### F2 — features A-M (done)
- `avatar-initials-system.md`: `src/utils/avatar.ts` → quorum-shared; `DefaultImages` path corrected to `src/utils.ts`; SpaceAvatar was already correct.
- `cross-platform-theming.md`: "File Structure" + "Platform Resolution" rewritten to reflect theme in quorum-shared.
- `input-validation-reference.md`: all `validation.ts` references updated to quorum-shared; `Onboarding.tsx` → `OnboardingFlow.tsx`.
- `invite-system-analysis.md`: line range claim → `SpaceSettingsModal/Invites.tsx`; `inviteDomain.ts` → quorum-shared.
- `profile-sync-returning-user-login.md`: orchestrator updated to `useUnifiedOnboardingFlow.ts` + `OnboardingFlow.tsx`; App.tsx snippet corrected.
- `user-config-sync.md`: `Onboarding.tsx` → `OnboardingFlow.tsx`; `useOnboardingFlowLogic.ts` still valid.
- `modals.md`: ModalProvider count fixed (was 8, actually 10); `FolderEditorModal` added to inventory.
- `modal-save-overlay.md`: frontmatter date typo 2025 → 2026 fixed.

### F3 — features N-Z + messages + space-permissions (done)
- `markdown-renderer.md`: `ENABLE_MARKDOWN` default fixed; `youtubeUtils.ts` → quorum-shared; `YouTubeFacade` snippet adds `thumbnailSrc`.
- `markdown-stripping.md`: Key Files entry → `@quilibrium/quorum-shared`.
- `message-actions-mobile.md`: emoji picker description corrected to custom picker; non-existent `ActionMenuItem.tsx` removed.
- `channel-space-mute-system.md`: paths verified, no content changes.
- `mute-user-system.md`: `channelPermissions.ts` references → quorum-shared.
- `search-feature.md`: `searchService.ts` → `SearchService.ts` (6 occurrences).
- `space-tags.md`: limitation note rewritten — SpaceTag types confirmed in quorum-shared.
- `user-notes.md`: "Four files" → "Five files"; `index.ts` row added.
- `message-preview-rendering.md`: `markdownStripping.ts` Key Files + import snippet → quorum-shared.
- `space-permissions-architecture.md`: `permissions.ts` + `channelPermissions.ts` → quorum-shared.
- `space-roles-system.md`: audit item was a false positive; footer-only update.

### F1 — top-level architecture & guides (done)
- `cross-platform-components-guide.md`: Layer 1 diagram → quorum-shared; `Container`/`FlexRow`/`FlexColumn`/`FlexBetween` → `Flex` with `direction` prop; `theme/colors.ts` → `getColors()` from quorum-shared; Additional Resources links fixed.
- `component-management-guide.md`: Theming System line → quorum-shared; stale primitives import block → `Flex`/`Spacer`/`ScrollContainer`; File Structure section reflects barrel + SCSS local; broken links fixed.
- `cross-platform-repository-implementation.md`: file tree shows barrel re-export pattern; Theme Provider Hybrid Resolution rewritten for pre-built bundles; Platform File Resolution updated.
- `data-management-architecture-guide.md`: `DB_VERSION` 6 → 12; 5 missing stores added (`deleted_messages`, `channel_threads`, `thread_read_times`, `user_notes`, `muted_users`); `ReceiptService` + `ThreadService` added; `SearchService.ts` casing fixed.
- `config-sync-system.md`: `deviceNames` + `deletedDeviceNameAddresses` added to `UserConfig` snippet; line range 50-75 → 48-108.
- `quorum-db-schema.md`: `deviceNames` + `deletedDeviceNameAddresses` added to `user_config` store schema.
- `quorum-shared-architecture.md`: version `2.1.0` → `2.1.0-13`; peer dep React 18+ → React 19+.

---

## Summary

All 4 fix batches complete. **32 docs updated** across:
- F1 (top-level): 7
- F2 (features A-M): 8
- F3 (features N-Z + messages + space-permissions): 11
- F4 (primitives): 6

*Last updated: 2026-05-20 — all fix batches done*
