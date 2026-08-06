---
type: bug
title: "Invalid icon names render nothing, and the type system cannot catch them"
status: open
priority: medium
created: 2026-08-06
updated: 2026-08-06
severity: eleven call sites render no icon at all, four of them user-facing, and tsc reports zero errors
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

## The broken call sites

`Icon` returns `null` for an unknown name, so each of these renders nothing at
all. Eleven, from a scan of every `name=` / `iconName=` literal against the
shipped union:

| File | Name passed | Visible to users? |
|---|---|---|
| `src/components/bookmarks/BookmarksPage.tsx:117` | `alert-triangle` | yes, bookmarks error state |
| `src/components/bookmarks/BookmarksPanel.tsx:100` | `loader` | yes, bookmarks loading state |
| `src/components/bookmarks/BookmarksPanel.tsx:109` | `alert-triangle` | yes, bookmarks error state |
| `src/components/onboarding/steps/ImportKeyStep.tsx:185` | `alert-circle` | yes, key-import error |
| `src/components/ui/ThemeRadioGroup.tsx:43` | `theme` | yes, theme picker |
| `src/dev/db-inspector/DbInspector.tsx:101,278` | `database` | dev only |
| `src/dev/docs/Docs.tsx:74,88` | `loader`, `alert-triangle` | dev only |
| `src/dev/docs/Reports.tsx:74,88` | `loader`, `alert-triangle` | dev only |

Likely intended: `alert-triangle` → `warning`, `alert-circle` → `error`,
`loader` → `spinner`. `theme` and `database` have no obvious equivalent and need
a decision (add to the union, or pick an existing name).

## What to do

1. **Fix the emit in quorum-shared** so the declaration barrel resolves. Either
   emit a plain `Icon.d.ts` alongside the platform files, or point `index.d.ts`
   at `./Icon.web`. Until this lands, nothing below can be enforced.
2. Fix the eleven call sites.
3. Consider whether `skipLibCheck` is earning its place, since it is what turned
   a broken declaration into silent `any` rather than a build failure.
4. `isValidIconName` is already exported from shared and unused. A dev-mode
   `console.warn` inside `Icon` on an unknown name would surface the next one
   immediately, without waiting for the type fix.

## Note

Not filed under `.secret/`: this is a cosmetic and correctness bug, no attack
surface.

---
*Last updated: 2026-08-06*
