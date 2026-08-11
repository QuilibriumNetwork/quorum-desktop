---
type: task
title: "Name resolution: an API that cannot express a partial identity"
status: in-progress
priority: high
created: 2026-08-10
updated: 2026-08-11
area: identity resolution / QNS / cross-client architecture
repos: quorum-shared (the rule), quorum-desktop (28 call sites), quorum-mobile (17 call sites)
source: written after fixing the same defect in ~18 places in one day; the operator asked for the elegant solution instead of a nineteenth patch
related:
  - ".agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md (the patches this supersedes)"
  - "quorum-mobile/.agents/issues/2026-08-06-qns-primary-name-work-and-desktop-parity.md (parity index; its shared-code section asks for exactly this spec)"
  - ".agents/docs/features/qns-username-display.md"
---

## Status

**2026-08-11 — desktop implemented, shipped in PR #327**

All four layers exist on desktop. Eight things in this document changed during execution; the
"Corrections after implementation" section at the end lists them and points at the plan's execution
record for detail. The two structural ones are worth naming here: nested identity scopes **merge**
with the enclosing scope rather than replacing it, and the root scope carries real roster and
local-name data rather than being an empty crash backstop.

Still open: the mobile port (step 6 of the migration order), which is unblocked but not started.

# Name resolution: an API that cannot express a partial identity

## START HERE if you are picking this up cold

**This document is ready to implement.** All four design questions are settled
(see "Decisions"); nothing here is waiting on an answer.

Read in this order and do not skip 2 — it is the one that stops you building the
wrong thing:

1. This file, whole. It is short.
2. **Constraint 2**, on detached surfaces. An earlier draft of this design got it
   backwards and is kept inline as a rejected note. If you find yourself about to
   resolve bookmarks with the global ladder, you have re-derived the mistake.
3. [`src/identity/identityProvider.tsx`](../../src/identity/identityProvider.tsx) —
   what Layer 2 became. It was built by generalising `utils/resolveGlobalSender.ts`,
   which the implementation then deleted; read the provider itself, not that file.
4. [`2026-08-10-name-surfaces-that-never-reached-the-resolver.md`](../2026-08-10-name-surfaces-that-never-reached-the-resolver.md)
   — the eighteen surfaces this must not regress, which doubles as the test
   checklist.
5. `.agents/docs/features/qns-username-display.md` for decisions already made
   (no badge; why the full roster is deliberately never fetched).

**State as of 2026-08-10:** PR #325 shipped per-site fixes for everything except
**bookmarks and notifications**, confirmed by the operator driving the app. Those
two are step 3 and are your first visible win. This design supersedes those
per-site fixes rather than adding to them — expect to delete code you find.

**Two standing rules on this subsystem**, both learned expensively here:

- Every fix needs a test shown to FAIL without it. Revert it, watch it go red,
  put it back. Four assertions written during this work passed either way.
- Label every claim MEASURED / READ / INFERRED. On this subsystem specifically,
  six confident readings were falsified by the operator simply using the app —
  including two in this document, which is why constraint 2 reads as it does.

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

One provider owning **`(address, spaceId?) → MemberIdentity`**, assembled from
the roster, the roster's global slots, and the public-profile cache. It is the
ONLY thing that knows how those merge.

`spaceId` is part of the key, not an afterthought: it is what lets a bookmark or
a notification show the per-space nickname (constraint 2). With no `spaceId` —
a DM, or a Space you have left — `spaceName` resolves to `null` and the ladder
continues to the QNS name.

**Build it by generalising `utils/resolveGlobalSender.ts`, not from scratch.**
(Written before implementation; that file no longer exists — the generalisation
landed as [`src/identity/identityProvider.tsx`](../../src/identity/identityProvider.tsx)
plus [`useMultiSpaceRosters.ts`](../../src/hooks/business/identity/useMultiSpaceRosters.ts),
and the file was deleted. The reasoning is kept because it explains the shape.)
That file already builds a `(spaceId, senderId) → identity`
lookup from `messageDB.getSpaceMembers`, already keeps the per-space name and the
global name separate, and is already used by the notification panel. It is
missing exactly one tier — the QNS name — which is why notifications show the
nickname but not the `.q`. Two things exist that should be one: this, and
`useMembersWithPublicProfileFallback`.

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
// JSX. Renders the name, the ".q" when verified, and — per decision 2 — the
// avatar initials from that SAME resolved name, so the two cannot disagree.
<MemberName address={addr} />
<MemberName address={addr} withAvatar />
<MemberName address={addr} spaceId={bookmark.spaceId} />   // detached surfaces

// Strings: aria-labels, notification bodies, tooltips, modal payloads,
// search-match text.
const name = useResolvedName(addr);
const name = useResolvedName(addr, { spaceId });
```

**Scope normally comes from an `IdentityScopeProvider`** mounted at the space/DM
boundary, so a call site inside a channel cannot ask for the wrong ladder and
passes one argument. The explicit `spaceId` prop is the override, used by the
detached surfaces that carry their own (bookmarks, the notification panel, the
bookmarks page) since they render outside any Space's provider.

Every current call site becomes one of these two. `ResolvedName`,
`formatResolvedName`, `resolveMentionPillName`, `resolveProfileCardName`,
`conversationMatchesSearch`, `selfNamePlaceholder` and the `UserAvatar`
`displayName` prop all collapse into them.

**Avatar initials are part of this component, not a sibling.** Today several
sites feed `UserAvatar` a raw name while the label beside it resolves, so a
member can render `gatto.q` next to a circle showing `G` for GattoPardo. The
operator stated the rule directly: *the initials should always render whatever
the displayed name is at that moment.* One component owning both makes the
disagreement unrepresentable. Note the initials must use the BARE name, not the
suffixed one — `getInitials` splits on non-letters, so `gatto.q` would yield two
initials from one name (mobile hit this; see its `resolveSelfName.ts`).

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

   **The mechanism already exists in this repo**: `utils/resolveGlobalSender.ts`
   (deleted by the implementation — this is the pre-implementation state)
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

## How the two repos are sequenced, and why it is safe

**Desktop first, then mobile.** Not a preference — it falls out of how each repo
consumes shared (READ from both `package.json` files, 2026-08-10):

| repo | dependency | effect |
|---|---|---|
| desktop | `link:../quorum-shared` | local symlink; a shared change applies on rebuild |
| mobile | `2.1.0-40` | pinned npm version |

So **desktop can make the breaking shared change without touching mobile.**
Mobile keeps building against the published version throughout, and there is no
window where one client is half-migrated against a shared package the other
cannot use. Desktop is the natural first mover because it is the only one that
feels shared changes immediately.

**What does and does not reach mobile** — worth stating precisely, because an
earlier draft of this section got it wrong in both directions:

| event | does mobile see it? |
|---|---|
| shared change merges to shared's `master` | **no** — mobile resolves its pinned version |
| lead dev publishes a new version to npm | **no** — mobile still pins the old number |
| someone edits **mobile's** `package.json` to the new version | **yes**, and only then |

So mobile is exposed at exactly one moment, and it is a deliberate PR in the
mobile repo — not a merge and not a publish. There is no way to break mobile by
accident from this side, which is what makes desktop-first safe. Mobile's bump and its
migration therefore happen in one PR, deliberately — which is the whole reason no
compatibility shim is needed.

**We never run `npm publish`.** That is the lead dev's job. Our shared-side work
ends at the `chore: bump to X.Y.Z-N` commit, which goes **direct on master as its
own commit after the feature PR merges** — never on the feature branch, because
squash-merge destroys it. Report the published version as blocked-on-lead-dev,
not as an open task. See `[[quorum-shared-workflow]]` in the private vault.

**Interop, the question to ask before shipping desktop:** *if this desktop build
meets today's mobile build, what happens?* Nothing — this design is entirely
read/render-side. No wire format, no synced config field, no protocol message
changes. Old mobile talking to new desktop is unaffected, which is the condition
`[[ship-both-clients-together]]` requires for a desktop-first release.

The cadence asymmetry behind all of this: desktop ships often and by us, mobile
rarely and only by the lead dev. Desktop reaching production well before mobile
is the normal case, not a failure — but parity remains the commitment, so step 6
is not optional, just later.

The link-versus-pin asymmetry already caused confusion once: the forged-suffix
guard landed in shared and reached desktop instantly via the symlink, while
mobile still carried its own duplicate copy because npm had not been published
past `2.1.0-39`.

## Why there are no adapters

An earlier draft kept the old shared exports as deprecated adapters "so nothing
breaks mid-migration". Both reasons for that turned out to be wrong, and the
correction matters because adapters are the expensive, obvious-looking choice.

**It was never about protecting mobile.** Mobile pins a version; it is unaffected
by shared's master and by a publish alike (see the table above). It cannot be
broken from this side.

**It was about keeping desktop compiling, and that fear was ~28× too big.**
MEASURED by grep, 2026-08-10: **exactly one file per repo imports
`resolveDisplayName` from shared** — `src/utils/resolveMemberName.ts` on desktop,
`utils/resolveMemberName.ts` on mobile. The other 27 desktop call sites import
desktop's own local module, not shared. So a breaking change to shared breaks a
single file, which step 1b fixes in the same session.

That local module is the seam the whole migration runs through: it can keep its
current exports while its internals switch to `resolveIdentity`, so steps 2-5 are
pure desktop work with shared already settled.

**And an adapter would actively hurt.** The thesis of this design is that a
partial identity must be impossible to express. A compatibility shim preserving
the old permissive signature preserves exactly the hazard, and Layer 4's lint
rule cannot be switched on while a legal way to call the old API still exists.
The shim would delay the only thing that stops this regrowing.

When mobile migrates (step 6) it fixes its one file the same way, in the same PR
as its version bump.

## Migration order

Each step is independently shippable and independently verifiable.

1. **shared:** change `resolveDisplayName` into `resolveIdentity` over a required
   `MemberIdentity`. **Breaking, deliberately, and with no compatibility shim** —
   see "Why there are no adapters" below. Follow the shared repo's own workflow:
   feature branch, PR, squash-merge, then `chore: bump to X.Y.Z-N` as a
   **separate commit direct on master** (a bump on the feature branch is
   destroyed by the squash). Do not publish; that is the lead dev's step and the
   shared-side work is done at the bump.
1b. **desktop, same session:** update the ONE file that imports it
   (`src/utils/resolveMemberName.ts`). Desktop compiles again immediately. This
   is not a migration, it is a signature fix at a single import.
2. **desktop:** build the provider + `<MemberName>` + `useResolvedName`. Prove
   it on ONE surface (the member sidebar — highest row count, so it also proves
   constraint 1).
3. **desktop:** migrate **bookmarks and notifications first**. They are the only
   two surfaces still known-wrong after PR #325, the operator has confirmed every
   other surface renders correctly, and they are the ones that exercise the
   `spaceId` override. Fixing them early converts this plan from "a refactor you
   have to take on faith" into "the two broken screens now work", which is the
   only evidence the operator can actually check.
4. **desktop:** migrate the remaining ~25 files, deleting per-site resolver calls.
5. **desktop:** add the lint rule + guard test. Nothing to un-deprecate, because
   nothing was deprecated — the old API stopped existing at step 1.
6. **mobile:** fix its one shared-importing file, then the same as 2–5, in the
   same PR as its version bump.

Do NOT start at step 4. The whole value is that step 2 proves the provider can
serve a virtualised list, and step 3 proves it fixes something visible, before
25 files depend on it.

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

Ticked 2026-08-11, after PR #327 and the three independent reviews below.

- [x] `MemberIdentity` + `resolveIdentity` in shared, with every field required
- [x] Provider keyed on `(address, spaceId?)`, absorbing `resolveGlobalSender`
- [x] Bookmarks and notifications show BOTH the per-space name and the `.q`
      (the two surfaces still wrong after PR #325). Notifications were confirmed
      by the operator in the running app; **bookmarks by tests only** — that is
      why `2026-08-10-name-surfaces-that-never-reached-the-resolver.md` is still
      open rather than in `.done/`.
- [x] `<MemberName>` renders the avatar initials from the same resolved name
- [x] Desktop provider serving a virtualised list with a MEASURED observer count
      (`identitySidebarFetch.test.tsx` — 0 / 1 / 200)
- [x] All 28 desktop call sites migrated; zero direct resolver imports outside
      the identity module. The real count was higher: "28" came from counting
      resolver imports and undercounted by roughly 40%.
- [x] Lint rule + guard test, the guard shown red
- [ ] `/dev/fake-qns` sweep of all eighteen surfaces, with a control arm —
      **NOT DONE.** Ad hoc operator testing substituted for it and found eight
      further bugs, which is itself evidence the substitution was not equivalent.
- [ ] Mobile migrated against the same shared rule, verified with `harness:qns`
- [ ] The parity document's shared echo-demotion item deleted as absorbed (4) —
      unverified either way at close-out; the parity issue has since moved to
      `.done/`, so check there before assuming.

## Corrections after implementation (2026-08-11)

Desktop is implemented and shipped. **Eight things in this document changed during execution.** The
full record, with measurements and the bugs that forced each change, is the **"What actually
happened"** section at the end of [the plan](2026-08-10-identity-resolution-architecture-plan.md).
Read that before porting to mobile; this list is the index to it.

**1. Fetching is opt-in.** Layer 3's `<MemberName>` resolves from in-memory maps by default and takes
an explicit `enrich` prop to fetch a public profile. Constraint 1 asked the provider to "serve from an
in-memory map first"; the first implementation still requested per row, and a 200-member space
MEASURED 200 concurrent requests on open.

**The member sidebar is the ONLY surface that never enriches.** The mention autocomplete and invite
pickers were excluded alongside it at first, which was over-conservative and has been reversed —
they cap their candidate lists, so enrichment there is bounded and demand-driven. Decision 3's
accepted limitation ("lurkers show no `.q`") therefore applies to the sidebar alone, and the batch
endpoint remains the only thing that would fix it.

**2. Layer 2 gained a fourth identity source: locally-known names.** A DM partner with no published
public profile is in no roster and has no profile tier, so they resolved to a truncated address —
violating constraint 5. A locally-known-names map, built from local conversation records, feeds
`globalName` as its LAST source.

**3. Self needs its own last resort.** Reading self's name from `currentPasskeyInfo` was correctly
removed (it carries no QNS name, and caused four bugs), but desktop never publishes a display name —
so a user with no published profile then had no name source at all and rendered as their own address.
The device display name is now the final `globalName` source for self, below the published profile,
and can never supply a `.q`.

**4. Placeholder names must be filtered before they enter a tier.** A stored conversation name is
sometimes the peer's own address, its truncated form, or the literal "Unknown User". If one reaches
the locally-known-names map, the resolver treats it as a real name and renders a FULL raw address —
strictly worse than the truncated address it would have produced itself.

**5. Layer 3 has a third API**, `useNameResolver`, for resolving many addresses imperatively (raw-DOM
mention pills, search filters, sort keys). Hooks cannot be called per row, and letting each call site
assemble the answer itself is the defect this design exists to remove.

**6. Nested providers MERGE with the enclosing scope; they do not replace it.** This is the largest
correction to Layer 2. Four separate surfaces shipped mounting a provider with strictly less data
than the one above them, each silently rendering members as raw addresses, each found by the operator
by hand. Merging makes "a provider supplies less than its parent" unrepresentable.

`defaultSpaceId` is deliberately **not** merged — it is always the provider's own prop. That is what
stops a DM inheriting a per-space nickname now that the root carries every space's rosters.

**7. The root provider carries real data.** Mounting one above the router was originally a crash
backstop with empty rosters. That is not sufficient: anything rendered from an app-level host
(modals, confirmations, toasts) inherits it, so it must carry every space's rosters and every DM
partner's local name — local IndexedDB reads on existing query keys, gated on auth, non-suspending.

**8. Layer 4 gained a runtime half.** The lint rule only sees imports, so it cannot see a surface that
renders a raw identity field without importing anything — which is where most of the late bugs were.
Two instruments close that: a checked-in audit test that fails when a file renders a raw name field,
and a dev-build diagnostic that reports any resolution degrading to the address fallback, with a live
counter on `/dev/identity-coverage`. **Build both before migrating call sites, not after.**

**And one correction to the analysis rather than the design:** the "28 call sites" figure came from
counting resolver imports, which undercounted by roughly 40%. Surfaces that render a raw identity
field without importing anything were invisible to that count, and equally invisible to Layer 4's
lint rule. Three further waves were found afterwards — the app shell, a second tranche found by
audit, and message-body mentions.

**One contract this document never stated, and every client needs:** a DM's `spaceId` IS the peer's
address (`spaceId === channelId === peerAddress`). Any surface reachable from both a channel and a DM
that passes a `spaceId` into an identity scope will query a space that does not exist, get an empty
roster, and force the space ladder where the global one is correct.

---

*Last updated: 2026-08-11*
