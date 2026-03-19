# Fix Modal CSS for Tarball/npm Install

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make modals visible when quorum-shared is installed from npm (tarball) instead of `link:`.

**Architecture:** The root cause is that Tailwind's content scanning excludes `node_modules/`, so arbitrary z-index classes like `z-[10100]` used in quorum-shared's pre-built dist are never generated. The fix adds quorum-shared's dist to Tailwind's content config. We also need to audit and revert/keep changes from the debugging session that were made under the wrong assumption (duplicate React).

**Tech Stack:** Tailwind CSS, Vite, tsup

---

## Confirmed Root Cause

`z-[10100]` is the default z-index for ModalContainer in quorum-shared. It's an arbitrary Tailwind value that only exists in `dist/index.mjs`. Tailwind's content config (`tailwind.config.js:12`) scans `./src/**` and excludes `node_modules/**`. So when quorum-shared is installed from a tarball (lives in `node_modules/`), Tailwind never sees `z-[10100]` and never generates the CSS rule. The modal overlay renders with `z-index: auto` and is invisible behind the main content.

**Evidence:**
- `document.querySelector('.fixed.inset-0')` → element exists with `z-[10100]` class
- `getComputedStyle(overlay).zIndex` → `"auto"` (Tailwind CSS rule missing)
- CSS check: `bg-overlay` ✓, `inset-0` ✓, `animate-modalOpen` ✓, `z-[10100]` ✗
- `z-[9999]` works because it's also used in app source files (`src/`)

## Changes From Debugging Session — Keep vs Revert

| Change | File | Keep? | Reason |
|--------|------|-------|--------|
| `UserConfig` return type | `web/vite.config.ts` | KEEP | Fixes VS Code overload error |
| `scss: { ... } as any` | `web/vite.config.ts` | KEEP | Fixes Vite 6.x type mismatch |
| React alias comment wording | `web/vite.config.ts` | KEEP | More accurate comment |
| Removed `// Deduplicate...` comment | `web/vite.config.ts` | KEEP | Minor cleanup |
| `"source"` in exports | `quorum-shared/package.json` | KEEP | Industry best practice (builder-bob pattern), useful for future consumers |
| Version bump to `2.1.0-4` | `quorum-shared/package.json` | KEEP | Was needed for Yarn cache |
| `file:...tgz` in deps | `quorum-desktop/package.json` | REVERT to `link:` | Testing-only, must be `link:` for dev |
| Debug code in `node_modules/` | `dist/index.mjs`, `src/index.ts`, `Portal.web.tsx` | REVERT | Diagnostic only, lives in node_modules so will be overwritten anyway |

---

## Chunk 1: Fix Tailwind Content Scanning

### Task 1: Add quorum-shared dist to Tailwind content

**Files:**
- Modify: `tailwind.config.js:12`

- [ ] **Step 1: Add quorum-shared dist to content array**

In `tailwind.config.js`, line 12, change:
```js
content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', '!./node_modules/**'],
```
to:
```js
content: [
  './index.html',
  './src/**/*.{js,jsx,ts,tsx}',
  './node_modules/@quilibrium/quorum-shared/dist/**/*.mjs',
],
```

Note: The `!./node_modules/**` exclusion is removed because Tailwind v3+ doesn't scan `node_modules` by default — the explicit exclusion was redundant. The new specific inclusion only scans quorum-shared's dist, not all of node_modules.

- [ ] **Step 2: Verify fix with tarball install**

1. Stop dev server
2. `Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue`
3. `yarn dev`
4. Open browser, try opening a modal
5. Run in console: `getComputedStyle(document.querySelector('.fixed.inset-0')).zIndex` — should return `"10100"`, not `"auto"`
6. Modal should be visually visible

- [ ] **Step 3: Also verify z-[9999] still works**

Run in console:
```js
[...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.cssText?.includes('9999')); } catch(e) { return false; } })
```
Should return `true`.

---

## Chunk 2: Revert Package.json to link: for Development

### Task 2: Switch back to link: protocol

**Files:**
- Modify: `quorum-desktop/package.json:52`

- [ ] **Step 1: Change dependency back to link:**

Change line 52 from:
```json
"@quilibrium/quorum-shared": "file:../quorum-shared/quilibrium-quorum-shared-2.1.0-4.tgz",
```
to:
```json
"@quilibrium/quorum-shared": "link:../quorum-shared",
```

- [ ] **Step 2: Reinstall**

```powershell
yarn install
```

- [ ] **Step 3: Verify link: still works with new Tailwind config**

1. `Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue`
2. `yarn dev`
3. Open modals — should work
4. Other primitives should work

---

## Chunk 3: Final Tarball Verification

### Task 3: Full end-to-end tarball test

- [ ] **Step 1: Rebuild tarball from quorum-shared**

```powershell
cd D:\GitHub\Quilibrium\quorum-shared
npm pack
```

- [ ] **Step 2: Temporarily switch to tarball**

In `quorum-desktop/package.json`, change to:
```json
"@quilibrium/quorum-shared": "file:../quorum-shared/quilibrium-quorum-shared-2.1.0-4.tgz",
```

- [ ] **Step 3: Clean install**

```powershell
cd D:\GitHub\Quilibrium\quorum-desktop
yarn remove -W @quilibrium/quorum-shared
yarn add -W "file:../quorum-shared/quilibrium-quorum-shared-2.1.0-4.tgz"
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
yarn dev
```

- [ ] **Step 4: Verify ALL of these work**

- [ ] Modals open and are visible
- [ ] Modal backdrop (dark overlay) appears
- [ ] Modal can be closed (escape key, backdrop click)
- [ ] Tooltips appear (also use Portal)
- [ ] Select dropdowns work (also use Portal)
- [ ] All other primitives (Button, Input, Flex, etc.) render
- [ ] Theme works
- [ ] No console errors

- [ ] **Step 5: Switch back to link: for development**

Change back to `"link:../quorum-shared"` and `yarn install`.

---

## Chunk 4: Commit and Update Documentation

### Task 4: Commit changes

- [ ] **Step 1: Commit Tailwind fix on quorum-desktop**

Stage and commit `tailwind.config.js` and `web/vite.config.ts` (type fixes only).

- [ ] **Step 2: Update bug report to resolved**

Change status to `resolved` in `.agents/bugs/2026-03-16-quorum-shared-pre-built-dist-modal-broken.md`.

- [ ] **Step 3: Update migration prep task**

Mark step 8 (npm pack test) as unblocked in `.agents/tasks/2026-03-15-primitives-migration-prep.md`.

---

_Created: 2026-03-16 15:15_
