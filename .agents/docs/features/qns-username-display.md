---
type: doc
title: "QNS Username Display (name resolution)"
status: done
ai_generated: true
created: 2026-06-11
updated: 2026-08-11
related_docs: ["input-validation-reference.md"]
related_tasks: [".agents/issues/port-from-mobile/.done/2026-06-11-qns-username-overrides-display-name-plan.md", ".agents/issues/port-from-mobile/.done/2026-06-10-qns-username-display-design.md"]
---

# QNS Username Display (name resolution)

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

A user can register a username on the Quilibrium Name Service (QNS) and elect it as their **primary username**. Desktop shows that name, rendered as `name.q`, as the user's identity across the app. The `.q` suffix uses the exact same font, size, weight, and color as the name it is attached to (no special styling). It is a trust marker: it only appears on verified QNS names and custom display names are blocked from imitating it.

The feature answers one question everywhere a person's name renders: **"which of this user's names do we show?"**

## The three name types

Every user can have up to three names. Understanding the difference is the key to this feature:

| Name | Code field | Where it is set | Where it lives | Meaning |
|---|---|---|---|---|
| **Per-space display name** | `displayName` (the "roster name") | Space Settings → Account, inside one space | The space's member roster (broadcast via `update-profile`) | "Call me this **in this space**" |
| **Global display name** | `globalDisplayName` | User Settings (account-wide) | The user's published public profile (`display_name`) | "Call me this **by default**" |
| **QNS primary username** | `primaryUsername` | QNS registration + electing it primary | The user's published public profile (`primary_username`) | "This is my **verified, owned identity**" (rendered `name.q`) |

Important wrinkle: when a user joins a space, their global name is **copied** into the roster's `displayName`. So the roster field holds either a deliberate per-space name or just the global default, with no flag saying which (see "Custom-name detection" below).

## The precedence rule

Most specific wins:

```
custom per-space name  →  QNS primary username (.q)  →  global display name  →  truncated address
```

- In a **space**: a name the member deliberately set for that space wins; otherwise their QNS name; otherwise the global name; otherwise the address.
- In a **DM** (no per-space concept): QNS name → display name → address.
- The `.q` suffix renders **only** when the chosen name is the QNS username (`isQnsVerified: true`). It is never stored, always appended at render time.

## Architecture

### Resolvers (single source of truth)

> **Rewritten 2026-08-11 (PR #327).** Everything named in this section before that
> date — `resolveMemberName`, `resolveSpaceMemberName`, `formatResolvedName`,
> `ResolvedName.tsx` — has been **deleted**. A call site no longer picks a resolver
> by context; it passes an **address** and the module picks the scope.

- `@quilibrium/quorum-shared` → `resolveIdentity(identity, { scope })` — the shared
  precedence rule over a complete `MemberIdentity` (`address`, `spaceName`,
  `qnsName`, `globalName`, all required and explicitly nullable). Returns
  `{ name, isQnsVerified }`. `scope` is `'space'` or `'global'`.
- [`src/identity/`](../../../src/identity/) — the desktop layer. Its whole public
  surface:
  - `<MemberName address=… />` — the JSX component. Renders the name and the `.q`,
    and owns avatar initials from that same resolved name.
  - `useResolvedName(address, opts)` — the flat string (`name.q` when verified),
    for aria-labels, tooltips, notification bodies, modal payloads.
  - `useResolvedMemberName(address, opts)` — `{ name, isQnsVerified }`, for callers
    that style the suffix themselves.
  - `useNameResolver()` — `resolve(address)` / `requestNames(addresses)`, for
    resolving MANY addresses outside JSX (raw-DOM mention pills, search filters,
    sort keys), where a hook cannot be called per row.
  - `useMemberIdentity(address, opts)` — the **raw tiers**. See the warning on its
    docstring: its return value has NOT been through `resolveIdentity`, so a caller
    that renders a tier directly bypasses the forged-`.q` guard.

Rule of thumb for new code: **pass the address, never the fields.** `spaceId` comes
from the surrounding `<IdentityScopeProvider>`; pass it explicitly only on a
detached surface (a bookmark, a notification) that carries its own stored one. An
eslint rule blocks resolving a name anywhere outside `src/identity/`.

Full architecture, including the provider merge semantics and the traps:
[`2026-08-10-identity-resolution-architecture-design.md`](../../issues/2026-08-10-identity-resolution-architecture-design.md).

### Custom-name detection (the comparison trick)

The roster stores one `display_name` per member with no marker of origin (deliberate per-space name vs global default copied at join). The protocol offers no flag. Desktop tells them apart by comparison:

```
roster displayName ≠ globalDisplayName  →  deliberately typed for this space  →  it wins, no .q
roster displayName = globalDisplayName  →  just the global default            →  QNS name wins, show .q
globalDisplayName unknown               →  conservatively respect the roster name (never hide a possibly-deliberate choice)
```

This costs nothing extra: `globalDisplayName` comes from the same public-profile fetch that is the **only** source of `primaryUsername`. Whenever a QNS name is known, the global name is known too.

### Data flow (sourcing)

```
user elects QNS primary name
  → published in their signed public profile (primary_username + display_name)
  → desktop fetches the public profile          ← the ONLY source of both fields
  → fields land on member objects
  → the identity provider assembles the tiers for an address
  → resolveIdentity picks the name → <MemberName> renders it (.q when verified)
```

Fetch scopes (deliberate, perf-driven):

- **Space message senders**: `useVisibleSenderProfileFallback` (renamed from
  `useMembersWithPublicProfileFallback` in PR #327) fetches the public profile for **every visible message sender** in the open channel (bounded, 1h React Query cache shared with the profile-card key). It enriches `effectiveMembers` with `primaryUsername` + `globalDisplayName`.
- **Member sidebar**: no fetches of its own — the only surface that never passes
  `enrich`. It cheap-merges `primaryUsername`/`globalDisplayName` from `effectiveMembers`, so only members who have posted show `.q` there. The full roster is deliberately never fetched (fetch-storm protection: a 200-member space MEASURED 200 concurrent requests on open before the no-fetch policy).
- **Mention autocomplete**: candidates come from the roster merged with `effectiveMembers` (same cheap merge). Matching also runs against `primaryUsername`, so typing `@ali` finds `alice`. The pill displays the resolved name; the stored token stays `@<address>` (wire format unchanged). Since PR #327 it **does** enrich: the candidate list is capped, so the fetch is bounded and demand-driven (MEASURED: 12 candidates → 12 fetches; further keystrokes over the same results → +0).
- **DMs**: `useUserPublicProfile(address)` per conversation partner; the DM list backfill (`useConversationsWithProfileBackfill`) fetches each partner's profile (small N) and returns `ConversationWithQns`.
- **Profile card** (`UserProfile.tsx`): uses the member object's fields when present, otherwise does one on-demand profile fetch while open.

### Local smoke-testing (no real data) — use the dev page, not the old recipe

A `.q` costs real money, so no test account owns one and every QNS surface is
otherwise unreachable. **`/dev/fake-qns`** synthesizes one (shipped 2026-08-06,
PR #315). Read-side overlay: nothing is written, signed or published.

- **Give myself a .q** — start here, it covers most of the job. Nearly every
  surface that renders a name can render you: your messages, a reply to your own
  message, a mention you typed at yourself, your reactions, the member sidebar,
  and the notification body when someone mentions you (the name resolved there
  is the mentioned person, not the sender). Self needs no publish path: desktop
  reads its own primary username from `useUserPublicProfile(ownAddress)`, the
  same fetch the overlay intercepts.
- **Give everyone a .q** — coverage sweep for what is left, a DM partner's name
  and a blocked user. Never overwrites a real registration.
- **All profiles private** — simulates other people being private. For your own
  profile the real public/private toggle is the better test; it goes end-to-end.
- **Pin one address** — the control arm. With everyone named there is nothing to
  compare against, so pin one member to a known name, or to no name at all, and
  the difference tells you which tier actually won.

The overlay injects inside `QuorumApiClient.getPublicProfile`, and the core is
kept byte-identical to mobile's `services/dev/fakeQns.ts` so the two clients can
be compared. Both suites assert the same hard-coded name derivation, so the pair
cannot drift unnoticed.

> **The old recipe is obsolete — do not follow it.** It said to temporarily
> synthesize a `primary_username` in the public-profile `queryFn`, applying it in
> ALL hooks that write `publicProfileQueryKey` (`useUserPublicProfile`,
> `useMembersWithPublicProfileFallback`, `useConversationsWithProfileBackfill`)
> because they share one cache key: if a non-injected one resolved first it
> cached a real `null` and the injected ones never ran, which cost a confusing
> "callout never shows" debugging session. The single API-client seam makes that
> failure unreachable — there is no second path to a public profile, so there is
> no hook to forget and nothing to revert before committing.

### Trust / validation

- QNS names are stored bare (`alice`); `.q` is appended only at render time.
- The shared display-name validator rejects custom names ending in `.q` (after trimming + Unicode-confusable folding), so the suffix cannot be spoofed. Wired into both the global and per-space name inputs.

## Privacy model

`primary_username` travels **only in the published public profile**, never in the message broadcast. Consequence: a user's `.q` shows only if they opted into a public profile. This is a consistency decision: the QNS label follows the same public/private opt-in as the rest of profile metadata (name, avatar, bio).

What the public/private toggle does NOT do: gate reachability. The QNS resolver (`GET names.quilibrium.com/resolve/:name`) is global and public; anyone who knows a registered name can resolve it to an address and start a DM, regardless of any Quorum profile setting. The toggle only controls whether Quorum *displays* the label.

## Known limitations

- **Custom name identical to the global name** reads as "not custom", so the QNS name shows. Tiny corner case; degrades to a correct name without honoring the (invisible) custom intent.
- **Stale profile cache after a global rename** (up to 1h) can briefly read the roster name as custom, hiding `.q`. Always degrades to a correct name without `.q`, never a wrong name.
- **Sidebar lurkers**: members who never posted in the open channel show no `.q` in the member sidebar (no profile fetch for them). It appears once they post or their profile card is opened. Full-roster enrichment would need virtualized visible-range tracking (possible follow-up).
- ~~**Search results and bookmark cards** do not QNS-resolve~~ — **fixed in PR #327.**
  Both now resolve from the address through `src/identity/` like every other surface,
  so a bookmark shows the sender's current name rather than the string frozen at
  bookmark-creation time.
- **Live data dependency**: no real `.q` shows until mobile actually publishes `primary_username` (two mobile-side bugs filed 2026-06-10 in `quorum-mobile/.agents/bugs/`).
- **Protocol improvements that would simplify this** (lead-dev asks, pending): a batch public-profile endpoint (N lookups → 1 request) and an explicit is-custom-name flag on `update-profile` (would replace the comparison trick). Neither blocks the feature.

## Related Documentation

- Implementation plan: `.agents/issues/port-from-mobile/.done/2026-06-11-qns-username-overrides-display-name-plan.md` (includes the full surface audit)
- Original design: `.agents/issues/port-from-mobile/.done/2026-06-10-qns-username-display-design.md`
- Validation rules: `.agents/docs/features/input-validation-reference.md`

---
*Last updated: 2026-08-06*
