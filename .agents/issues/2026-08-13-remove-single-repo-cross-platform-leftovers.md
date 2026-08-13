---
type: task
title: Remove the single-repo cross-platform leftovers from quorum-desktop
status: done
priority: medium
created: 2026-08-13
updated: 2026-08-13
---

# Remove the single-repo cross-platform leftovers

## Context

Until early 2026 the plan was to build the mobile app **inside `quorum-desktop`**, as
one cross-platform repo: an in-repo Expo playground (`mobile/`), `.native.tsx`
siblings next to every `.web.tsx`, React Native type shims, platform-detection
utilities, and a component audit tracking which components had been "ported to
native" yet.

**That approach was abandoned.** The architecture is now multi-repo:

| Repo | Builds |
|------|--------|
| `quorum-desktop` (this one) | web + Electron, nothing else |
| `quorum-mobile` | React Native + Expo, its own `android/`, `eas.json`, `app/` |
| `quorum-shared` | npm package: types, hooks, sync protocol, UI primitives |

The docs were reconciled with that reality in June 2026, but **the code and build
config never were**. Several docs even carry a banner promising this cleanup:

> *"This guide stays only until the stale `mobile/` playground + `mobile:*` scripts
> are removed from this repo (tracked as a follow-up code/config cleanup)."*
> — [`docs/.archived/expo-dev-testing-guide.md`](../docs/.archived/expo-dev-testing-guide.md)

It was never actually filed. This issue is that follow-up.

`quorum-shared` is **not** in scope — it is a live dependency
(`"@quilibrium/quorum-shared": "link:../quorum-shared"`) and the primitives it
exports are genuinely cross-platform. Only the *in-repo mobile app* scaffolding goes.

---

## Evidence that this is all dead

- **Nothing resolves a `.native` file.** Every folder barrel hardcodes the web
  implementation — `src/components/user/UserAvatar/index.ts` is literally
  `export { UserAvatar } from './UserAvatar.web';`. The Vite `resolve.extensions`
  array prefers `.web.*`, and there is no Metro bundler in this repo to prefer
  `.native.*`. The only importer of a `.native` file outside `mobile/` is another
  `.native` file.
- **They are not type-checked.** `tsconfig.json` has
  `"exclude": [..., "src/**/*.native.tsx", "src/**/*.native.ts"]`, so 30 files have
  been drifting with zero compiler coverage for months.
- **The `mobile/` workspace is abandoned.** Last commit touching it: `908774023`
  (2026-03-24, a dependency-cleanup sweep). Two commits in six months, neither
  feature work. It imports `@/components/primitives`, which is now only a SCSS shim
  re-exporting `quorum-shared` — so the playground almost certainly does not even boot.
- **It still costs on every install.** `mobile/` is a declared yarn workspace and
  occupies ~394 MB on disk with its own `node_modules` (Expo 53, RN 0.79, a second
  React 19 copy).
- **It is a version-drift trap.** `mobile/package.json` pins Expo ~53 / RN 0.79 while
  the real `quorum-mobile` is on Expo SDK 54 / RN 0.81.5. Anyone reading this repo for
  mobile guidance gets stale answers.

---

## Inventory

### A. The `mobile/` Expo playground — **delete, but salvage the test screens first**

50 tracked files, ~8,900 LOC, ~394 MB installed. Expo app shell (`App.tsx`,
`app.json`, `babel.config.js`, `metro.config.js`, `__empty.js` Metro shim), an
`assets/` icon set, and 24 primitive/business test screens under `mobile/test/`.

**This is the one part with genuine surviving value — see [Findings](#findings-the-visual-primitives-playground) below.**
The 22 pure-primitive screens (~7,500 LOC with the two dead ones excluded) are the
only place `quorum-shared`'s 19 `.native.tsx` primitives can be rendered anywhere in
the ecosystem. The surrounding Expo/Metro scaffolding is what goes; the screens
themselves should be relocated, not lost.

### B. Root `package.json` — **strip**

- `"workspaces": ["mobile"]`
- 6 `mobile:*` scripts (`mobile`, `mobile:clear`, `mobile:tunnel`, `mobile:connect`,
  `mobile:android`, `mobile:ios`, `mobile:web`)

`yarn.lock` will shrink substantially; regenerate it rather than hand-editing.

### C. `.native.*` source files — **delete** (30 files, ~3,400 LOC)

```
src/components/Router/Router.native.tsx
src/components/message/MessageComposer.native.tsx
src/components/message/MessageTextInput.native.tsx
src/components/message/TypingIndicator.native.tsx
src/components/modals/ConfirmationModal.native.tsx
src/components/space/IconPicker/IconPicker.native.styles.ts
src/components/space/IconPicker/IconPicker.native.tsx
src/components/space/SpaceAvatar/SpaceAvatar.native.tsx
src/components/ui/ClickToCopyContent.native.tsx
src/components/user/UserAvatar/UserAvatar.native.tsx
src/components/user/UserInitials/UserInitials.native.tsx
src/hooks/business/search/useGlobalSearchNavigation.native.ts
src/hooks/business/search/useKeyboardShortcuts.native.ts
src/hooks/business/search/useSearchResultsOutsideClick.native.ts
src/hooks/business/search/useSearchResultsResponsive.native.ts
src/hooks/business/ui/useTooltipInteraction.native.ts
src/hooks/business/user/useFileUpload.native.ts
src/hooks/business/user/useNotificationSettings.native.ts
src/hooks/platform/clipboard/useClipboard.native.ts
src/hooks/platform/files/useFileDownload.native.ts
src/hooks/platform/interactions/useNavigationHotkeys.native.ts
src/hooks/platform/user/usePasskeyAdapter.native.ts
src/hooks/useResponsiveLayout.native.ts
src/hooks/useSearchContext.native.ts
src/i18n/i18n.native.ts
src/shims/quilibrium-sdk-channels.native.tsx   (→ leaves src/shims/ empty; remove the dir)
src/types/react-native-augmentation.d.ts
src/types/react-native.d.ts
src/utils/crypto.native.ts
src/utils/platform.native.ts
```

> **Check before deleting**, do not assume: `MessageComposer.native.tsx` and
> `IconPicker.native.tsx` are the most elaborate of these and may contain layout or
> UX decisions `quorum-mobile` has not yet reproduced. Cheap insurance: they stay in
> git history, and the pre-removal commit SHA is recorded in the Status section below
> so a mobile dev can `git show` any of them.

### D. `.web.*` suffixes — **collapse** (10 files)

With no native sibling, the suffix and its one-line barrel are pure ceremony:

```
Router.web.tsx  IconPicker.web.tsx  SpaceAvatar.web.tsx  UserAvatar.web.tsx
UserInitials.web.tsx  useTooltipInteraction.web.ts  useClipboard.web.ts
useFileDownload.web.ts  usePasskeyAdapter.web.ts  crypto.web.ts
```

Rename each to the plain name and drop the re-export barrel. `src/utils/crypto.ts`
and `src/hooks/platform/clipboard/useClipboard.ts` are *only* forwarding shims and
should be absorbed. Once none are left, delete the `resolve.extensions` block in
[`web/vite.config.ts`](../../web/vite.config.ts) that prioritises `.web.*` over `.native.*`.

**Phase this separately from C.** It is a rename-heavy diff with no behavioural
content, and mixing it into the deletion commit makes both unreviewable.

### E. Platform detection — **narrow**

[`src/utils/platform.ts`](../../src/utils/platform.ts) exports `isMobile()`,
`isNative()` and a `getPlatform(): 'web' | 'mobile' | 'electron'` that can never
return `'mobile'` — it tests `navigator.product === 'ReactNative'`, which is
unreachable in a browser or Electron build. No caller uses them; the only live
consumers are `isWeb()` and `isElectron()`.

Separately, [`src/utils/deviceInfo.ts`](../../src/utils/deviceInfo.ts) carries its
**own private duplicate** `isElectron()` (line 6) plus an `isMobileApp()` (line 11)
that means "mobile *browser*", not React Native. Worth deduplicating in the same
pass, but note the two `isElectron()` bodies may not be identical — diff them first.

### F. Build / lint config — **strip**

- [`tsconfig.json`](../../tsconfig.json): drop the two `src/**/*.native.*` excludes.
- [`eslint.config.js`](../../eslint.config.js): drop 7 `mobile/**` ignore entries and
  the `mobile/__empty.js` Metro-shim override block.
- [`.gitignore`](../../.gitignore): drop the "React Native / Expo" block
  (`mobile/.expo/`, `mobile/node_modules/`, `mobile/.expo-shared/`,
  `mobile/expo-env.d.ts`), the Metro cache entry, and the RN-debugger entry.

### G. Dev tooling — **decide**

[`src/dev/components-audit/`](../../src/dev/components-audit/) (~7,200 LOC across
`audit.json`, two dated backups, a 1,400-line viewer, and `update_audit.py`) tracks
per-component `"native": "todo" | "done" | "not_needed"` and a
`shared / platform_specific / complex` categorisation. That taxonomy exists to answer
"what still needs porting to native in this repo" — a question this repo no longer
asks. `audit.json` was last updated 2026-03-24.

The `shared` vs `platform_specific` axis is arguably still useful for
quorum-shared migration triage, so this is a judgement call, not an obvious delete.
The project-local `audit-update` skill depends on it.

### H. Docs — **archive or de-bannerise**

Already carrying accurate deprecation banners; move to `.archived/` once the code
they describe is gone:

- [`docs/.archived/expo-dev-testing-guide.md`](../docs/.archived/expo-dev-testing-guide.md)
- [`docs/.archived/android-build-workflow.md`](../docs/.archived/android-build-workflow.md)

Keep, but drop the now-redundant banner and the dead `yarn mobile` references:

- [`docs/cross-platform-components-guide.md`](../docs/cross-platform-components-guide.md) — philosophy still valid
- [`docs/component-management-guide.md`](../docs/component-management-guide.md) — **its banner is currently wrong**: it claims "There is no `mobile/` workspace and no `yarn mobile` script in this repo anymore." Both still exist. This issue makes the banner true; then delete it.
- [`docs/features/cross-platform-theming.md`](../docs/features/cross-platform-theming.md)
- [`docs/features/primitives/04-web-to-native-migration.md`](../docs/features/primitives/04-web-to-native-migration.md) — belongs with the primitives, i.e. arguably in `quorum-shared`

### I. Project skills — **review**

`.claude/skills/primitives/templates/new-primitive-template.tsx` still emits a
`react-native` import. `mobile-check`, `migrate-to-shared` and `update-shared` are
all still valid (they target the *sibling* repos, which is the current architecture)
and stay.

---

## Findings: the visual primitives playground

Investigated 2026-08-13, because "we kept the mobile config so we could still see how
the primitives look on mobile" is the one real argument for keeping any of this.

**What the screens actually are.** 24 screens, ~7,500 LOC. 22 of them import only
`@/components/primitives`, which resolves to `../src/components/primitives/index.ts`
— the barrel that re-exports `@quilibrium/quorum-shared`. So they are, in substance, a
**quorum-shared native primitives showcase** that happens to live in quorum-desktop.
The other 2 (`IconPickerTestScreen`, `MessageComposerTestScreen`) import
`quorum-desktop`'s own `.native.tsx` components and die with §C.

**The value is real and unduplicated.**
- `quorum-shared` ships **19 `.native.tsx` primitives** (`src/primitives/*/`.native.tsx`)
  and is a pure library — no example app, no Storybook, no preview surface of any kind.
- `quorum-mobile` **does not consume shared UI primitives at all**. Its own
  [2026-06-28 analysis](../../../quorum-mobile/.agents/reports/2026-06-28-shared-primitives-on-mobile-analysis.md)
  verified it imports only data/logic from shared (`logger`, types, hooks, validators)
  and renders through its own mature `components/ui/` + `components/shared/` layer with
  a local skin system.

So these 22 screens are the only rendering surface those 19 primitives have.

**But it does not work.** *(MEASURED, 2026-08-13 — `expo export --platform android`
from `mobile/`, watchman disabled to get past an unrelated hang on the oversized watch tree)*

```
Android Bundling failed 13971ms mobile\index.ts (1254 modules)
Error: Unable to resolve module expo-image from
  quorum-desktop/src/components/message/MessageComposer.native.tsx
  expo-image could not be found within the project or in these directories:
    ..\node_modules
```

`metro.config.js` sets `nodeModulesPaths: [monorepoRoot/node_modules]` only, so
mobile-declared-but-unhoisted deps are unreachable. The playground has not been
runnable for some time, which matches "to be honest, we never do that". Whatever we
decide, **nobody is losing a working tool** — it is already broken.

**And what it previews is on a path to being replaced.** The same 2026-06-28 analysis
records the decided direction: mobile's existing UI components should eventually be
*promoted into* `quorum-shared` as the `.native.tsx` half of each primitive, skins and
all. If that lands, most of today's 19 shared native primitives are superseded, and a
showcase built for them ages out with them.

**Recommendation.** Do not defer the cleanup on account of the playground, and do not
silently bin the screens either. `quorum-mobile` already has an approved, fully
designed, still-open task for exactly this surface —
[`.open/2026-06-13-mobile-dev-playground-design.md`](../../../quorum-mobile/.agents/issues/.open/2026-06-13-mobile-dev-playground-design.md)
— a `__DEV__`-gated expo-router `(dev)` route, one demo file per primitive. Its "Notes
for the executor" already cites this repo as structural reference. The 22 screens are
ready-made source material for that task, in a repo where the RN build actually works.

Cheapest correct move: copy `mobile/test/` + `mobile/styles/commonTestStyles.ts` into
`quorum-mobile` as reference material for that open task, link it from there, then
delete `mobile/` here. Rebuilding a showcase from scratch later costs far more than
carrying 7,500 lines of reference across a repo boundary now.

## Verdict on `.agents/issues/mobile-dev/`

**Resolved 2026-08-13: two files rescued, the folder archived.**

The first pass here recommended leaving the folder alone on the grounds that it was
already audited (2026-06-12) and cost nothing. That was wrong on the second point. It
was contributing **19 entries to `INDEX.md`, every one tagged `📋` as an open task**,
interleaved with real work. "Costs nothing" ignored the only cost it actually had.

Re-examined per file. The 2026-06-12 audit had itself gone stale, and two of the five
"kept as reference" files turned out not to be about mobile at all:

| File | Verdict |
|---|---|
| `2026-01-09-mobile-touch-transition-plan.md` | **Promoted** → [`docs/mobile-browser-touch-support.md`](../docs/mobile-browser-touch-support.md). Documents live desktop code — `MessageActionsDrawer` (376 refs in `src/`), `EmojiPickerDrawer` (117), `MobileDrawer` (87) — serving phones on the *web app*, nothing to do with React Native. It is the only doc those components have. Archiving it would have buried a live subsystem behind a misleading folder name. |
| `2025-08-01-business-logic-extraction-plan.md` | **Split.** The plan is finished (every box ticked). Its Lessons-Learned half — extraction patterns, common pitfalls, hook sharing, when *not* to extract — governs `src/hooks/business/`, which the whole app uses, and was promoted to [`docs/business-logic-extraction-patterns.md`](../docs/business-logic-extraction-patterns.md). Its `.native.tsx` platform-split section was dropped as now-misleading. The plan itself is archived. |
| `2025-08-08-mobile-sdk-integration-issue.md` | **Archived.** Solved in `quorum-mobile` by other means (native UniFFI module, no WASM SDK). |
| `2026-01-09-components-shared-arch-masterplan.md` | **Archived.** Cross-platform theming and modal-to-drawer-for-native; overlaps [`cross-platform-components-guide.md`](../docs/cross-platform-components-guide.md), which is live and now correctly bannered. |
| `docs/component-architecture-workflow-explained.md` | **Archived.** The primitives/business/app decision framework it explains is covered by the live [`component-management-guide.md`](../docs/component-management-guide.md). The two nav docs that pointed here (`agents-workflow.md`, `docs/features/primitives/INDEX.md`) were repointed there. |

The folder then moved wholesale to `issues/.archived/mobile-dev/` (18 files). Its
README now records where the two rescued files went and why nothing was copied out.

**Nothing went to `quorum-mobile`.** All three candidates failed on inspection: the
SDK blocker is solved there differently, the touch plan is a desktop doc, and the
architecture explainer describes a model that repo does not use — it renders through
its own `components/ui/` with a local skin system and consumes zero shared UI
primitives.

> **Two of the README's own claims did not survive checking (2026-08-13).** It was
> written 2026-06-12 and the world moved. Verify before acting on it:
>
> - **The Passkey-SDK / WASM blocker is resolved, not "still unresolved".**
>   `2025-08-08-mobile-sdk-integration-issue.md` describes the Quilibrium WASM SDK
>   being unusable under React Native. `quorum-mobile` solved this by going around
>   it entirely: it ships a native Expo module, `modules/quorum-crypto/`, with UniFFI
>   Rust bindings (`libchannel.so` per ABI, `Channel.xcframework`,
>   `QuorumCryptoModule.kt`, `channel.swift`) and carries **no dependency on
>   `@quilibrium/quilibrium-js-sdk-channels` at all**. Copying this doc there would
>   import a solved problem, described in terms of an approach they abandoned.
> - **`2026-01-09-mobile-touch-transition-plan.md` is a quorum-desktop doc, not a
>   mobile one.** It audits *this* repo's mobile-**browser** touch UX (`MobileDrawer`,
>   `MessageActionsDrawer`, `EmojiPickerDrawer`) and concludes they are KEPT and
>   correct, because desktop-browser-on-a-phone is a real supported case here. Only
>   its short closing "Template Usage Strategy" section faces mobile. It belongs here.
>
> `docs/component-architecture-workflow-explained.md` is the one plausible copy
> candidate, but it explains the primitives/business/app three-layer model — which is
> **not** how `quorum-mobile` is built (own `components/ui/` + `components/shared/`,
> local `useTheme()`, skin system, no shared primitives). It would arrive as a
> description of an architecture they do not use. Leave it.

The README's frontmatter `status` is now `archived`, which is what it should have been all along — as `in-progress` it was surfacing in active-work views.
which is wrong for a historical-reference folder — it should be `archived`. That
status also makes it surface in active-work views it does not belong in.

---

## Plan

All shipped on branch `chore/remove-single-repo-native-leftovers`, one commit per
phase. Evidence for each is in [Status](#status).

- [x] **Phase 0 — salvage the primitives showcase.** *Changed from the original plan.*
      Copying into `quorum-mobile` was judged premature: that repo is not ready to
      build the playground, and it may never adopt more than a few of the shared
      primitives. Instead the whole tracked `mobile/` tree (50 files) **and** all 30
      `.native` files were copied to a cold archive outside any repo, at
      `Quilibrium/_archive/quorum-desktop-cross-platform-2026-08-13/`, with a README
      covering what the screens rendered, the measured build failure and its two
      causes, and how to port a screen into `quorum-mobile`'s planned `(dev)` route.
      80 files, 562 KB. Git history was explicitly rejected as the only copy.
- [x] **Phase 1 — the workspace** (`57a36e50a`). Deleted `mobile/`; dropped
      `workspaces` and the 7 `mobile:*` scripts; regenerated `yarn.lock`
      (11208 → 7805 lines); stripped the `mobile/**` entries from `eslint.config.js`
      and the React Native / Expo block from `.gitignore`. ~394 MB of installed Expo
      and RN dependencies reclaimed. No RN package was declared in the root manifest,
      so there was nothing else to uninstall.
- [x] **Phase 2 — the native sources** (`cb6812b30`). Deleted the 30 files in §C,
      removed the `.native.*` excludes from `tsconfig.json`, dropped the emptied
      `src/shims/`. Also removed `SpaceAvatar/`, which turned out to be dead — see
      Status.
- [x] **Phase 3 — narrow platform detection** (`d89006676`). Removed `isMobile()`,
      `isNative()`, `getPlatform()`, `platformFeatures` and the two dead
      mobile-browser scroll helpers, plus the same dead RN check in `deviceInfo.ts`.
      **`isElectron()` was deliberately NOT deduplicated** — the two copies test
      different signals. See §E.
- [x] **Phase 4 — collapse the `.web.*` suffixes** (`361cb2b77`). 9 files renamed
      (10 minus SpaceAvatar), 4 barrels repointed, 4 forwarding shims absorbed,
      `resolve.extensions` dropped from `web/vite.config.ts`. Surfaced a latent
      crypto hazard — see Status.
- [x] **Phase 5 — build output** (`9ec810169`). *Added mid-flight at the lead's
      request, not in the original plan.* `outDir` moved from `dist/web` to `dist`,
      with the two Electron paths and the deploy skill updated to match.
- [x] **Phase 6 — docs + `.agents` hygiene.** Archived the two deprecated guides,
      corrected the banners on the four kept ones (one of which was actively wrong),
      fixed the `mobile-dev` README's status and its two stale claims, rebuilt
      `INDEX.md`. Nothing copied to `quorum-mobile` — see the verdict section above.
- [ ] **`components-audit`: left alone.** Decided 2026-08-13: out of scope. It is
      dev-only code that never reaches a production bundle, so it costs nothing but
      repo weight. Revisit separately.

## Risks

- **`yarn.lock` churn is the loudest part of Phase 1** and will look alarming in a
  diff. It is expected: an entire Expo/RN dependency tree leaves the lockfile.
  Regenerate it with `yarn install`, never by hand.
- **Deleting untyped code is safer than it looks here, but not free.** The `.native`
  files were excluded from `tsc`, so the compiler cannot tell us whether something
  still references them. The barrel audit above is the real evidence: every barrel
  names `.web` explicitly.
- **Phase 4 renames can silently break SCSS imports.** `IconPicker.scss` sits beside
  `IconPicker.web.tsx`; check relative style imports after each rename rather than
  at the end.
- **Do not touch `quorum-shared`.** Its primitives are legitimately cross-platform
  and `quorum-mobile` consumes them.

## Status

Branch: `chore/remove-single-repo-native-leftovers`.

Issue filed 2026-08-13 after confirming no existing issue covered this — the
deprecation banners in `expo-dev-testing-guide.md` and `android-build-workflow.md`
promised a "follow-up code/config cleanup" that was never actually tracked.

**Complete.** All six phases shipped on `chore/remove-single-repo-native-leftovers`,
one commit each, each verified before the next started.

### Baseline and per-phase verification

Baseline before any deletion: `tsc` exit 0, eslint 0 errors / 276 warnings, build
succeeds, 1440 tests pass. Every phase was re-verified against that. Final state:
`tsc` exit 0, eslint **0 errors / 231 warnings** (45 fewer, all from deleted files),
build succeeds, **1440 tests pass**.

### Three things the work surfaced that the plan did not predict

**`SpaceAvatar` was dead code.** Removing the RN type shim broke the build on
`SpaceAvatar.types.ts`, which imported `ViewStyle` from `react-native`. Tracing it
showed nothing outside its own folder ever imported the component — `SpaceIcon.tsx`
uses `UserInitials` directly. The whole folder went; its web half is archived beside
its native sibling.

**`crypto.ts` and `crypto.web.ts` were duplicates, and the wrong one was shipping.**
Byte-identical named exports (`decryptUserConfig`, the hex helpers, the multiformats
re-exports), but because `resolve.extensions` put `.web.ts` ahead of `.ts`, **Vite
bundled `crypto.web.ts` while TypeScript only ever checked `crypto.ts`**. They had not
drifted, and nothing used the twin's extra default export — but a careless edit to
either would have produced a divergence no typecheck could catch, in the file that
decrypts user config. Phase 4 collapsed them to one.

**A deferred security finding was resolved by deletion.** The raw-name audit carried
an exception for `MessageComposer.native.tsx`, which rendered an unguarded member name
into its "Replying to {user}" label. It was ruled not-live on 2026-08-11 precisely
because the workspace that would bundle it was obsolete, and the entry said in as many
words that it existed only until the `.native` files were deleted. They are, so it is
gone rather than carried forward.

### Evidence for the claims that mattered

- **MEASURED** — the `mobile/` playground did not build. `expo export --platform
  android` failed at 1254 modules on an unresolvable `expo-image`
  (`nodeModulesPaths` pointed only at the repo root, so mobile's own unhoisted deps
  were invisible). Getting that far needed `resolver.useWatchman = false` to clear a
  watchman stall on the oversized watch tree; that edit was reverted and the file was
  confirmed clean before deletion.
- **MEASURED** — the renamed components' SCSS survived Phase 4. The `icon-picker-*`
  and `user-initials*` selectors are present in the built `index-*.css`, and absent
  from the other CSS chunk, so the check could have failed.
- **MEASURED** — Electron loads the new flat `dist/`. Launched in production mode: it
  ran its preload and executed renderer scripts with no load errors. **Control arm:**
  the same launch pointed at a nonexistent `index.html` logged
  `ERR_FILE_NOT_FOUND`, so the clean run is evidence rather than silence.
  (Note for whoever repeats this: the harness shell exports
  `ELECTRON_RUN_AS_NODE=1`, which makes `electron.exe` behave as plain Node and
  crash on `ipcMain` at module load. Unset it first; that failure is not the app's.)
- **MEASURED** — the audit's stale-exception guard is real. It failed twice during
  this work, once on the deleted `.native` paths and once on the Phase 4 renames,
  and had to be corrected each time.
- **READ** — every folder barrel named `.web` explicitly, so no `.native` file was
  reachable from the web or Electron build.
- **READ** — `quorum-shared` ships 19 `.native.tsx` primitives and has no preview
  surface; `quorum-mobile` consumes none of them.
- **READ** — the mobile-dev README's "still unresolved" WASM blocker is resolved in
  `quorum-mobile` via a native UniFFI module (`modules/quorum-crypto/`).

### Not done, deliberately

- `src/dev/components-audit/` left untouched (decided out of scope).
- `isDevelopment()` / `isProduction()` in `platform.ts` are unused but not
  mobile-related; they belong to a dead-code pass, not this one.
- Nothing was copied into `quorum-mobile`. Two of the three candidate docs turned out
  to be stale or misfiled, and the third describes an architecture that repo does not
  use.

---

*Last updated: 2026-08-13*
