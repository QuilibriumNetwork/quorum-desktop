---
type: bug
title: "A local message-read failure is presented as a server outage, or silently redirects the user home"
status: open
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

---
*Last updated: 2026-08-06*
