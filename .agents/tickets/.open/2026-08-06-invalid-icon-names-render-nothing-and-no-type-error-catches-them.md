---
type: bug
title: "Every shared primitive reaches consumers as `any`, so nothing type-checks their props"
status: in-progress
priority: low
created: 2026-08-06
updated: 2026-08-06
severity: props on all 21 primitives go unchecked; the two cases looked at so far were both invisible dead UI in production
area: primitives / build types
repos: quorum-desktop, quorum-shared
---

# Every shared primitive reaches consumers as `any`

Filed as an icon bug, which is how it surfaced: the error screens shipped with an
invisible badge because they passed `name="alert-triangle"`, and there is no
`alert-triangle` in `IconName` (the triangle is called `warning`). The icon half
is fixed. The general problem underneath it is not, and it is why the title
changed.

**In one sentence:** the shared package's type declarations point at a file that
is never built, TypeScript quietly gives up and types every primitive as `any`,
so no prop on any of them has been checked — for as long as the platform split
has existed.

That is invisible by construction. It never crashes and never logs; the symptom
is a component silently doing nothing, which is exactly what both bugs found so
far look like.

## The type hole

`Icon`'s `name` prop is declared as `IconName`, a 251-member string union, so
this should be a compile error. It is not, anywhere in the app.

The built declarations for every platform-split primitive re-export a module
that is never emitted:

```ts
// dist/primitives/Icon/index.d.ts
export { Icon } from './Icon';   // <- only Icon.web.d.ts exists in that folder
```

`Icon.web.tsx` / `Icon.native.tsx` emit `Icon.web.d.ts`, and nothing emits a
plain `Icon.d.ts`. Because the repo typechecks with `skipLibCheck`, TypeScript
swallows the unresolved re-export and `Icon` arrives in consumers as `any`. Every
prop on it is then unchecked, not just `name`.

`Button` has the identical shape (`export { default } from './Button'` beside
only `Button.web.d.ts`), so this is not specific to `Icon`.

**MEASURED**, not inferred: `<Icon name="totally-not-an-icon" />` produced zero
errors from `npx tsc --noEmit --jsx react-jsx --skipLibCheck`, while a deliberate
`const x: number = "str"` canary in the same file was reported as `TS2322`. So
the file is being checked; the icon name simply is not.

Tests do not cover the gap either, because they assert on text. An assertion on
the rendered `svg` does catch it, and is what the error-screen tests now use.

## The broken call sites — FIXED

`Icon` returns `null` for an unknown name, so each of these rendered nothing at
all. Twelve, from a scan of every icon literal against the shipped union:

| File | Was | Now |
|---|---|---|
| `components/bookmarks/BookmarksPage.tsx:117` | `alert-triangle` | `warning` |
| `components/bookmarks/BookmarksPanel.tsx:100` | `loader` | `spinner` |
| `components/bookmarks/BookmarksPanel.tsx:109` | `alert-triangle` | `warning` |
| `components/onboarding/steps/ImportKeyStep.tsx:185` | `alert-circle` | `error` |
| `dev/db-inspector/DbInspector.tsx:101,278` | `database` | `database`, now added to shared |
| `dev/DevMainPage.tsx:47`, `dev/DevNavMenu.tsx:43` | `database` | same |
| `dev/docs/Docs.tsx:73,88` | `loader`, `alert-triangle` | `spinner`, `warning` |
| `dev/docs/Reports.tsx:73,88` | `loader`, `alert-triangle` | `spinner`, `warning` |

Four were user-facing: both bookmarks empty states, the bookmarks spinner, and
the key-import error in onboarding.

`database` had no equivalent in the union and was added to quorum-shared as
`IconDatabase`, since a DB inspector genuinely wants that icon.

An earlier draft of this issue also listed `components/ui/ThemeRadioGroup.tsx:43`
`theme`. That was a **false positive** in the first scan: it is `name="theme"` on
`RadioGroup`, an HTML form field name, not an icon. The scan now only matches
literals that really reach `Icon`.

## Status

**2026-08-06 — partly shipped.** quorum-shared PR #76 and quorum-desktop PR #319.
**Deliberately left open**: `Icon` is fixed, the other 20 primitives are not.

What landed:

- quorum-shared now emits the missing `X.d.ts` next to each `X.web.d.ts`
  (`scripts/emit-platform-shims.mjs`, run as part of `yarn build`), so the
  barrel's extensionless platform import resolves for consumers.
- **Enabled for `Icon` only**, via an allowlist in that script. Turning on all 19
  at once surfaced **98 pre-existing errors** in quorum-desktop, about two thirds
  in dev tooling: handlers that may be `undefined`, `string` passed where a union
  is required, native-only props on web components. Genuine, but a separate
  cleanup, and `yarn validate` is green today so it should stay that way.
- Four prop types that were wrong and only hidden by the `any` were fixed while
  there: `Spacer.size` optional, `Button.onClick`/`Icon.onClick` taking a
  required event on web and zero args on native, `hapticFeedback`/`swipeToClose`
  on the base props, and `Icon` accepting `title`.
- All twelve call sites repaired, and the six descriptor lists in desktop typed
  as `IconName`.

MEASURED: with `Icon` enabled, `tsc` rejects an invalid name
(`Type '"alert-triangle"' is not assignable to type 'IconName'`) where before it
reported nothing. Desktop is at 0 `tsc` errors, 1119 tests green.

## Remaining work — read this before starting

**Not urgent.** Nothing is on fire, `yarn validate` is green, and the app works.
This is a slow cleanup that pays for itself in found bugs. Do one primitive per
PR and stop whenever you like; every step leaves the repo green.

### Is it worth doing? Two data points

Most of the 98 are paperwork. A fair challenge is "buttons work fine, so this is
just appeasing the compiler". Two were checked by hand, and the split is
instructive:

- **`CreateSpaceModal.tsx:80` and 7 sibling modals** — `onClose={isSaving ?
  undefined : props.onClose}`. Deliberate: it blocks closing mid-save, and
  `closeOnBackdropClick`/`closeOnEscape` are turned off alongside it. The **type**
  is wrong here, not the code. Fix is one character in shared: `onClose?`.
  Genuinely cosmetic.
- **`Channel.tsx:1890`** — a `<Tooltip id="toggle-signing-tooltip" content=… />`
  with no children. `Tooltip` attaches itself to the element it wraps, so with no
  children it falls through to `<>{children}</>` and renders nothing. That
  tooltip had never been visible to anyone, and `MessageComposer` already had the
  working version. **Deleted in `b6d9a661a`.** Real dead UI, found by the type
  check and by nothing else.

So: one in two of the sampled cases was a live invisible-feature bug of exactly
the same class as the icons. The other 96 are unaudited.

### The loop, per primitive

1. In **quorum-shared**, add the name to `ENABLED` in
   `scripts/emit-platform-shims.mjs` (~line 51). That is the whole shared-side
   change. `yarn build` regenerates the shims.
2. In **quorum-desktop**, `npx tsc --noEmit` and fix what lights up.
3. **Check quorum-mobile too.** It consumes the same declaration tree via
   package.json `exports`. It has NOT been measured — it could be zero extra
   errors or another fifty. Measure before promising a PR size.
4. Ship shared first, then desktop (and mobile if affected). Desktop cannot go
   green until the shared build is published.

Fix at the source, not with casts. When the value is a literal in a static list,
type the list (`icon: IconName`) so a typo fails the build. Only cast when the
value genuinely comes from persisted data, as `MentionDropdown` does.

### What each primitive will cost, measured

From the one run with all 19 enabled (98 errors, quorum-desktop only). Counts are
approximate because one error can name two types.

| Next up | ~Errors | Where | Shape of the fix |
|---|---|---|---|
| `Text` | 26 | almost entirely `src/dev/` — docs viewer, dm-doctor, db-inspector, identity-coverage | `variant` gets a `string`; type the variable or the descriptor list |
| `Button` | ~30 | `src/components/modals/` and `src/dev/` | 11 are a `size` union taking `string`; 10 are the deliberate `onClose`/handler-may-be-undefined pattern; the rest are prop mismatches |
| `Select` / `RadioGroup` | 11 | 8 in `dev/components-audit/ComponentAuditViewer.tsx`, rest scattered | `onChange` is `(value: string \| string[]) => void`; call sites declare `(value: string) => void` |
| `Spacer` | 11 | modals | already fixed in shared (`size` optional) — should be near zero now, re-measure |
| `Input` | 3 | scattered | prop mismatches |
| `Tooltip` | 3 | `Channel.tsx` | one was the dead tooltip above; re-measure |
| `Select` (web) | 1 | | |

**Start with `Text`.** It is the largest single cluster, it is almost entirely
dev tooling, so the blast radius on production code is near zero, and it is a
good rehearsal for the loop before touching `Button`, which is the one that
reaches the modals.

### Two other threads

- Decide whether `skipLibCheck` is earning its place. It is what turned a broken
  declaration into a silent `any` rather than a build failure, so the same class
  of bug can recur in any other dependency.
- Optional: a dev-mode `console.warn` inside `Icon` for an unknown name, so a bad
  name is loud at runtime as well as at build time. `isValidIconName` is already
  exported from shared and unused.

## What was done first

Call sites fixed, and a regression guard added:
`src/dev/tests/components/iconNames.test.ts` scans every icon literal in `src/`
against `isValidIconName` and fails with the exact `file:line` and bad name.
Falsified by reintroducing `alert-triangle` in `BookmarksPage`, which the test
named precisely.

That guard is a workaround. **The underlying type hole is still open**, and is
the remaining work here:

1. **Fix the emit in quorum-shared** so the declaration barrel resolves. Either
   emit a plain `Icon.d.ts` alongside the platform files, or point `index.d.ts`
   at `./Icon.web`. This affects every platform-split primitive, not just
   `Icon` — `Button` has the same shape, so its props are unchecked too, and
   nothing has audited what that has been hiding.
2. Decide whether `skipLibCheck` is earning its place, since it is what turned a
   broken declaration into a silent `any` rather than a build failure.
3. Optional once 1 lands: a dev-mode `console.warn` inside `Icon` for an unknown
   name, so a bad name is loud at runtime as well as at build time.

## Note

Not filed under `.secret/`: this is a cosmetic and correctness bug, no attack
surface.

---
*Last updated: 2026-08-06*
