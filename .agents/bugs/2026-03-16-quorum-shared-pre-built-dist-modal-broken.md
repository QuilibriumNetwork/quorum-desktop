---
type: bug
title: "Modals break when consuming quorum-shared from pre-built dist (npm pack/publish)"
status: open
priority: high
ai_generated: true
created: 2026-03-16
updated: 2026-03-16
related_tasks:
  - ".agents/tasks/2026-03-15-primitives-migration-prep.md"
---

# Modals break when consuming quorum-shared from pre-built dist

> **AI-Generated**: May contain errors. Verify before use.

## Summary

Modals (createPortal-based) don't render when quorum-shared is installed from a tarball (`npm pack`) or would be installed from npm registry. Everything else works. This blocks publishing quorum-shared to npm.

## Symptoms

- Clicking buttons that should open modals has no effect
- No DOM elements are created for modals
- No errors in browser console
- All other primitives (Button, Select, Input, Icon, etc.) render correctly
- Theme, Flex, Text, Callout all work fine

## Works With

- `link:../quorum-shared` + `optimizeDeps.exclude` + react/react-dom Vite aliases
- This is source resolution mode — Vite processes `.web.tsx` files directly

## Broken With

- `file:../quorum-shared/quilibrium-quorum-shared-2.1.0-3.tgz` (tarball)
- Broken even WITH `optimizeDeps.exclude` + react aliases
- Broken even WITHOUT `optimizeDeps.exclude` (Vite pre-bundles from dist/)

## Root Cause (Suspected)

**Duplicate React instances** causing `createPortal` to render into a different React tree than the app's root.

The pre-built `dist/index.mjs` has `react` and `react-dom` properly externalized as bare imports:
```js
import { jsx } from "react/jsx-runtime";
import { createPortal } from "react-dom";
```

However, when the tarball is installed and Vite resolves these imports, it appears to resolve `react-dom` from a different location than the app's `react-dom`, creating two React instances. The `resolve.dedupe` and `resolve.alias` configs don't fix this for tarball installs.

**Why `link:` works but tarball doesn't:**
- `link:` creates a symlink — Vite processes source files as if they're part of the project, so the react aliases and extension resolution apply
- Tarball installs the package into `node_modules` as a separate copy — Vite's module resolution for the package's imports may bypass the app's aliases

## Tests Performed

| Configuration | Modals Work? |
|--------------|-------------|
| `link:` + `optimizeDeps.exclude` + react aliases | YES |
| `link:` + `optimizeDeps.exclude` (no react aliases) | NO |
| Tarball + `optimizeDeps.exclude` + react aliases | NO |
| Tarball + no exclude (Vite pre-bundles) | NO |
| Local primitives (before migration) | YES |

## Build Output Verification

The tsup build correctly externalizes all peer dependencies:
- `dist/index.mjs` (164 KB) — web ESM, react/react-dom as bare imports
- `dist/index.js` (174 KB) — web CJS
- `dist/index.native.js` (205 KB) — native CJS
- `dist/index.d.ts` — type declarations

```bash
# Verified:
grep "import.*from.*react" dist/index.mjs
# Shows: import { jsx } from "react/jsx-runtime"
# Shows: import { createPortal } from "react-dom"
# No inlined react code
```

## Investigation Needed

1. **Confirm duplicate React**: In the tarball test, add `console.log(React.version)` in both the app's main.tsx and inside a quorum-shared component. If versions or instances differ, that confirms duplication.

2. **Check Vite's resolution graph**: Run `vite --debug resolve` to see where Vite resolves `react-dom` for the tarball install vs the link install.

3. **Test with `react-dom` in tsup `noExternal`**: Force tsup to NOT externalize react-dom and instead bundle it — this would guarantee the same instance but increase bundle size.

4. **Test other bundlers**: Try webpack (via `yarn build` production build) instead of Vite dev server to see if the issue is Vite-specific.

5. **Check if `@tanstack/react-query` has the same issue**: It's also a peer dep that uses React hooks. If hooks work (useQuery etc.) but createPortal doesn't, the issue may be specifically about portal rendering rather than duplicate instances.

## Potential Solutions

### Option A: Force react resolution in tsup build
Add a `define` or `alias` in the tsup config that rewrites react imports to ensure they resolve from the consumer's node_modules.

### Option B: Ship source for web, pre-built for native only
- Metro (React Native) always uses source via `react-native` condition — already works
- Web consumers use source via a `development` condition or by pointing `import` to source
- This is what we do with `link:` and it works

### Option C: Document `optimizeDeps.exclude` as required + fix the tarball case
The `link:` setup works. The question is why tarball doesn't work with the same Vite config. Deep-dive into Vite's module resolution for tarball-installed packages.

### Option D: Move Portal/createPortal out of quorum-shared
Make Portal a peer component that the consuming app provides, similar to how we made UserAvatar injectable. The consuming app passes its own Portal implementation.

## Context for New Session

- Branch: `feat/shared-primitives-migration` on both `quorum-desktop` and `quorum-shared`
- Current working config: `link:../quorum-shared` in package.json
- quorum-shared has 4 clean commits on this branch
- quorum-desktop has ~15 commits for the migration
- The full migration is done and verified — only this npm publish issue remains
- Task file: `.agents/tasks/2026-03-15-primitives-migration-prep.md` (step 8)
- All primitives, theme, types, imports are working correctly in local dev

## Files Involved

| File | Role |
|------|------|
| `quorum-shared/src/primitives/Portal/Portal.web.tsx` | Uses `createPortal` from `react-dom` |
| `quorum-shared/src/primitives/Modal/ModalContainer/ModalContainer.web.tsx` | Uses `OverlayBackdrop` → `Portal` |
| `quorum-shared/src/primitives/OverlayBackdrop/OverlayBackdrop.web.tsx` | Wrapper using `Portal` |
| `quorum-shared/tsup.config.ts` | Dual platform build config |
| `quorum-shared/package.json` | exports with react-native condition |
| `quorum-desktop/web/vite.config.ts` | Vite aliases, optimizeDeps, resolve config |
| `quorum-desktop/package.json` | quorum-shared dependency reference |

---

_Created: 2026-03-16_
_Updated: 2026-03-16_
