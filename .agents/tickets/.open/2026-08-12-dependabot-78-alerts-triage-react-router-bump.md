---
type: task
title: "78 Dependabot alerts triaged against the shipped bundle: 76 don't ship, react-router needs a bump"
status: open
priority: low
created: 2026-08-12
updated: 2026-08-13
area: dependencies / supply chain
platforms: quorum-desktop — web and Electron
---

# Dependabot's 78 alerts, triaged against what actually ships

## Status

**2026-08-13 — the one action shipped in PR #337**
(`fix(onboarding): stop telling users the no-passkey path is still secure`).

What landed: `react-router` and `react-router-dom` bumped 7.17.0 → 7.18.2,
clearing the 5 alerts including both runtime highs. Suite green afterwards (1428
tests), typecheck and lint clean, production build and the bundle-globals check
both pass. Nobody has driven the running app against the new version; the app
uses only the declarative API, so the exposure to that library's churn is small.

Still open, which is why this file stays here: **the elliptic question below is
unanswered.** `elliptic` 6.6.1 is genuinely in the shipped bundle, has no patched
version to move to, and whether its ECDSA is ever *called* is INFERRED rather than
measured. Closing that needs a runtime breakpoint on those exports, not more
grepping. Everything else in this triage is either inert or actioned.

## Why this exists

`git push` to `main` reports **78 open Dependabot alerts (1 critical, 35 high, 34 moderate,
8 low)** on the default branch. The number is alarming and almost entirely inert: it counts
advisories against the *dependency tree*, not against the *shipped bundle*.

This file records the triage so nobody has to redo it, and names the one thing worth acting
on. Re-run the method below rather than trusting these counts after any lockfile change.

## The one action

Bump **`react-router` 7.17.0 → 7.18.2** (and `react-router-dom` to match). Clears 5 alerts
including both runtime highs. Nothing else here has a fix available or a reachable path.

## Triage result

| Scope | Count |
|---|---|
| `development` (build/test tooling) | 51 |
| `runtime` | 27 |

Of the 27 runtime-scope alerts, measured against a real `yarn build` output (69 JS files):

| Package | Alerts | In shipped bundle? | Real origin |
|---|---|---|---|
| `shell-quote` | 2, incl. **the only critical** | **absent** | quorum-mobile → react-native → react-devtools-core |
| `undici` | 7 (1 high) | **absent** | jsdom (test env) + expo CLI |
| `image-size` | 2 high | **absent** | react-native → metro bundler |
| `postcss` | 4 (2 high) | build-time only | devDependency |
| `ws` | 4 (3 high) | Node lib; browser uses native WebSocket | devDependency |
| `ajv`, `uuid` | 2 medium | transitive tooling | — |
| **`react-router`** | 5 (2 high) | **yes** | direct dependency |
| **`elliptic`** | 1 low | **yes** | `crypto-browserify`, aliased at `web/vite.config.ts:209` |

**The critical is a false positive for this repo.** `shell-quote` arrives through React
Native's devtools because quorum-mobile is in the tree; it is not in the desktop bundle.

## The two that genuinely ship

### react-router 7.17.0 — 4 of 5 advisories don't apply, 1 isn't reachable

`web/main.tsx:54` uses `BrowserRouter`, i.e. **Declarative Mode**. Four advisories are
explicitly gated to modes this app does not use:

| Advisory | Gated to |
|---|---|
| RSC Mode CSRF bypass (high) | unstable RSC APIs |
| Unauthenticated DoS via route matching (high) | Framework Mode (server) |
| `deserializeErrors()` constructor injection (medium) | SSR hydration; excluded in Declarative Mode |
| `RSCErrorHandler` missing protocol validation / XSS (medium) | unstable RSC APIs |

The fifth, **open redirect via backslash in `<Link>` / `useNavigate` (medium)**, is *not*
mode-gated. It is still not reachable here: all 25 `navigate()` targets in the codebase
begin with a hardcoded literal prefix (`/messages/`, `/spaces/`, `/bookmarks`), with
interpolated user data only ever in a trailing segment. The advisory needs attacker data in
the *leading* position to produce a protocol-relative URL; a backslash in a trailing segment
cannot get there.

Bump anyway — it is free, and this reasoning has to be re-derived every time otherwise.

### elliptic 6.6.1 — bundled, unfixable, probably dead code

`web/vite.config.ts:209` aliases `crypto` → `crypto-browserify`, which pulls
`create-ecdh` + `browserify-sign` → `elliptic`. It is genuinely in
`dist/web/assets/index-*.js`, and the vulnerable code specifically survived tree-shaking:
`_truncateToN` (the exact function GHSA-848j-6mx2-7j84 names), `recoveryParam`, and the
secp256k1 curve table are all present in the built output.

**There is no patched version.** The vulnerable range is `<= 6.6.1` and
`first_patched_version` is `null`, so there is nothing to upgrade to. Removing it would mean
dropping or replacing the `crypto-browserify` alias, which is a real change to how the web
build polyfills node crypto — out of scope for a dependency bump, and not obviously
warranted given the reachability below.

## Open question, deliberately not closed

Whether elliptic's ECDSA is ever **called** is INFERRED, not measured.

- MEASURED: no app source calls `createSign` / `createVerify` / `createECDH`.
- MEASURED: those entry points appear in the bundle 1–2 times each, consistent with
  definition-only.
- NOT MEASURED: whether a transitive dependency (e.g. the Quilibrium SDK) invokes them.
  Minified output does not cleanly separate "defined" from "called".

For a messenger this is the one residue worth closing properly if anyone wants certainty.
The honest instrument is a runtime breakpoint on those exports, not more grepping. Until
then, treat "elliptic ECDSA is dead weight" as a plausible belief, not a finding.

## How to re-run this triage

```bash
gh api "repos/QuilibriumNetwork/quorum-desktop/dependabot/alerts?state=open&per_page=100" \
  --paginate > /tmp/dep.json     # group by security_advisory.severity + dependency.scope

yarn why <package>               # find the real origin; many trace to quorum-mobile / jsdom
yarn build                       # then grep dist/ for the package name and for the
                                 # specific vulnerable function the advisory names
```

The last step is the one that matters. Scope (`runtime` vs `development`) describes where a
package sits in the dependency tree, **not** whether it reaches users. Six of the seven
runtime packages flagged here are absent from the bundle entirely.

---

*Last updated: 2026-08-13*
