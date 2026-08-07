---
type: bug
title: "A local message-read failure is presented as a server outage, or silently redirects the user home"
status: done
priority: high
created: 2026-08-06
updated: 2026-08-06
severity: the user is told something false — either that Quilibrium infrastructure is down, or nothing at all — when the fault is local and often recoverable
area: error boundaries / failure presentation
repos: quorum-desktop
related:
  - ".agents/issues/.open/2026-08-06-messagedb-never-recovers-from-an-abnormally-closed-connection.md"
  - ".agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md"
---

# A local message-read failure is presented as a server outage, or silently redirects the user home

Found by an error-handling audit while fixing the two "channel shows as empty"
bugs. **Pre-existing**, not introduced by that change.

`useMessages` uses `useSuspenseInfiniteQuery`, which in TanStack Query v5 always
re-throws a `queryFn` rejection to the nearest error boundary. That is not
optional. So any failure reading messages from IndexedDB lands in a boundary —
and both boundaries lie about what happened.

## 1. Spaces: silent redirect home

`src/components/Router/Router.web.tsx:237` wraps `<Space />` in a
`RouteErrorBoundary` whose fallback is `<Navigate to="/" replace />`, with
`console.error` as the only record.

A failed message read therefore ejects the user out of the channel back to the
root with **no explanation, no toast, no retry**. From the user's seat this is
indistinguishable from "the app randomly kicked me out" — arguably worse than
the empty-channel bugs, which at least left visible (if wrong) content.

## 2. DMs: a false maintenance screen for the whole app

DM routes have no local boundary, so the failure reaches the app-root
`ErrorBoundary` in `src/App.tsx:25`. Its fallback replaces the **entire app**
with `Maintenance.tsx`: "Maintenance in Progress… Quorum infrastructure is being
deployed… check status.quilibrium.com".

That is actively wrong for a purely local client fault, and it points the user at
a nonexistent server incident. `componentDidCatch` calls `logger.log`, which is a
**confirmed no-op in production** (see related issue), so nothing is recorded
anywhere either. The only thing that works is the "Refresh" button, and only by
accident: reloading reopens IndexedDB.

## What to do

- Give the Space route a channel-scoped error state (inline card, explanation,
  retry) instead of a bare navigate-away.
- Stop claiming server maintenance for a caught render error. The maintenance
  screen should require an actual maintenance signal; an unknown local crash
  needs its own honest copy.
- Surface something to the user in both cases. Note that swapping `console.error`
  for `logger.error` would make this **less** visible in production, not more,
  until the no-op-logger issue is fixed, and this repo has no Sentry-equivalent
  sink. Until then the only lever that helps a real user is user-facing UI.

## Note

This matters more than usual here because the operator cannot read a diff and
relies on app behaviour to detect faults. A failure mode that presents as
"Quilibrium is down" will send them chasing an infrastructure problem that does
not exist.

## Status

**2026-08-06 — shipped in PR #319** (`fix(errors): a failed message read no
longer reads as a server outage, and repair every icon that rendered nothing`).
Depends on quorum-shared PR #76.

All three items under "What to do" landed and are covered by falsified tests.
Two things worth carrying forward:

- The screens ended up on the 404 template (circular icon badge, title,
  description, stacked `Button` primitives), not the `.empty-state` pattern the
  first cut used, which read as an empty list rather than a failure.
- The badge initially rendered nothing, because `alert-triangle` is not a valid
  `IconName`. That turned out to be a much wider bug with its own issue,
  `2026-08-06-invalid-icon-names-render-nothing-and-no-type-error-catches-them.md`,
  which is still open for the remaining primitives.

`/dev/error-states` renders all four screens on demand if they need looking at
again.

**What changed**

- `src/components/Router/RouteBoundary.tsx` (new) — the route boundary, lifted
  out of `Router.web.tsx` so it can be tested without importing the whole app
  tree. Adds a retry callback and a `resetKey`.
- `src/components/RouteErrorFallback.tsx` (new) — the inline error card, with
  "Try again" and "Reload app". Replaces `<Navigate to="/" replace />` on all
  seven route boundaries.
- `src/components/AppErrorScreen.tsx` (new) — honest app-root crash screen.
  `App.tsx` no longer renders `Maintenance` for a caught render error.
- DM routes (`/messages`, `/messages/:address`) gained a boundary; they had
  none, which is why a DM read failure reached the app root in the first place.
- `App.tsx` `componentDidCatch` now uses `console.error`, not the
  production-no-op `logger.log`.
- `Maintenance.tsx` keeps a docblock saying it may only be rendered on a real
  maintenance signal, so it does not get re-wired as a crash fallback.

**Retry actually retries.** `useSuspenseInfiniteQuery` leaves the query in an
error state, so clearing the boundary alone would re-throw immediately. The
boundary is wrapped in `QueryErrorResetBoundary` and calls its `reset()` before
clearing.

**Stale-error reset.** React Router reuses the element instance across param
changes, so without `getDerivedStateFromProps` the boundary stayed stuck on the
error card after switching to a channel that never failed. This bug did not
exist before, because the old fallback navigated away instead of rendering.

**Verification.** `src/dev/tests/components/routeErrorBoundary.test.tsx`, 9
tests. Each behaviour was falsified rather than assumed:

| Reverted change | Result |
|---|---|
| fallback back to `<Navigate to="/" />` | 7 red, the 2 `AppErrorScreen` tests stayed green |
| `getDerivedStateFromProps` removed | exactly 1 red (stale-error reset) |
| `retry` no longer clears `hasError` | exactly 1 red (retry recovery) |

Full suite green afterwards: 85 files, 1111 tests. `tsc --noEmit` clean, lint
adds no new warnings.

**Not done here:** translation. Six new source strings are untranslated by
design; catalogs are updated in their own PR. Lingui falls back to the source
English, which the tests confirm (the `en` catalog predates these strings and
the exact English still renders).

**Still open, separately:** the two related issues. This changes how a failure
is *presented*, not why the read fails. `MessageDB` still never recovers from an
abnormally closed connection, which is why "Reload app" is offered alongside
"Try again".

---
*Last updated: 2026-08-06*
