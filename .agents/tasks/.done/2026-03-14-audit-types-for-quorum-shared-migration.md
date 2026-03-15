---
type: task
title: "Audit & Migrate All Desktop Types to quorum-shared"
status: open
complexity: high
ai_generated: true
created: 2026-03-14
updated: 2026-03-14
related_docs:
  - "docs/quorum-shared-architecture.md"
  - "docs/features/messages/thread-panel.md"
  - "docs/features/space-tags.md"
related_tasks:
  - "tasks/2026-03-14-migrate-thread-types-to-quorum-shared.md"
  - "tasks/quorum-shared-space-tags.md"
  - "tasks/new-member-badge-spaces.md"
  - "tasks/primitives-migration-to-quorum-shared.md"
---

# Audit & Migrate All Desktop Types to quorum-shared

> **⚠️ AI-Generated**: May contain errors. Verify before use.

**Repos**:
- quorum-shared: `d:\GitHub\Quilibrium\quorum-shared`
- quorum-desktop: `d:\GitHub\Quilibrium\quorum-desktop`

## What & Why

Multiple features have been implemented on quorum-desktop with types defined locally that should live in `@quilibrium/quorum-shared` for mobile compatibility and cross-platform sync. These are currently tracked in scattered tasks:

- **Thread types** — `tasks/2026-03-14-migrate-thread-types-to-quorum-shared.md`
- **Space Tags types** — `tasks/quorum-shared-space-tags.md`
- **SpaceMember.joinedAt** — GitHub issue `QuilibriumNetwork/quorum-shared#1`

There may be more types that haven't been audited yet. This task consolidates everything into one audit + one migration + one PR.

## Context

- **quorum-shared** currently defines types in `src/types/` (message.ts, space.ts, user.ts, bookmark.ts, conversation.ts)
- **quorum-desktop** extends and adds types locally in `src/api/quorumApi.ts` and possibly other files
- After adding types to quorum-shared, quorum-desktop must remove local definitions and update all imports — this is the bulk of the work
- All type additions are **additive** (new types + optional fields on existing types) — non-breaking for quorum-mobile
- **Lead dev approval needed** before executing the migration
- Personal reference guide at `.temp/quorum-shared-migration-guide.md` explains types vs hooks vs utils

## Prerequisites
- [ ] Lead dev approves the migration (message drafted — see notes below)
- [ ] quorum-shared repo is on correct branch

## Implementation

### Phase 1: Full Type Audit

Compare every type definition in quorum-desktop against quorum-shared and produce a complete list of what's missing.

1. **Read quorum-shared types** — All files in `d:\GitHub\Quilibrium\quorum-shared\src\types\`
   - `message.ts` — Message, PostMessage, all content types, MessageContent union
   - `space.ts` — Space, Channel, Group, Role, Permission, Emoji, Sticker
   - `user.ts` — UserProfile, UserConfig, SpaceMember, NavItem, NotificationSettings
   - `bookmark.ts` — Bookmark
   - `conversation.ts` — Conversation

2. **Read quorum-desktop types** — `src/api/quorumApi.ts` is the main file, but also check:
   - `src/types/` folder (if it exists) for additional type files
   - Any other files that define `export type` or `export interface` that aren't component props
   - Search pattern: `export type|export interface` across `src/`

3. **Produce a diff** — For each type in quorum-desktop, determine:
   - Is it already in quorum-shared? (exact match)
   - Is it in quorum-shared but missing fields? (partial — list missing fields)
   - Is it completely absent from quorum-shared? (new type needed)
   - Is it desktop-only and should NOT be shared? (e.g., component props, IndexedDB schemas)

4. **Consolidate with existing tasks** — Cross-reference findings against the already-audited items:
   - Thread types (from `tasks/2026-03-14-migrate-thread-types-to-quorum-shared.md`)
   - Space tag types (from `tasks/quorum-shared-space-tags.md`)
   - joinedAt field (from GitHub issue #1)
   - Anything new the audit discovers

5. **Output**: Update this task with a complete table of types to migrate

### Phase 2: quorum-shared Changes

All work in `d:\GitHub\Quilibrium\quorum-shared`.

1. **Add new types** — Based on audit results, add all new type definitions
2. **Extend existing types** — Add missing optional fields to existing types
3. **Add to MessageContent union** — If new message content types found (e.g., ThreadMessage)
4. **Update exports** — Add all new types to `src/types/index.ts`
5. **Build and verify** — `yarn build` must pass with no errors
6. **Version bump** — Bump package version for the release

### Phase 3: quorum-desktop Import Refactoring

All work in `d:\GitHub\Quilibrium\quorum-desktop`. **This is the bulk of the work.**

1. **Remove local type definitions** from `src/api/quorumApi.ts` (and any other source files)
   - Delete the type/interface blocks that now live in quorum-shared
   - Remove locally-added fields from types that are now extended in shared

2. **Update imports across the entire codebase**
   - Find every file that imports migrated types from `quorumApi` or local paths
   - Change import source to `@quilibrium/quorum-shared`
   - Search pattern: `import.*{.*TypeName.*}.*from.*quorumApi`
   - This could touch dozens of files depending on how many types are migrated

3. **Update package.json** — Bump `@quilibrium/quorum-shared` version to match the new release

4. **Build and verify**:
   - `npx tsc --noEmit --jsx react-jsx --skipLibCheck` — no type errors
   - `yarn build` — full build passes
   - Manual smoke test — app runs, key features work

### Phase 4: Cleanup

1. **Archive absorbed tasks** — Move individual migration tasks to `.done/` or `.archived/`:
   - `tasks/2026-03-14-migrate-thread-types-to-quorum-shared.md`
   - `tasks/quorum-shared-space-tags.md`
2. **Close GitHub issue #1** if `joinedAt` is included
3. **Update thread-panel.md** — Remove "Migrate thread types to quorum-shared" from Future Work
4. **Create PRs**:
   - PR on quorum-shared (must merge first)
   - PR on quorum-desktop (depends on shared PR)

## Lead Dev Message (Draft)

Ready to send — asking for approval:

> I need to migrate some types to quorum-shared from quorum-desktop, it's something I can handle myself. Okay if I go for it?
>
> There are several features on desktop that have types not yet in the shared package:
> - **Thread types** — `ThreadMeta`, `ThreadMessage`, `ChannelThread`, plus thread fields on `Message`, `PostMessage`, `Bookmark`, `Space`, `Channel`
> - **Space Tags types** — `SpaceTag`, `BroadcastSpaceTag`, plus fields on `Space`, `SpaceMember`, `UpdateProfileMessage`, `UserConfig`
> - **SpaceMember.joinedAt** — for the new member badge feature (already filed as issue #1 on quorum-shared)
> - Possibly more — I haven't audited everything yet, there may be other features with types that are out of sync
>
> I'd batch these together into one PR on quorum-shared so we don't do multiple small version bumps.
>
> Then I would also migrate the primitives since you already gave me the okay to go for it.
>
> What about utility functions and hooks? ~90% of utility functions in quorum-desktop can be migrated directly to quorum-shared (things like date formatting, validation, markdown processing, mention parsing). Hooks are a little trickier, but we can start a refactoring so that most of them can also be migrated.
>
> Okay with all the above?

## Verification

✅ **Audit is complete** — Every desktop type compared against quorum-shared

✅ **quorum-shared builds** — `yarn build` in quorum-shared passes

✅ **quorum-desktop builds** — `yarn build` in quorum-desktop passes

✅ **quorum-desktop type-checks** — `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **App runs correctly** — Key features smoke-tested (messaging, threads, space tags, bookmarks)

## Definition of Done
- [x] Full type audit completed and documented in this task
- [ ] Lead dev approves migration
- [x] All types added to quorum-shared, build passes
- [x] All quorum-desktop imports updated, build passes
- [x] Individual migration tasks archived
- [ ] GitHub issue #1 closed (if included)
- [ ] PR created for quorum-shared
- [ ] PR created for quorum-desktop

---

_Created: 2026-03-14_
