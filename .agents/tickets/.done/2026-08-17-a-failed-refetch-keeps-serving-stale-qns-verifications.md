---
type: bug
title: "A failed refetch keeps serving stale QNS verifications, removing the one-hour bound"
status: done
complexity: small
priority: high
ai_generated: true
created: 2026-08-17
updated: 2026-08-17
area: identity resolution / QNS claim verification
repos: quorum-desktop (fixed, #352), quorum-mobile (second half fixed, #257)
source: found while adding a request deadline to shared's QNS transport; the bug itself predates that work
related:
  - "quorum-mobile PR #256, which fixed the identical bug on the mobile side"
---

# A failed refetch keeps serving stale QNS verifications

## Summary

`useVerifiedQnsNames` reads its query result as `data ?? NO_RECORDS`. React
Query does not clear `data` when a query errors — its reducer keeps the previous
state and only flips `status`. So once a name set has resolved successfully, a
failed refetch leaves the last successful record map in place and the hook keeps
serving it.

That removes the `staleTime` bound entirely. The bound is documented in the file
itself as a security parameter: it is how long a `.q` name transferred to
somebody else can still verify for its previous owner. One hour, deliberately.
With this bug, the answer is "for as long as refetches keep failing", with no
upper limit and nothing logged (`retry: false`, and no logging on that path).

## Status

**Fixed and shipped 2026-08-17 as quorum-desktop PR #352** (`75ada268b`).

The review before merge found that the obvious one-line gate was **not
sufficient** — see the Fix section, which now documents both halves. A widening
claim set after a failure resurrected the stale map through `placeholderData`,
because React Query treats an errored query as a valid placeholder source and
relabels the carried value `status: 'success'`.

quorum-mobile had the same second half open (its PR #256 shipped only the gate)
and is fixed in **quorum-mobile PR #257** (`1e457de`). Both clients are now
closed on both halves.

Verified: desktop 1523 tests / 5-of-5 mutants; mobile 1053 tests / 4-of-4
mutants. Each fix goes red when either half is reverted, and both repos carry a
control proving a healthy widening set still carries the previous answer.

Two follow-ups filed rather than folded in: the failure state can persist for a
whole session with no signal
(`2026-08-17-a-failed-qns-verification-can-stay-failed-for-the-whole-session.md`),
which that issue covers along with one same-shape read in `identityProvider.tsx`.

Originally found 2026-08-17. **Not introduced by any recent change** — the
transport has thrown on failure since it was written, and this read has always
been `data ?? NO_RECORDS`.

The standing "check both clients" rule earned its keep twice here. It found this
bug in desktop after mobile's #256; then, when review surfaced the second half,
it found that #256 had only ever closed the first — so mobile was still exposed
and nobody would have known.

## Evidence (MEASURED 2026-08-17)

A probe rendered the real hook against a mocked `resolveNamesBatch`, with a
control arm:

```
[PROBE] control arm rendered: alice
[PROBE] after failed refetch -> rendered="alice" status=error fetchStatus=idle dataKeys=["alice"] calls=2
[PROBE] VERDICT: FAIL-OPEN — stale verification survives a failed refetch
```

The control arm matters: without it, a hook that had simply stopped verifying
would produce a passing "fail-closed" reading for the wrong reason. Here the
control renders `alice` while healthy, and the measured arm still renders
`alice` while the query is in `status=error` holding stale `data`.

## Mechanism

```
src/identity/useVerifiedQnsNames.ts:208   const { data } = useQuery({ ... })
                                  :215     staleTime: 60 * 60 * 1000   ← the security bound
                                  :220     retry: false
                                  :237   const records = data ?? NO_RECORDS   ← reads data regardless of status
```

`resolveNamesBatch` rejects on any transport or server failure, on purpose — a
resolved empty result would be cached as a success and pin "nobody owns
anything" for the full hour. Rejecting is correct. What is missing is the other
half: the consumer must not treat a retained-but-stale `data` as a current
answer.

## Fix — BOTH halves, neither works alone

⚠️ The obvious one-line gate is **not sufficient**, and shipping only it leaves
the bug reachable by an ordinary scroll. This section originally showed only the
first half; that was wrong, and an independent review caught it before merge.

**Half 1 — gate the read on the query having actually succeeded:**

```ts
const { data, status } = useQuery({ ... });
const records = status === 'success' && data ? data : NO_RECORDS;
```

**Half 2 — refuse to carry a placeholder forward from an ERRORED query:**

```ts
placeholderData: (previous, previousQuery) =>
  previousQuery?.state.status === 'success' ? previous : undefined,
```

Why half 2 is required: React Query picks a new query's placeholder source by
"last query that had defined data", and an errored query still qualifies,
because the error reducer never clears `data`. It then reports the carried value
as `status: 'success'` — so half 1 passes it straight through. After a failed
refetch, one new claimant (a scroll) is enough to resurrect the stale map via a
brand-new query that has verified nothing, and `retry: false` means it never
expires on its own.

MEASURED 2026-08-17: with half 1 alone, the name correctly dropped to unverified
after the failure and then came back on the widen.

Mobile additionally guards `data instanceof Map` because its React Query cache
is persisted to MMKV, which serialises a `Map` to `{}`. Desktop's records are a
plain object already, so a truthiness check is enough here — but do not copy
mobile's `instanceof Map` line, because desktop's `QnsBatchResult` is a
`Record`, not a `Map`, and the check would reject every valid result.

`placeholderData` itself stays. It is doing a real job — stopping every name on
screen flickering whenever a new claimant appears — and half 2 narrows it rather
than removing it. Keep a control test proving a HEALTHY widen still carries the
previous answer, or the fix silently becomes "disable placeholder data".

## Definition of done

- [x] A failed refetch stops verifying rather than serving the last good records
- [x] A widening claim set AFTER a failure does not resurrect the stale map
- [x] A subsequent successful refetch recovers (the argument for rejecting
      instead of caching an empty result is that recovery is fast)
- [x] Test has a CONTROL arm proving a verified name renders while nothing fails
- [x] Test has a CONTROL arm proving a HEALTHY widen still carries the previous
      answer, so the fix cannot degrade into "placeholder data disabled"
- [x] Test goes RED with the fix reverted — a fail-closed assertion passes
      trivially against a hook that never verifies anything, so mutation-proof it
- [x] Assert on the rendered name, not on cache internals, so the test survives a
      React Query upgrade
- [x] quorum-mobile checked for the same placeholder hole — it had it, fixed in #257

---

*Last updated: 2026-08-17*
