---
type: doc
title: "QNS Username Display (name resolution)"
status: done
ai_generated: true
created: 2026-06-11
updated: 2026-06-11
related_docs: ["input-validation-reference.md"]
related_tasks: [".agents/tasks/port-from-mobile/2026-06-11-qns-username-overrides-display-name-plan.md", ".agents/tasks/port-from-mobile/2026-06-10-qns-username-display-design.md"]
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

- `@quilibrium/quorum-shared` → `resolveDisplayName(member, { spaceOverrideName })` — the shared precedence rule, returns `{ name, isQnsVerified }`.
- `src/utils/resolveMemberName.ts` — the desktop adapter over the shared helper. Three exports:
  - `resolveMemberName(member)` — **DM/global contexts.** QNS wins over `displayName`.
  - `resolveSpaceMemberName(member)` — **space contexts.** Implements custom-name detection (below), then delegates to `resolveMemberName`.
  - `formatResolvedName(resolved)` — flattens to a plain string (`name.q` when verified) for non-JSX sites: placeholders, tooltips, aria-labels.
- `src/components/user/ResolvedName.tsx` — the one JSX component that renders a resolved name with the `.q` suffix (same font/size/weight/color as the name). All JSX sites use it so the suffix treatment can never drift.

Rule of thumb for new code: name sourced from a **space roster / effectiveMembers** → `resolveSpaceMemberName`. Name in a **DM or profile-global** context → `resolveMemberName`. Never re-implement precedence at a call site.

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
  → resolvers pick the name → <ResolvedName> renders it (.q when verified)
```

Fetch scopes (deliberate, perf-driven):

- **Space message senders**: `useMembersWithPublicProfileFallback` fetches the public profile for **every visible message sender** in the open channel (bounded, 1h React Query cache shared with the profile-card key). It enriches `effectiveMembers` with `primaryUsername` + `globalDisplayName`.
- **Member sidebar**: no fetches of its own. It cheap-merges `primaryUsername`/`globalDisplayName` from `effectiveMembers`, so only members who have posted show `.q` there. The full roster is deliberately never fetched (fetch-storm protection).
- **Mention autocomplete**: candidates come from the roster merged with `effectiveMembers` (same cheap merge). Matching also runs against `primaryUsername`, so typing `@ali` finds `alice`. The pill displays the resolved name; the stored token stays `@<address>` (wire format unchanged).
- **DMs**: `useUserPublicProfile(address)` per conversation partner; the DM list backfill (`useConversationsWithProfileBackfill`) fetches each partner's profile (small N) and returns `ConversationWithQns`.
- **Profile card** (`UserProfile.tsx`): uses the member object's fields when present, otherwise does one on-demand profile fetch while open.

### Local smoke-testing (no real data)

Until mobile publishes `primary_username`, no real `.q` exists. To eyeball rendering locally, temporarily synthesize a fake `primary_username` in the public-profile `queryFn`. **Apply it in ALL hooks that write `publicProfileQueryKey`** — `useUserPublicProfile`, `useMembersWithPublicProfileFallback`, and `useConversationsWithProfileBackfill` — because they share one cache key: if any non-injected one resolves first, it caches a real `null` and the injected ones never run (this caused a confusing "callout never shows" during development). To exercise the custom-name-wins rule, also inject a stable `globalDisplayName` (e.g. snapshot the first-seen roster name) so changing a per-space name makes it differ. Use `yarn dev:clean` to clear the cached `null` between runs. Remove all injections before commit.

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
- **Search results and bookmark cards** do not QNS-resolve (different data source / frozen snapshot; deferred, logged in the implementation plan).
- **Live data dependency**: no real `.q` shows until mobile actually publishes `primary_username` (two mobile-side bugs filed 2026-06-10 in `quorum-mobile/.agents/bugs/`).
- **Protocol improvements that would simplify this** (lead-dev asks, pending): a batch public-profile endpoint (N lookups → 1 request) and an explicit is-custom-name flag on `update-profile` (would replace the comparison trick). Neither blocks the feature.

## Related Documentation

- Implementation plan: `.agents/tasks/port-from-mobile/2026-06-11-qns-username-overrides-display-name-plan.md` (includes the full surface audit)
- Original design: `.agents/tasks/port-from-mobile/2026-06-10-qns-username-display-design.md`
- Validation rules: `.agents/docs/features/input-validation-reference.md`

---
*Last updated: 2026-06-11*
