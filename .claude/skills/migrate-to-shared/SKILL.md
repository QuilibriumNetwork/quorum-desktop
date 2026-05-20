---
name: "migrate-to-shared"
description: "Migrate code from quorum-desktop to quorum-shared. Activates when moving utils, hooks, or components to the shared package. Guides the full workflow: analysis, copy, refactor imports, update barrel, delete local source, verify builds on web and mobile."
---

# Migrate to quorum-shared

Guide for migrating code from `quorum-desktop` to `@quilibrium/quorum-shared` so it can be consumed by all Quorum apps (web, mobile, Electron).

**Trigger phrases:** "migrate to shared", "move to shared", "extract to shared", "share this with mobile", "move this to quorum-shared"

## Prerequisites

Before starting any migration:

1. **Confirm `link:` dependency is active** in `d:/GitHub/Quilibrium/quorum-desktop/package.json`:
   ```json
   "@quilibrium/quorum-shared": "link:../quorum-shared"
   ```
   If not, set it and run `yarn install`. **Note:** in this repo, desktop stays on `link:` even in merged PRs — the published-version swap happens on downstream consumers (mobile, etc.), not desktop. See "Phase 6" for the actual publish workflow.

2. **Create matching branches on BOTH repos before touching any code.** Use the same branch name on `quorum-shared` (from `master`) and `quorum-desktop` (from `main`). The user typically creates the desktop branch first; this skill creates the shared one. Mirroring the name makes the PR pair obvious to reviewers.

3. **Confirm quorum-shared builds cleanly** before making changes (this is the baseline you'll compare against):
   ```bash
   cd d:/GitHub/Quilibrium/quorum-shared && yarn build
   ```

---

## Phase 1: Analyze What to Migrate

Before copying anything, classify every file/function the user wants to migrate.

### Decision Matrix

| Question | Yes → Migrate | No → Keep in Desktop |
|----------|--------------|---------------------|
| Is it a pure function with no DOM/platform deps? | Migrate | — |
| Does it only import from `@quilibrium/quorum-shared` types? | Migrate | — |
| Does it use `window`, `document`, `navigator`? | Only if guarded with `typeof window` | Keep |
| Does it import `@lingui`? | Migrate after stripping (see Phase 2) | — |
| Does it depend on desktop DB/adapter layer? | — | Keep |
| Does it use desktop-specific React context/stores? | — | Keep |
| Does it have `.web.tsx` / `.native.tsx` splits needed? | Migrate (handle platform files) | — |
| Is it an ESM-only npm dependency? | Needs `.native.ts` fallback for Metro | — |

### Dependency Analysis

For each candidate file, check:

```bash
# What does this file import?
grep "^import" d:/GitHub/Quilibrium/quorum-desktop/src/<path-to-file>

# What imports this file?
grep -r "from.*<module-name>" d:/GitHub/Quilibrium/quorum-desktop/src/ --include="*.ts" --include="*.tsx" -l
```

Classify imports into:
- **Shared types** (`@quilibrium/quorum-shared`) — already available, change to relative in shared
- **npm packages** — check if they exist in shared's `package.json`, add if missing
- **Desktop-only modules** — these block migration unless refactored
- **`@lingui/core/macro`** — strip and replace with plain English defaults

---

## Phase 2: Prepare Files for Shared

For each file being migrated, apply these transformations:

### 2a. Fix Imports

| Original (desktop) | Replacement (shared) |
|---|---|
| `import type { X } from '@quilibrium/quorum-shared'` | `import type { X } from '../types'` (or appropriate relative path) |
| `import { logger } from '@quilibrium/quorum-shared'` | `import { logger } from '../utils/logger'` (it lives at `src/utils/logger.ts`) |
| `import { Foo } from '@/types/<name>'` | `import { Foo } from '../types/<name>'` — desktop's `@/` alias does NOT exist in shared, all aliases must become relative paths |
| `import { Bar } from '@/services/<Name>'` | Same — relative path to wherever you placed it in shared |
| `import { t } from '@lingui/core/macro'` | Remove entirely |

### 2b. Strip @lingui

Replace all `t` tagged template literals with plain English strings:
```typescript
// Before
t`[Image]`
t`invalid message type`
t`[Sticker: ${name}]`

// After
'[Image]'
'invalid message type'
`[Sticker: ${name}]`
```

The consuming app passes translated strings via props when needed. This follows the industry standard (shadcn/ui, Radix, MUI).

### 2c. Guard Browser APIs

If the file uses `window`, `document`, or `navigator`, add guards:
```typescript
if (typeof window !== 'undefined') {
  // browser-only code
}
```

Files that are inherently browser-only should NOT be migrated.

### 2d. Handle ESM-only Dependencies

Some npm packages (e.g., `unified`, `remark-*`, `devlop`) are ESM-only and break Metro/Hermes on React Native.

**Solution:** Create a `.native.ts` companion file with a regex-based or simplified implementation that has the same API but no ESM-only imports. See `quorum-shared/src/utils/markdownStripping.native.ts` as a reference.

### 2e. Handle Platform-Specific Files

For components with `.web.tsx` / `.native.tsx` splits:
- Copy both platform files to shared
- tsup config handles platform-specific entry points
- Ensure `.native.tsx` files don't import web-only packages (`react-tooltip`, etc.)

---

## Phase 3: Copy to quorum-shared

### 3a. Add Dependencies

If the migrated files need npm packages not yet in shared:

1. Check exact versions in `d:/GitHub/Quilibrium/quorum-desktop/package.json`
2. Add to `d:/GitHub/Quilibrium/quorum-shared/package.json` with matching versions
3. Run `yarn install` in quorum-shared
4. Verify build: `yarn build`

### 3b. Copy Files

Copy each prepared file to the appropriate location in shared:

| Code type | Destination in quorum-shared |
|---|---|
| Utility functions | `src/utils/<name>.ts` |
| React hooks | `src/hooks/<name>.ts` |
| Primitives / components | `src/primitives/<Name>/` |
| Types (wire types, cross-cutting) | `src/types/<name>.ts` |
| Service class (e.g., `TypingService`, `ReceiptService`, `SyncService`) | `src/<feature>/service.ts` + `src/<feature>/service.test.ts` + `src/<feature>/index.ts` (barrel) — mirror `src/sync/` layout |

**Service folder convention.** Shared groups services by feature, not by kind. Look at `src/sync/` as the canonical example: `service.ts`, `service.test.ts`, `types.ts` (or `utils.ts`), and an `index.ts` barrel that re-exports the public surface. Do NOT create `src/services/` or `src/tests/` — those are quorum-desktop's (Rails-style) layout and don't match shared's (library-style) convention. If the wire types are referenced by other modules in shared (e.g., `MessageService` consuming a `TypingMessage`), put the types in `src/types/<feature>.ts` so they're reachable without depending on the service folder.

### 3c. Handle Merge Conflicts with Existing Shared Code

If shared already has a simpler version of the same file (e.g., `validation.ts`, `mentions.ts`):

1. Compare both versions — desktop's is usually more complete
2. Replace shared's version with desktop's
3. Check if shared's version had any functions NOT in desktop's — append those to the new file
4. Rename any type/function that collides (e.g., `NotificationSettings` → `SpaceNotificationSettings`)

### 3d. Update Barrel Export

Add re-exports to the appropriate barrel file:

```typescript
// src/utils/index.ts
export * from './newModule';

// For default exports (like dayjs):
export { default as dayjs } from './dayjs';
```

### 3e. Verify Build

```bash
cd d:/GitHub/Quilibrium/quorum-shared
yarn build
```

Expected: 0 errors. All 3 outputs generated (index.mjs, index.js, index.native.js).

**Important:** shared's `yarn build` runs `tsc --project tsconfig.build.json`, which **includes test files in the type-check pass** (it emits `.d.ts` for everything under `src/**/*.ts`). So a passing `yarn test` is NOT enough — if your `*.test.ts` files have any TypeScript errors (common with vitest mock typings under `strict: true`), the build will fail even though tests run green. Run `yarn test --run src/<feature>/` AND `yarn build` separately. See "Known Gotchas" → "vitest mock type strictness in shared".

---

## Phase 4: Update quorum-desktop

### 4a. Update Imports

Find all files that import from the migrated local paths:

```bash
grep -r "from.*utils/<migrated-module>" d:/GitHub/Quilibrium/quorum-desktop/src/ --include="*.ts" --include="*.tsx" -l
```

Update each to import from `@quilibrium/quorum-shared`:

```typescript
// Before
import { validateEmail } from '../utils/validation';

// After
import { validateEmail } from '@quilibrium/quorum-shared';
```

### 4b. Handle Partial Migrations

If only some functions from a file were migrated (e.g., `channelUtils.ts`):
- Keep the local file with non-migrated functions
- Add a re-export for the migrated function: `export { findChannelByName } from '@quilibrium/quorum-shared'`
- Update consumers to import from the local barrel or shared directly

### 4c. Delete Local Source Files

Delete the migrated `.ts` files from desktop. Keep:
- SCSS files (styles stay in the consuming app)
- Test files (update their imports, don't delete tests)
- Files with non-migrated functions (partially migrated)

### 4d. Update Test Files

Test files that imported from local paths need updated imports:

```typescript
// Before
import { groupMessages } from '../../utils/messageGrouping';

// After
import { groupMessages } from '@quilibrium/quorum-shared';
```

---

## Phase 5: Verify Everything

Run these checks in order:

### 5a. quorum-shared build
```bash
cd d:/GitHub/Quilibrium/quorum-shared && yarn build
```

### 5b. quorum-desktop web build
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn build
```

### 5c. quorum-desktop dev server
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn dev
```
Verify the app loads in browser — check for blank pages (ESM import failures are silent).

### 5d. Mobile compatibility (if applicable)
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn mobile
```
Check Metro bundles without errors. If it fails, look for ESM-only packages (Phase 2d).

### 5e. Check for DOM API leaks
```bash
grep -r "window\.\|document\.\|navigator\." d:/GitHub/Quilibrium/quorum-shared/src/ --include="*.ts" --include="*.tsx" | grep -v "typeof window" | grep -v "typeof document" | grep -v ".native."
```

### 5f. Run tests
```bash
cd d:/GitHub/Quilibrium/quorum-desktop && yarn test
```
Compare results with previous run — no NEW failures should be introduced.

---

## Phase 6: Commit, Bump, Push, PR

**Both PRs are squash-merged in this repo.** That means individual commit messages on the branch collapse into the PR title/body — keep commits clean but don't over-optimize their ordering, since reviewers only see the squashed result.

**Commit-message rule:** do NOT use scopes like `chore(agents):` for `.agents/` folder changes — use `chore(docs):` or `docs:`. Forbidden terms (`agents`, `Claude`, `AI`, etc.) come from the global `commit-messages` memory profile.

### Sequence

1. **On quorum-shared branch:** commit the migration (source files, README, barrel updates). Then **bump `package.json` version** in a separate commit (e.g., `2.1.0-11` → `2.1.0-12`). Push, open PR.
   - Why the bump goes in the PR: the user cannot publish to npm manually; CI publishes on merge to master if the version is already bumped.
   - Stage files explicitly (`git add <file> <file>`), don't `git add .` — there may be unrelated dirty files in the working tree.
2. **On quorum-desktop branch:** commit the import updates + file deletions. Push, open PR. **Do NOT swap `link:../quorum-shared` to a version string** — this repo's convention is to keep `link:` in merged PRs. The published version is for downstream consumers (mobile), not desktop.
3. **Merge order: shared first, then desktop.** Once shared is merged and CI publishes the new version, desktop's `link:` keeps working (the published version is irrelevant to desktop's resolution).

### Per-repo commit content

**quorum-shared** — typically 2 commits on the branch:
- `feat(<feature>): add <Service> to quorum-shared` (or `feat(<area>):`) covering source + tests + barrel + README
- `chore: bump version to X.Y.Z-N`

**quorum-desktop** — typically 1 commit on the branch:
- `refactor(<feature>): consume <Service> from quorum-shared` covering import redirects + local file deletions + tracker update

If new shared npm dependencies were added, they go in their own commit on the shared side (so the diff is reviewable).

---

## Known Gotchas

These are lessons learned from prior migrations. Check each one:

| Gotcha | What Happened | Prevention |
|--------|--------------|------------|
| Silent ESM import failures | `ThreadListItem` imported a removed function — app showed blank page, no console errors | Always verify dev server loads after deleting local files |
| ESM-only packages on Metro | `unified` / `devlop` broke React Native bundling | Create `.native.ts` fallback with same API |
| Tailwind class scanning | Shared package's Tailwind classes weren't generated because `node_modules/` was excluded from content scan | Add `./node_modules/@quilibrium/quorum-shared/dist/**/*.mjs` to Tailwind `content` config |
| Type name collisions | `NotificationSettings` existed in both shared and desktop with different shapes | Rename one (shared became `SpaceNotificationSettings`) |
| `MAX_MESSAGE_LENGTH` divergence | Shared had 500, desktop had 2500 | Always use desktop's production values when replacing |
| dayjs plugin setup | Multiple files need the same dayjs plugin configuration | Create a shared `dayjs.ts` that both repos can use |
| ReactTooltip on native | `react-tooltip` uses `window.addEventListener` — crashes on React Native | Use `.web.tsx` suffix for web-only wrappers |
| vitest mock type strictness in shared | Tests using `vi.fn().mockResolvedValue(undefined)` assigned directly to a strictly-typed callback constructor option (e.g., `sendDM: (addr, msg) => Promise<void>`) produce `Type 'Mock<Procedure \| Constructable>' is not assignable to type '(...)' => ...'` errors. Tests pass, build fails. | Cast at the construction site: `sendDM: vi.fn().mockResolvedValue(undefined) as never`. Cleaner than annotating `vi.fn<typeof Fn>()` everywhere, scoped to the test-only assignment. |
| `@/` alias doesn't exist in shared | Desktop uses a `@/types/...` path alias via `tsconfig.json` `paths`. Shared has no such alias. Forgetting to rewrite imports during the copy step produces `Cannot find module '@/...'` errors. | Phase 2a handles this — search the copied file for `@/` before running `yarn build`. |
| Desktop typing references local file deleted in migration | After deleting `src/services/TypingService.ts` and `src/types/typing.ts`, some files may still import them. `npx tsc --noEmit` reports the misses, but `grep -r '@/types/<name>\|@/services/<Name>' src/` is faster as a pre-check. | Run the grep BEFORE building. The grep also catches relative-path importers (e.g. `from '../TypingService'`). |

---

## Before Merging PRs

For THIS repo (quorum-desktop + quorum-shared), the workflow is:

1. **Shared PR** has the version bump committed in-branch (Phase 6). Merge to `master` triggers CI publish.
2. **Desktop PR** keeps `link:../quorum-shared` in `package.json`. No swap.
3. **Two-account manual QA** before merging: dev server start, test golden path + edge cases of the migrated feature on both sides. Unit tests don't catch silent ESM resolution failures at runtime; the dev server does. The "Done criteria" in the per-PR task file typically lists the specific QA steps.
4. **Mobile bundle verification** is a separate consumer concern — happens when mobile pulls the new shared version, not as a blocker for these two PRs.

Documentation upkeep that goes in the desktop PR (not a separate one):

- Move the per-PR task file from `.agents/tasks/quorum-shared-migration/` to `.done/` (use `git mv` to preserve history).
- Update `.agents/tasks/quorum-shared-migration/README.md`: change the status table row to ✅ Done with the dated link, update "Next up", bump the footer.
- Update `quorum-shared/README.md` (in the shared PR): add an entry to the Package Structure tree and Modules section, bump the footer date.

---

*Last updated: 2026-05-20 — after typing migration. Added: services folder layout (mirror `src/sync/`), vitest mock type strictness gotcha, `@/` alias rewrite reminder, accurate commit/PR/version-bump workflow (squash-merge, version-in-PR, desktop keeps `link:`), `git mv` of done task files, README upkeep notes.*

*Previously: 2026-03-18 — initial skill.*
