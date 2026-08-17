---
type: bug
title: "A failed QNS verification can stay failed for the whole session, with no signal"
status: open
complexity: medium
priority: high
ai_generated: true
created: 2026-08-17
updated: 2026-08-17
area: identity resolution / QNS claim verification / observability
repos: quorum-desktop (confirmed here), quorum-mobile (UNCHECKED — same shape, see below)
source: found by an independent review of the fail-open fix; this is the cost that fix makes visible
related:
  - ".agents/issues/.open/2026-08-17-a-failed-refetch-keeps-serving-stale-qns-verifications.md"
  - ".agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md"
---

# A failed QNS verification can stay failed for the whole session

## Summary

Once the claim-verification query errors, nothing in the running app is
guaranteed to ever retry it. Every `.q` suffix in that scope silently disappears
and does not come back, potentially for the rest of the session, with no error,
no toast and no log line.

This is the **fail-closed** direction, so it is not an impersonation risk — that
is exactly the trade the sibling issue's fix chose, and it is the right one. But
"correct and invisible" is still a bug when the invisible state can be
permanent, and the sibling fix is what turns this from harmless (stale data kept
looking fine) into consequential (verified names vanish).

## Why recovery is not guaranteed

The premise written into the sibling fix and its tests is that recovery is fast:
reject rather than cache an empty result, and the next attempt refetches. That
holds for the *mechanism* — the gate flips back the moment a success lands — but
nothing reliably triggers that success.

- `retry: false` on the query (deliberate, and its reasoning is sound).
- `refetchOnWindowFocus: false` on the app's QueryClient (`web/main.tsx`).
- No interval, no WS-reconnect handler, no other invalidation: `qns-verify-claims`
  appears nowhere else in `src/` except its own key definition.
- `useVerifiedQnsNames`'s widest call site is `IdentityScopeProvider`
  (`identity/identityProvider.tsx`), mounted once at the app ROOT, above the
  Router, and never unmounted during normal navigation. So `refetchOnMount` never
  fires again for it.
- `request()` only ever ADDS addresses, so the query key changes only when a
  genuinely new claimed name appears.

Net: for a long-lived scope whose claim set has gone quiet, one failed refetch
can be terminal for the session.

**Note the interaction with the sibling fix.** That fix (correctly) stops a
carried placeholder from resurrecting an errored query's data. A consequence is
that a widening claim set no longer papers over the stuck state either — which
is right, and also removes the one accidental path back to rendering names.

## Why nobody finds out

Nothing on this path logs. Per the logger issue, `logger.warn`/`logger.error`
are reachable in production only through `window.quorumLogger.enable()`, which
requires devtools and prior knowledge. A user sees names quietly lose their `.q`
and has no way to tell that from the feature not existing.

`src/identity/diagnostics.ts` already implements the right shape for this, in
this exact directory: `recordIfDegraded` / `getIdentityDiagnosticsState` /
`subscribeIdentityDiagnostics`, dev-build-only, try/catch-wrapped so it can never
break a render, and subscribable. `useVerifiedQnsNames` has no equivalent signal
for "the verification query errored and is serving NO_RECORDS". Extend that
rather than inventing a fourth logging mechanism.

## Options

Not obviously one right answer, which is why this is filed rather than fixed.

1. **A bounded retry** (`retry: 1` with a short backoff). Cheapest. Cuts against
   the existing comment arguing retries only extend the window in which real
   claims render unverified — read that argument before overriding it.
2. **An explicit recovery trigger**: invalidate `qns-verify-claims` on WebSocket
   reconnect, or on a coarse interval well under the one-hour `staleTime`.
   Targets the actual gap (a server-side failure with the network fine) without
   touching retry semantics.
3. **Observability only**: record the degraded state via `diagnostics.ts` so it
   is at least discoverable, and treat recovery as a separate decision.

2 and 3 together are probably the honest fix. 3 alone is worth doing regardless.

## Same shape elsewhere, lower stakes

`src/identity/identityProvider.tsx:279` reads each per-address public-profile
result's `.data` without checking `.status`, under the same `retry: false` and
the same one-hour `staleTime` — so a profile object survives an error
indefinitely with nothing logged.

Verified NOT a forgery vector: name ownership is re-checked independently by
`useVerifiedQnsNames`, which cares only about which name string is claimed, not
about how fresh the profile object is. A stale profile can keep an old
`display_name` or `bio` on screen longer than intended; it cannot resurrect
ownership of a transferred name. Worth the same `status === 'success'` gate for
consistency, not urgent.

Same-shape display-only reads: `components/direct/DirectMessage.tsx:342`,
`components/user/UserProfile.tsx:131`,
`hooks/business/bookmarks/useBookmarkSenderIcon.ts:138`.

## Definition of done

- [ ] A verification failure cannot silently persist for a whole session
- [ ] The degraded state is discoverable without devtools and prior knowledge
- [ ] A test proves recovery through a trigger the RUNNING APP actually has —
      not through a direct `refetchQueries` call, which is what the existing test
      uses and is why this gap was invisible
- [ ] quorum-mobile checked for the same recovery gap
- [ ] Decide on `identityProvider.tsx:279` — gate it or record why not

---

*Last updated: 2026-08-17*
