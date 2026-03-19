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
   If not, set it and run `yarn install`.

2. **Confirm both repos are on the correct branch** — if using stacked PRs, the migration branch should be based on the latest shared branch. Check with the user which branch to use.

3. **Confirm quorum-shared builds cleanly** before making changes:
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
| `import { logger } from '@quilibrium/quorum-shared'` | `import { logger } from './logger'` |
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
| Types | `src/types/<name>.ts` |

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

## Phase 6: Commit

### On quorum-shared

Commit in this order:
1. **Dependencies** (if any new ones): `package.json` + `yarn.lock`
2. **Source files**: All new/modified files under `src/`
3. **Fixes** (if any arose during verification): Separate commits

### On quorum-desktop

Commit in this order:
1. **Import updates + file deletions**: One atomic commit
2. **Test import updates**: Separate commit if significant

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

---

## Before Merging PRs

These steps must happen before any migration PR is merged:

1. Switch `link:../quorum-shared` back to the published npm version in `package.json`
2. Publish `@quilibrium/quorum-shared` with a version bump
3. Run full build + smoke test with the published version
4. Verify mobile bundles with the published version

---

*Last updated: 2026-03-18*
