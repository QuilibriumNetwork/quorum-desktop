---
name: update-shared
description: Update quorum-shared package — add icons, types, hooks, utils, or primitives. Use when changes are needed in @quilibrium/quorum-shared to support features in this repo.
argument-hint: "[what to add, e.g. 'add checks icon' or 'add ReadAckMessage type']"
---

# Updating @quilibrium/quorum-shared

This skill guides **small additions** to the `quorum-shared` package — a new icon, a new type, a new hook, a new util — typically to support a feature being built in `quorum-desktop`.

**For larger moves** — relocating existing code from desktop to shared, deleting the local source, updating consumer imports — use the `migrate-to-shared` skill instead. That workflow has six phases (analyze, prepare, copy, update desktop, verify, commit) and handles `@lingui` stripping, DOM-API guards, ESM/Metro fallbacks, and partial migrations.

**For tracking ongoing migrations,** see `.agents/tasks/quorum-shared-migration/README.md` in this repo — that's the master tracker for what's done, in progress, ready, and blocked.

## Locate the Shared Repo

The shared package is linked locally via `package.json`:

```json
"@quilibrium/quorum-shared": "link:../quorum-shared"
```

The conventional sibling path is `d:/GitHub/Quilibrium/quorum-shared` (Windows) or `/mnt/data/GitHub/Quilibrium/quorum-shared` (Fedora). If that path doesn't exist, ask the user where quorum-shared is located rather than trying to resolve via `node -e` (Windows quoting makes that brittle).

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
| Hooks | `src/hooks/` — shared React hooks (cross-platform-safe ones only; most hooks remain blocked on the hooks migration) |
| Utils | `src/utils/` — shared utility functions |
| API/transport | `src/api/`, `src/transport/` |
| Storage adapters | `src/storage/` — `StorageAdapter` interface and implementations |
| Crypto | `src/crypto/` — `WasmCryptoProvider` and crypto helpers |
| Signing | `src/signing/` |
| Sync protocol | `src/sync/` — `SyncService` (precedent for shared service classes) |
| Feature services (new convention) | `src/<feature>/` — e.g. `src/sync/`, planned `src/typing/`, planned `src/receipts/`. Each folder holds `service.ts`, `service.test.ts`, `index.ts` barrel. |

All public exports must be re-exported from `src/index.ts`.

### 3. Build

Both steps are required — tsup bundles the code, tsc generates type declarations. The shared package has a `build` script that runs both:

```bash
cd <shared-repo-path>
yarn build
```

(Equivalent to `tsup && tsc --project tsconfig.build.json` directly — see `quorum-shared/package.json`.)

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
5. In the consuming repo, import: `import { useMyHook } from '@quilibrium/quorum-shared'`

Important: most desktop hooks are NOT shareable yet — the hooks migration is blocked on mobile codebase access (see `.agents/tasks/quorum-shared-migration/designs/2026-03-19-hooks-design.md`). Only add a hook to shared if it has zero context dependencies (no `useMessageDB`, no `usePasskeysContext`, etc.) and zero DOM coupling.

### Adding a util

1. Create `src/utils/myUtil.ts` (or extend an existing file)
2. Export from `src/utils/index.ts`
3. Re-export from `src/index.ts`
4. Build
5. Import in desktop: `import { myUtil } from '@quilibrium/quorum-shared'`

If the util has its own test, co-locate it as `src/utils/myUtil.test.ts` (matching the existing `sync/service.test.ts` precedent). Don't put tests in `src/dev/tests/` — that's a desktop convention.

### Adding a service (feature folder)

For a service class with its own protocol logic (typing, receipts, future ones):

1. Create the feature folder: `src/<feature>/service.ts`, `src/<feature>/service.test.ts`, `src/<feature>/index.ts`
2. Service constructor takes all platform-specific pieces as callbacks (the SyncService pattern). No direct imports of DOM, storage, crypto, or React.
3. Re-export the service class and its options interface from the feature's `index.ts`
4. Re-export from `src/index.ts`
5. Build, run `yarn test:run` in shared to verify the colocated test passes

If you're migrating an existing desktop service (rather than building one fresh), use the `migrate-to-shared` skill — it covers the deletion step and consumer-import updates that this skill omits.

### Adding a colocated test

The shared package uses Vitest. Tests live alongside their source (`src/sync/service.test.ts`, `src/utils/myUtil.test.ts`). To verify:

```bash
cd <shared-repo-path>
yarn test:run
```

No separate test-imports list to maintain — Vitest picks up `*.test.ts` files automatically.
