---
type: task
title: "Name resolution: an API that cannot express a partial identity"
status: open
priority: high
created: 2026-08-10
updated: 2026-08-10
area: identity resolution / QNS / cross-client architecture
repos: quorum-shared (the rule), quorum-desktop (28 call sites), quorum-mobile (17 call sites)
source: written after fixing the same defect in ~18 places in one day; the operator asked for the elegant solution instead of a nineteenth patch
related:
  - ".agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md (the patches this supersedes)"
  - "quorum-mobile/.agents/issues/2026-08-06-qns-primary-name-work-and-desktop-parity.md (parity index; its shared-code section asks for exactly this spec)"
  - ".agents/docs/features/qns-username-display.md"
---

# Name resolution: an API that cannot express a partial identity

## The problem, stated as evidence rather than opinion

On 2026-08-10 the same defect was fixed in roughly eighteen places. Six came
from a deliberate source audit. **The other twelve came from the operator
clicking around the app for twenty minutes** — mention pills, the profile card,
DM own-messages, pinned messages, bookmarks, notifications.

That ratio is the finding. A source audit looking for "reads `displayName` by
hand" could not see most of them, because most of them *do* call the resolver.
They just call it with less than it needs.

**45 files across two repos import a resolver directly** (28 desktop, 17 mobile).
Every one must independently remember three fields and pick the right ladder.

## Why this keeps happening, in three properties

1. **The identity is three fields that must travel together** — `displayName`,
   `primaryUsername`, `globalDisplayName` — and they are passed individually at
   every call site.
2. **All three are optional, so omitting one is not a type error.** TypeScript
   cannot help, and does not.
3. **A partial identity does not degrade, it INVERTS.** This is the property that
   makes it dangerous rather than merely annoying. Omit `globalDisplayName` and
   the roster-vs-global comparison trivially reports "this is a deliberate
   per-space name", returning the roster name *before* the `.q` is ever
   considered. The caller gets a confident wrong answer that looks like a
   deliberate product decision.

And a fourth, compounding: **every call site must also choose between the space
ladder and the DM ladder.** That choice was hand-written at three sites in
desktop alone before being collapsed today.

The current architecture is visible in one line,
[`Channel.tsx:1868`](../../src/components/space/Channel.tsx): a virtualised
sidebar row reaches sideways into `effectiveMembers[item.address]` at the render
site, because the item it was handed cannot carry the fields. That workaround,
repeated per surface, *is* the design today.

## The principle

> **Call sites pass an address. You cannot forget a field you never pass.**

Everything else follows. It also happens to fix the three surfaces the operator
found last — pinned messages, bookmarks and notifications — for free, because
those are frozen snapshots that have an address and nothing else. That is
precisely why they are broken today, and why no amount of field-threading would
have fixed them: **there is nothing to thread from.**

## Design

### Layer 1 — `quorum-shared`: the rule, over a COMPLETE identity

The ladder, the echo demotion and the forged-suffix guard all live here already
or are meant to. One change of substance:

```ts
export interface MemberIdentity {
  address: string;
  /** Per-space override. `null` = no override (NOT "unknown"). */
  spaceName: string | null;
  /** QNS primary username, bare (no ".q"). `null` = none elected. */
  qnsName: string | null;
  /** Global display name. `null` = none set. */
  globalName: string | null;
}
```

**Every field is required and explicitly nullable.** `null` means "known to be
absent"; there is no `undefined`, so "I didn't pass it" becomes a compile error
in both repos rather than a silent inversion. This is the single change that
converts the whole bug class from runtime to build time.

`resolveIdentity(identity, { scope: 'space' | 'global' })` replaces both
`resolveMemberName` and `resolveSpaceMemberName`. One function, one explicit
scope, no way to call the wrong one by accident.

**Why shared:** this is the cross-client rule and the operator's requirement is
that it work on both clients. The parity document already argues for it and
explains why the current split is fragile — desktop has two resolvers and only
one delegates to shared, so a rule added to shared protects only half the paths.

### Layer 2 — per-client identity source (stays per-client, deliberately)

One provider owning `address → MemberIdentity`, assembled from the roster, the
roster's global slots, and the public-profile cache. It is the ONLY thing that
knows how those merge.

This layer stays per-client because the inputs genuinely differ: mobile's rows
are snake_case and desktop's camelCase, different query clients, different
storage, different placeholder semantics. The parity document's analysis of what
should and should not move to shared holds — the *rules* move, the *adapters* do
not.

It also absorbs the **self tier**, which currently does not exist on desktop and
caused two of today's bugs: when `address === me`, the identity comes from the
own public profile, not from `currentPasskeyInfo` (which carries no QNS name).
One place, not eight.

### Layer 3 — the only API app code may touch

```tsx
<MemberName address={addr} />                  // JSX; renders the ".q"
const name = useResolvedName(addr);            // strings: aria-labels,
                                               // notification bodies, tooltips,
                                               // modal payloads, search text
```

Scope is supplied by an `IdentityScopeProvider` at the space/DM boundary rather
than passed per call — a call site inside a channel should not be able to ask
for the wrong ladder. (See open question 1: explicit prop vs context.)

Every current call site becomes one of these two. `ResolvedName`,
`formatResolvedName`, `resolveMentionPillName`, `resolveProfileCardName`,
`conversationMatchesSearch` and `selfNamePlaceholder` all collapse into them.

### Layer 4 — enforcement, because the rule is what regrows

An eslint `no-restricted-imports` rule plus a guard test: nothing outside the
identity module may import the low-level resolver. Mobile already shipped this
exact pattern for raw override reads, and it is the reason mobile's equivalent
defect did not regrow. **Without this layer the other three decay back within a
quarter**, because the failure is a forgotten field and nothing else stops that.

## Hard constraints the design must respect

These are the things that will break a naive implementation.

1. **Virtualised lists.** A `<MemberName>` that registers its own query would
   register 500 observers in a 500-row member list. The provider must serve from
   an in-memory map first and fall back to a query only for detached surfaces.
   Non-negotiable; the member sidebar's no-fetch policy exists for this reason.
2. **Detached surfaces keep the per-space name. They are not scope-less.**

   > An earlier draft of this design claimed a bookmark or notification "has no
   > live roster, so a per-space override is unknowable" and proposed resolving
   > them globally. **That was wrong**, the operator rejected it as a
   > regression, and it is recorded here because the wrong version is the
   > tempting one and someone will re-propose it.

   Every input needed is already present and local:

   - `Bookmark` carries `spaceId` and `cachedPreview.senderAddress`
     (`quorum-shared/dist/types/bookmark.d.ts`).
   - The notification panel already carries `spaceId` per row.
   - The per-space name lives in the `space_members` roster in IndexedDB,
     readable with `messageDB.getSpaceMembers(spaceId)` — local, no network,
     ~1-5ms.

   **The mechanism already exists in this repo**:
   [`utils/resolveGlobalSender.ts`](../../src/utils/resolveGlobalSender.ts)
   builds a `(spaceId, senderId) → identity` lookup from exactly those rosters,
   carrying the per-space `display_name` AND the roster's `global_display_name`.
   The notification panel uses it today.

   So the real gap in those surfaces is the **QNS name**, not the per-space one —
   that file says so outright: *"`primaryUsername` stays optional as it is
   unenriched here."* Which is precisely what the operator observed on
   2026-08-10: everything worked after PR #325 except bookmarks and
   notifications.

   **Design consequence:** the identity provider is keyed on
   `(address, spaceId?)`, not on address alone. `spaceId` comes from context
   inside a Space and from the stored field on detached surfaces. Generalise
   `resolveGlobalSender` into the provider rather than leaving it as a
   notification-only side path, and add the QNS tier it lacks.

   The only genuine fallback is a space you have LEFT, where the roster row may
   be gone. Then, and only then, the global ladder applies — which is also the
   correct answer at that point.
3. **The membership/kicked gate is a security property and stays on the raw
   roster.** Today's `resolveSender` conflates "is this a current member?" with
   "what is their name?". Splitting them is part of this work; the gate must not
   move to the identity provider, which knows nothing about kicks.
4. **The fallback belongs to the resolver, never the caller.** Already
   documented at `useChannelMessages.mapSenderToUser` and violated twice today.
   With `MemberIdentity` requiring explicit `null`, a caller cannot substitute an
   address for a missing name.
5. **Offline.** DM identity currently renders from IndexedDB with no network
   round-trip. The provider must preserve that, not make names await a fetch.

## Migration order

Each step is independently shippable and independently verifiable.

1. **shared:** add `MemberIdentity` + `resolveIdentity`; keep the old exports as
   thin deprecated adapters so nothing breaks mid-migration.
2. **desktop:** build the provider + `<MemberName>` + `useResolvedName`. Prove
   it on ONE surface (the member sidebar — highest row count, so it also proves
   constraint 1).
3. **desktop:** migrate the remaining 27 files, deleting per-site resolver calls.
4. **desktop:** add the lint rule + guard test; remove the deprecated adapters.
5. **mobile:** same as 2–4 against the same shared rule.
6. **shared:** delete the deprecated adapters once both clients are off them.

Do NOT start at step 3. The whole value is that step 2 proves the provider can
serve a virtualised list before 27 files depend on it.

## How each step is verified

The operator cannot review a diff, so every step must end in something
observable or measured.

- **Steps 1–2:** unit tests on `resolveIdentity` (ported from the existing suites,
  which already cover the guard, the echo demotion and the tiers), plus a
  **measured** render count / query-observer count on the member sidebar before
  and after. That number is constraint 1's pass/fail.
- **Step 3:** the `/dev/fake-qns` sweep, with a **control arm** — one address
  pinned to a known non-QNS name. If the control row changes, the instrument is
  wrong, not the code. Surfaces to sweep are the eighteen already listed in the
  companion issue, which is exactly the regression checklist.
- **Step 4:** the guard test must be shown to FAIL by re-adding a direct resolver
  import. A guard that has never been seen red is not a guard.
- **Step 5:** mobile's `yarn harness:qns` two-bot scenario, because the receive
  side cannot be tested on one device.

## Decisions — settled with the operator 2026-08-10

1. **Scope comes from a context provider**, with an explicit prop as the override
   that detached surfaces use. Removes the whole "wrong ladder" class and keeps
   call sites to one argument.
2. **`<MemberName>` owns the avatar's initials too.** Stated by the operator as a
   rule rather than a preference: *the initials should always render whatever the
   displayed name is at that moment.* Several sites currently feed `UserAvatar` a
   raw name while the label beside it resolves, so they can disagree; folding
   them makes that unrepresentable.
3. **Do NOT design around the batch endpoint.** Checked the source rather than
   relying on recall: `docs/features/qns-username-display.md:143` lists it under
   *"Protocol improvements that would simplify this (lead-dev asks, pending)"*,
   and adds *"Neither blocks the feature."* So it has been **requested, not
   promised** — an earlier version of this section implied it was coming, which
   the source does not support.

   This turns out not to matter, and that is the useful finding: because the
   provider is the single place that fetches, adding batching later is a
   one-file change with no call-site churn. So build for one-at-a-time now and
   let it plug in if it lands. The consequence to accept meanwhile is that
   "sidebar lurkers show no `.q`" stays a limitation, since enriching a 200-member
   roster one request at a time is exactly the fetch storm the current policy
   exists to prevent.
4. **This absorbs the shared echo-demotion task.** The parity document blocks that
   task on naming the `display_name` contract; `spaceName` / `globalName` name it
   unambiguously. Delete that item rather than doing both, and say so in the
   parity document so it does not look dropped.

## What this does NOT change

- The `.q` suffix stays the only signal. No badge — settled 2026-06-10 and
  re-proposed twice since.
- The user still explicitly elects which `.q` to show; nothing elects for them.
- Wire formats are untouched. This is entirely a read/render-side change.

## Definition of done

- [ ] `MemberIdentity` + `resolveIdentity` in shared, with every field required
- [ ] Provider keyed on `(address, spaceId?)`, absorbing `resolveGlobalSender`
- [ ] Bookmarks and notifications show BOTH the per-space name and the `.q`
      (the two surfaces still wrong after PR #325)
- [ ] `<MemberName>` renders the avatar initials from the same resolved name
- [ ] Desktop provider serving a virtualised list with a MEASURED observer count
- [ ] All 28 desktop call sites migrated; zero direct resolver imports outside
      the identity module
- [ ] Lint rule + guard test, the guard shown red
- [ ] `/dev/fake-qns` sweep of all eighteen surfaces, with a control arm
- [ ] Mobile migrated against the same shared rule, verified with `harness:qns`
- [ ] Deprecated adapters deleted from shared
- [ ] The parity document's shared echo-demotion item deleted as absorbed (4)

---

*Last updated: 2026-08-10*
