---
type: bug
title: 'quorum-shared: Input.native.tsx leaks a falsy ReactNode literal into a View style slot (TS2769)'
status: open
priority: medium
created: 2026-08-23
updated: 2026-08-23
---

# quorum-shared: Input.native.tsx leaks a falsy ReactNode literal into a View style slot (TS2769)

**Affected repo: `quorum-shared`** (not desktop). Filed here because this repo's
`.agents/issues/` is where this repo's `yarn verify` cross-repo regression gate
keeps its tracking issues, to keep the sibling repos' own PRs free of source
changes. See
`quorum-desktop/.agents/issues/.open/2026-08-22-verify-regression-gate-plan.md`
for the gate itself, and `quorum-desktop/scripts/verify/baseline.mjs` for why
this specific exemption exists.

## Symptoms

`yarn typecheck` (`tsc --noEmit`) fails in `quorum-shared` with:

```
src/primitives/Input/Input.native.tsx(164,11): error TS2769: No overload matches this call.
  Overload 1 of 2, '(props: ViewProps): View', gave the following error.
    Type 'false | "" | 0 | 0n | { position: "relative"; } | null | undefined' is not assignable to type
    'ViewStyle | Falsy | RegisteredStyle<ViewStyle> | RecursiveArray<ViewStyle | Falsy | RegisteredStyle<ViewStyle>> |
    readonly (ViewStyle | ... 1 more ... | RegisteredStyle<...>)[]'.
      Type '0' is not assignable to type 'ViewStyle | Falsy | RegisteredStyle<ViewStyle> | ...'.
```

MEASURED directly (`cd quorum-shared && yarn typecheck`, 2026-08-23): exactly
one error, at exactly this location. `yarn verify` in quorum-desktop currently
exempts this step via a `KNOWN_RED` entry in `scripts/verify/baseline.mjs`
(`shared:typecheck`, baseline `errors: 1`). **That exemption must be deleted
the moment this is fixed** — leaving it in place would let a future, unrelated
typecheck failure in `quorum-shared` hide behind a stale "known" one.

## Root Cause

`src/primitives/Input/Input.native.tsx:164`:

```tsx
<View
  style={[
    (showFloatingLabel || leftIcon || rightIcon) && styles.floatingContainer,
  ]}
>
```

- `showFloatingLabel = labelType === 'floating' && label` (`label?: string`),
  so its type is `false | string | undefined`.
- `leftIcon` and `rightIcon` are both typed `React.ReactNode` (see
  `src/primitives/Input/types.ts:53,59`), which includes `string | number |
  bigint | boolean | ...` — React lets you render a raw number or string as a
  child, so these props accept one.
- `(showFloatingLabel || leftIcon || rightIcon)` therefore has a type wide
  enough to include falsy string/number/bigint literals, not just `boolean`.
- `X && styles.floatingContainer` evaluates, when `X` is falsy, to whatever
  falsy value `X` actually was — so TypeScript infers the array element's type
  as `false | "" | 0 | 0n | null | undefined | typeof styles.floatingContainer`.
- React Native's `View` accepts a raw `number` in a style array (`RegisteredStyle<ViewStyle>`),
  but only a **branded** number produced by `StyleSheet.create` — not an
  arbitrary literal. A bare `0` (or `""`, or `0n`) does not satisfy that
  branded type, so `tsc` rejects the array.

**Note for whoever fixes this:** before this issue was filed, the working guess
was that this would turn out to be a numeric `count && {...}` pattern
(`count > 0 && {...}` as the likely fix) — a common shape for this exact class
of RN typecheck error. That guess was checked against the actual file and does
**not** match — there is no `count` variable anywhere in `Input.native.tsx`.
The real mechanism is the `leftIcon`/`rightIcon`/`showFloatingLabel`
truthiness chain described above. The general insight behind that guess is
still correct, though, and is still the reason this is a `bug`, not just a
lint nag: **a bare number in a React Native style position is not inert.** RN
resolves numbers in style arrays as registered `StyleSheet` ids. That's
exactly why `tsc` is refusing a plain literal `0` here rather than silently
accepting it — the type system is protecting against a value that, at
runtime, RN would try to interpret as a style id rather than "no style". Any
fix should keep that protection rather than route around it with a type
assertion.

A plausible fix direction (not implemented, not verified as *the* fix, and
explicitly out of scope for this issue): coerce the guard to an actual boolean
before using it in the style array — e.g. `Boolean(showFloatingLabel ||
leftIcon || rightIcon) && styles.floatingContainer` — so the array element's
type is `false | typeof styles.floatingContainer` instead of leaking the
underlying literal.

## Prevention

None yet — this is a report, not a fix. Whoever picks this up should also
check whether `leftIcon`/`rightIcon`/`label` are ever *actually* passed a
non-boolean, non-element falsy value (a stray `0` or `''`) in a live caller;
if so, the type error was flagging a real conditional-rendering bug, not just
an overly-wide type.
