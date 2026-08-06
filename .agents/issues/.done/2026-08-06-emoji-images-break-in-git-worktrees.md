---
type: bug
title: All emoji images break in a git worktree because one bad static-copy target drops every target
status: done
created: '2026-08-06'
updated: '2026-08-06'
---

# All emoji images break in a git worktree

## Symptom

Running `yarn dev` from a git worktree (`.worktrees/<name>/`), every emoji in
the app renders as a broken image: emojis in messages, in reactions, and the
emoji picker panel appears completely empty (the emoji buttons are still there
and still clickable, only the images are missing).

Works fine from the main checkout. Nothing to do with any application code.

## Status

**2026-08-06 — shipped in PR #316** (`fix(emoji): emojis land at the cursor, and one bad copy target no longer blanks every emoji image`)

What landed: each static-copy target now gets its own plugin instance so one
failure cannot cascade, and the SDK wasm target is registered only when a local
SDK checkout exists. The test harness no longer depends on the sibling path and
can boot in a worktree.

Root cause addressed rather than the trigger — see "First fix was wrong" below,
which a code review caught before this shipped.

Verified: emoji PNGs serve from a worktree dev server (200 image/png, was 200
text/html); clean-install simulation with neither SDK candidate present still
serves both the PNGs and the wasm; `yarn build` copies 3786 PNGs plus the wasm;
one harness scenario boots and passes where the old path gave ENOENT.

## Root cause

`web/vite.config.ts` had both copy targets in a single `viteStaticCopy()`:

```ts
{ src: 'node_modules/emoji-datasource-twitter/img/twitter/*', dest: 'twitter' },
{ src: '../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm', dest: './' },
```

The second is a **sibling-checkout** path, resolved against the vite `root`:

- from the main checkout → `<parent>/quilibrium-js-sdk-channels/...` — exists
- from a worktree → `<repo>/.worktrees/quilibrium-js-sdk-channels/...` — **does not exist**

`vite-plugin-static-copy` does not skip a target it cannot resolve. It fails the
whole collection, and **in dev it only logs that failure rather than throwing**:

```
[vite-plugin-static-copy] Error: No file was found to copy on ../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm src.
[vite-plugin-static-copy] No items found.
```

So the *emoji* target was dropped too, even though its 3786 PNGs were present
and correct in the worktree's `node_modules`. With nothing served under
`/twitter/*`, requests fell through to the SPA catch-all and every
`<img src="/twitter/64/….png">` received `index.html` instead of a PNG.

It stayed invisible in production because `channelwasm_bg.wasm` is also
committed in `public/`, so the failing target had no user-visible effect of its
own — it only ever manifested as a side effect on the *other* target.

## First fix was wrong (caught in review)

The initial fix just repointed the SDK target at
`node_modules/@quilibrium/quilibrium-js-sdk-channels/src/wasm/…`, on the
assumption that node_modules resolution is environment-independent. It is not.

Measured: `npm view @quilibrium/quilibrium-js-sdk-channels@2.1.0-2 dist.tarball`,
downloaded and listed — the published package contains only `LICENSE`, `dist/`
and `package.json`. **No `src/`, no `.wasm` anywhere.** That path resolves on
this machine solely because `node_modules/@quilibrium/quilibrium-js-sdk-channels`
is a symlink to a local sibling checkout (`fs.lstatSync(...).isSymbolicLink()`
=== true in both the main checkout and the worktree), maintained by
`yarn worktree:doctor` — which is not wired into `postinstall`/`predev`.

So that fix would have resolved to nothing on any genuine clean install and,
per the cascade above, silently taken the emoji PNGs down with it — reproducing
the very bug it was meant to fix. "Verified byte-identical in both trees" was
true and irrelevant: both trees are on the same machine behind the same symlink.

## Fix

Two changes, addressing the mechanism rather than the one bad path:

1. **Each target gets its own `viteStaticCopy()` instance**, so a failure in one
   can never cascade into another. This is the actual root cause and was still
   fully present after the first fix, just relocated.
2. **The SDK wasm target is only registered when a local SDK checkout exists**
   (`findLocalSdkWasm()` probes the yarn-link path, then the sibling path, with
   `existsSync`). It is a developer convenience for people hacking on the SDK.
   When neither exists, no target is registered, and the committed
   `public/channelwasm_bg.wasm` is what ships — served and bundled by
   `publicDir` with no plugin involved.

`src/dev/tests/harness/setup.harness.ts` carried the same fragile sibling path
and a comment describing the old convention. It now probes the same candidate
list, falls back to `public/channelwasm_bg.wasm`, and throws with the list of
attempted paths if none resolve (it previously would have failed inside
`readFileSync` with no context).

## Verification (measured)

Same URL, four dev servers, `curl -w`:

| Server | `/twitter/64/1f600.png` |
|---|---|
| main checkout, old config | 200 `image/png` 2002 b |
| worktree, old config | 200 `text/html` 1218 b (SPA fallback) |
| worktree, new config | 200 `image/png` 2002 b |
| worktree, new config, **clean-install simulated** | 200 `image/png` 2002 b |

The last row is the important one: both SDK candidates were temporarily pointed
at non-existent paths to simulate a fresh `yarn install` with no local SDK. The
emoji PNGs still served, `/channelwasm_bg.wasm` still served from `public/`
(954665 b `application/wasm`), and the plugin logged `Collected 5 items` with no
error. That is the exact scenario the first fix would have broken.

- `yarn build` exit 0, `Copied 6 items`, `dist/web/twitter/64` = 3786 files,
  `dist/web/channelwasm_bg.wasm` = 954665 bytes

## Ruled out

- Missing package in the worktree's `node_modules` — present, 3786 PNGs, same as main
- `vite-plugin-static-copy` missing or a different version — 3.4.0 in both
- Junctions defeating the glob — no reparse points on the emoji path

## Follow-up worth considering

`yarn worktree:doctor` would not have caught this: nothing was wrong with
`node_modules`: the breakage was a config path that happens to be
worktree-hostile. A doctor check that fetches `/twitter/64/1f600.png` and
asserts a PNG content-type would catch this whole class directly, and wiring the
doctor into `predev` would stop a fresh worktree from starting in a broken state
at all. Not done here.
