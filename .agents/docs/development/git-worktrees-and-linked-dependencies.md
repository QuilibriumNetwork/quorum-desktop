# Git worktrees and linked dependencies

**Read this before trusting a `tsc` / test result from inside a `git worktree`.**

## The one-paragraph version

Two of this project's dependencies are **linked**, not installed from the
registry. A linked worktree gets its own `node_modules`, and those links do not
come along — whatever sits there when the worktree is created is frozen forever.
The result is a worktree compiling against a months-old build of a package whose
**version number never changed**, which surfaces as type errors that do not
reproduce on `main`. That reads as "my branch broke something" rather than "my
`node_modules` is stale", which is the expensive kind of wrong. Run
`yarn worktree:doctor` from inside any worktree to detect and repair it.

## The linked dependencies

| Package | Linked from |
|---|---|
| `@quilibrium/quorum-shared` | the sibling `quorum-shared` checkout |
| `@quilibrium/quilibrium-js-sdk-channels` | a `yarn link` target |

Because both are links, an edit to `quorum-shared/src` still needs
`yarn build` in that repo before the desktop app sees it — the link points at
the checkout, and the app imports `dist/`.

## The two failure modes

Both were observed in `.worktrees/secondary` on 2026-08-02:

**1. A stale physical copy.** The SDK was a real directory from January, while
the main worktree's link resolved to a July build. Both `package.json` files said
`"version": "2.1.1"` — the package had been republished under the same version,
so nothing in the version string revealed the drift. The stale `index.d.ts` was
2 KB shorter and missing three exported types, producing three `TS2305 has no
exported member` errors that were absent on a clean `main`.

**2. A link pointing at a path that no longer exists.** `quorum-shared` pointed
into a sibling worktree directory that had since been removed, so every import
from it failed to resolve.

> ⚠️ **Do not "fix" this with `ln -s` in Git Bash.** Creating a native symlink on
> Windows requires Developer Mode or elevation, and when it cannot, MSYS's `ln
> -s` **silently falls back to a recursive copy**. That is not a workaround —
> it manufactures failure mode 1. Use the doctor, which creates a directory
> junction (no privilege required, resolved identically by Node).

## The fix

```bash
# from inside the worktree
yarn worktree:doctor        # detect and repair
yarn worktree:check         # detect only; exits non-zero if broken
```

`scripts/worktree-doctor.mjs` reads the **main worktree's** link targets at
runtime and mirrors them into the current worktree as junctions. No machine
path is hardcoded, so it stays correct when those paths move and never writes a
user-profile path into a tracked file. It is idempotent — a healthy worktree is
left untouched, and running it from the main worktree is a no-op.

## When to run it

- Immediately after `git worktree add`.
- At the start of any session that resumes work in a long-lived worktree.
- Any time a worktree behaves differently from `main` for a reason the diff does
  not explain — especially "a type that obviously exists is not exported".

## Why the version number cannot be trusted

The usual instinct is to compare `package.json` versions across the two
`node_modules`. That did not work here and will not work next time: the SDK is
republished under the same version during development. Compare the **build
artifact** instead — file size or mtime of `dist/index.d.ts` — or just let the
doctor resolve both to a real path and compare those.

---
*Last updated: 2026-08-02*
