---
name: update-shared
description: Update quorum-shared package — add icons, types, hooks, utils, or primitives. Use when changes are needed in @quilibrium/quorum-shared to support features in this repo.
argument-hint: "[what to add, e.g. 'add checks icon' or 'add ReadAckMessage type']"
---

# Updating @quilibrium/quorum-shared

This skill guides changes to the `quorum-shared` package, which provides shared primitives, types, hooks, and utilities consumed by this project (and quorum-mobile).

## Locate the Shared Repo

The shared package is linked locally via `package.json`:

```json
"@quilibrium/quorum-shared": "link:../quorum-shared"
```

Resolve the actual path:

```bash
node -e "const p = require('./package.json').dependencies['@quilibrium/quorum-shared']; console.log(require('path').resolve(p.replace('link:', '')))"
```

If the path doesn't exist, stop and ask the user where quorum-shared is located.

## Workflow

### 1. Branch

Create or switch to a feature branch in quorum-shared. Use generic names when batching related changes (e.g., `feat/dm-receipts-shared`), or specific names for one-off additions.

```bash
cd <shared-repo-path>
git checkout -b <branch-name>
```

### 2. Make Changes

The source lives in `src/`. Key locations:

| What to add | Where |
|---|---|
| Icons | `src/primitives/Icon/types.ts` (IconName union) + `src/primitives/Icon/iconMapping.ts` (icon map). Icons use [Tabler Icons](https://tabler.io/icons) — the map value is the Tabler component name (e.g., `checks: 'IconChecks'`). |
| Primitive components | `src/primitives/<ComponentName>/` — web (`.tsx`), native (`.native.tsx`), types, styles |
| Types | `src/types/` — shared TypeScript types |
| Hooks | `src/hooks/` — shared React hooks |
| Utils | `src/utils/` — shared utility functions |
| API/transport | `src/api/`, `src/transport/` |

All public exports must be re-exported from `src/index.ts`.

### 3. Build

Both steps are required — tsup bundles the code, tsc generates type declarations:

```bash
cd <shared-repo-path>
npx tsup && npx tsc --project tsconfig.build.json
```

This produces three bundles in `dist/`:
- `index.mjs` — ESM (web, consumed by Vite)
- `index.js` — CJS (web)
- `index.native.js` — CJS (React Native, consumed by Metro)

**Note:** `dist/` is gitignored — only commit source files.

### 4. Verify

Since this project uses `link:../quorum-shared`, the rebuilt `dist/` is picked up immediately — no install step needed. Verify in the consuming repo:

```bash
# Check the export exists in the built output
grep '<your-addition>' <shared-repo-path>/dist/index.mjs

# If Vite dev server is running, it should hot-reload automatically
```

### 5. Commit

In quorum-shared — commit source files only (dist is gitignored):

```bash
cd <shared-repo-path>
git add src/
git commit -m "feat: <describe what was added>"
```

Then in this repo — update the consuming code and commit:

```bash
cd <this-repo-path>
git add <changed-files>
git commit -m "feat: <describe how the shared addition is used>"
```

## Common Patterns

### Adding an icon

1. Find the Tabler icon name at https://tabler.io/icons
2. Add to `src/primitives/Icon/types.ts` — add `'icon-name'` to the `IconName` union in the appropriate category
3. Add to `src/primitives/Icon/iconMapping.ts` — add `'icon-name': 'IconTablerName'` to the map in the same category
4. Build, verify with `grep`, then use `<Icon name="icon-name">` in the consuming repo

### Moving types from local to shared

When a feature stabilizes and its types should be shared:

1. Copy the type definitions to `src/types/`
2. Re-export from `src/index.ts`
3. Build
4. Update imports in consuming repo from local path to `@quilibrium/quorum-shared`
5. Delete the local type file

### Adding a hook

1. Create `src/hooks/useMyHook.ts`
2. Export from `src/hooks/index.ts`
3. Re-export from `src/index.ts`
4. Build
