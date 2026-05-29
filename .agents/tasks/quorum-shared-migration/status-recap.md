---
type: status-recap
title: Quorum-shared migration — current status snapshot
status: reference
created: 2026-05-28
updated: 2026-05-29
audience: future agents re-orienting after a break
---

# Where we are with the quorum-shared migration

> Plain-English snapshot to help re-orient. Update at end of each migration session. [README.md](README.md) is the authoritative row-by-row tracker; this doc is the friendly summary. [shipped-log.md](shipped-log.md) is the chronological log.

## The one-line story

Code that needs to be **identical** on desktop and mobile (wire formats, sync logic, business rules) is being progressively moved from `quorum-desktop` into a shared npm package, `@quilibrium/quorum-shared`, so mobile can import it instead of reimplementing the same logic.

## What's shipped (✅)

Foundation (March–May 2026):
- Shared types (Space, Message, Channel, User, Conversation, Bookmark, Receipt, Typing)
- Primitives (22 cross-platform UI components, PR #2)
- Utils (22 modules, PR #3) + their tests
- TypingService + ReceiptService (full features: types + service + tests)
- UserConfig privacy fields, `UserNote` named type, `isProfilePublic`/`farcasterLink`

Hooks/validators (May 28–29 sessions):
- **`useTwoStepConfirm`** — extracted from desktop's `useUserKicking` + `useSpaceLeaving` (shared #19, desktop #161). Mobile adoption deferred — runtime test required.
- **Field validators** (`validateSpaceName`, `validateDisplayName`, `validateChannelName`, etc.) with the new **`errorKey` i18n pattern**. Codified as a workflow rule: shared returns codes, platforms translate. (shared #20, desktop #162.) Mobile task dropped at [mobile-tasks-pending.md](mobile-tasks-pending.md).
- **Length alignment**: `MAX_NAME_LENGTH` 40 → 50, `MIN_NAME_LENGTH = 2` (matches mobile). Folder names still at 40 — flagged in `space-folders.md` for future PR.
- **`useAddressValidation` dedupe** (2026-05-29 morning) — desktop hook's inline base58/IPFS-CID check replaced with shared's existing `isValidIPFSCID(address, true)`. `useAddressValidation.native.ts` deleted (no longer needed). Net `-123` LOC. Commit `888d76ca`.
- **`useInviteValidation` dedupe** (2026-05-29 afternoon) — desktop hook's inline `parseInviteLink` callback (~30 LOC) replaced with shared's existing `parseInviteParams` + `getValidInvitePrefixes` (both already imported elsewhere in desktop). The returned `parseInviteLink` was dead public surface. Net `-30` LOC. Commit `17e19b70`.
- **Key-backup dead-code cleanup** (2026-05-29 afternoon) — surfaced by the same spot-check pattern: `useKeyBackupLogic` + `useWebKeyBackup` both inlined a two-step-confirm state machine duplicating shared's `useTwoStepConfirm`, but the public fields (`handleAlreadySaved`, `getConfirmationButtonText`, `alreadySavedConfirmationStep`) were dead surface with zero consumers. Deleted rather than rewired (per "don't design for hypothetical future requirements" rule). Net `-71` LOC. Commit `4e4f4d8d`.

## Architectural findings (no code, but important)

- **`StorageAdapter` + `CryptoProvider` interfaces are already in shared** and implemented on both platforms. The March hooks audit's "blocker — need to design abstraction layer" was already resolved before that audit was written. See [designs/2026-05-28-hooks-audit-refresh.md](designs/2026-05-28-hooks-audit-refresh.md).
- **Mobile structures business hooks as thin TanStack mutation wrappers over stateless services**, NOT monolithic form-state controllers like desktop. Per the "follow mobile patterns" workflow rule, shared APIs adopt mobile's shape.
- **Mobile has ~67 hooks** (not the ~17 an earlier morning scan claimed) — full parallel implementations of `useChannelManagement`, `useRoleManagement`, `useUserKicking`, `useInviteManagement`.

## What's paused (⏸️)

- **Per-space notification sync** (desktop ↔ mobile). Waiting on lead-dev reply to a drafted GitHub issue at [`../../.temp/2026-05-28-notification-prefs-github-issue.md`](../../.temp/2026-05-28-notification-prefs-github-issue.md). Mobile uses MMKV + iOS NSE for notification prefs, desktop uses `UserConfig.notificationSettings[spaceId]`. Convergence is small in code (~50 LOC mobile-side) but the architecture call is the lead's. **Don't ship more notification-shaped changes to shared until the lead replies.**
- **`NavItem.icon`/`.color`** structural alignment — deferred until mobile builds folder UI (currently mobile only constructs `{ type: 'space', id }` items).

## What stays per-app (❌)

Re-audited as not viable for migration:
- **ActionQueueService** — desktop is messaging reliability spine; mobile's `mutationQueue.ts` is a Farcaster-only stub with zero callers. See [designs/2026-05-28-actionqueue-reaudit.md](designs/2026-05-28-actionqueue-reaudit.md).
- **SearchService** — same MiniSearch config across platforms but desktop persists in IndexedDB, mobile rebuilds in-memory per session. Different storage models, different scopes. One micro-shareable (MiniSearch options constant) for opportunistic bundling. See [designs/2026-05-29-searchservice-reaudit.md](designs/2026-05-29-searchservice-reaudit.md).
- **MessageService** (~2000 lines, deeply coupled — explicitly out of scope)
- **ConfigService, EncryptionService, SpaceService, InvitationService, SyncService, NotificationService, ActionQueueHandlers**

## What's queued for future sessions

- **Mobile validation adoption** ([mobile task](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-05-28-adopt-shared-validators.md)) — runtime test required. Drop in when mobile testing is on the table.
- **`useInviteManagement` minor nudge** — line 97 uses `manualAddress?.length === 46` as the API-lookup trigger heuristic; tightening to `isValidIPFSCID(manualAddress)` would avoid spurious calls for 46-char non-Qm strings. 1-line behavioral tightening, not a duplication removal. Worth folding into any future bigger refactor of this hook (which the audit flags as a "monolithic form-state controller" mobile has a split-mutation parallel for).
- **Remaining Cat B sub-buckets** — `useMessageDB only` (14 hooks) still un-spot-checked. Hit rate has been dropping; this is the last small sub-bucket worth a sweep before concluding the bucket-mining phase.
- **More desktop hooks (Cat A)** — pure hooks worth case-by-case verification: `useSpaceOrdering`, `useFolderStates`, `useEmojiPicker`. Each is its own per-task workflow. Not yet investigated.
- **`getMutedChannelsForSpace` + `isChannelMuted`** (deferred candidate from 2026-05-29 morning) — pure functions in `channelUtils.ts`, used by 7 hooks. Operates on shared `UserConfig['mutedChannels']` type. **Blocked** on the notifications track unblocking (mobile issue #65 still has zero comments as of 2026-05-29). Moving these now risks baking in a notification architecture the lead-dev's reply could contradict.
- **ThreadService, BackupService** — still blocked (ThreadService on hooks abstraction state, BackupService on shared symmetric crypto). Re-evaluate when their blockers clear.

## Pre-flight before any new session

```bash
cd D:\GitHub\Quilibrium\quorum-shared && git pull
cd D:\GitHub\Quilibrium\quorum-mobile && git fetch && git log -1 --format="%h %ad %s" --date=short origin/master
cd D:\GitHub\Quilibrium\quorum-desktop && git status --short
```

**Mobile working tree is stuck on a Jan 14 commit. ALWAYS read mobile files via `git show origin/master:<path>`, never via the working tree.**

## How to use this doc

- This is a status snapshot, not a plan. Per-task files in this folder are the plan.
- [README.md](README.md) status table is authoritative — this doc is the friendly summary.
- [shipped-log.md](shipped-log.md) is the longitudinal log of completed migrations.
- [2026-05-28-cross-repo-workflow.md](2026-05-28-cross-repo-workflow.md) is the workflow rulebook.
- Re-read this doc when coming back to the migration after a break, OR update it at the end of any migration session that materially changed status.

---

*Updated 2026-05-29 (afternoon) — added `useInviteValidation` and `useAddressValidation` to the shipped list. "What's queued" reorganized to reflect the Cat B small-bucket sweep findings: 2 new entries (key-backup dead-code cleanup, useInviteManagement nudge), 1 promotion (remaining `useMessageDB only` 14-hook bucket is the only un-swept small Cat B sub-bucket left). Notifications track still paused — mobile GitHub issue #65 zero comments since filing.*

*Created 2026-05-28 as a one-shot re-orientation doc. Rewritten 2026-05-29 to compress 177 → ~80 lines and reflect that the original "next session" recommendations (Option 1/2/3) all shipped or were re-audited. Now structured as a rolling status snapshot.*
