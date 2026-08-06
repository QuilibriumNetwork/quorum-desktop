---
type: bug
title: "Invalid icon names render nothing, and the type system cannot catch them"
status: in-progress
priority: medium
created: 2026-08-06
updated: 2026-08-06
severity: twelve call sites rendered no icon at all, four of them user-facing, and tsc reported zero errors
area: primitives / build types
repos: quorum-desktop, quorum-shared
---

# Invalid icon names render nothing, and no type error catches them

Found while fixing the error screens, which shipped with an invisible badge
because they passed `name="alert-triangle"`. There is no `alert-triangle` in
`IconName`; the triangle is called `warning`.

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
