---
type: task
title: "DM identity: teach desktop the other wire dialect, then give it the same reveal ledger mobile has"
status: in-progress
priority: high
created: 2026-08-20
updated: 2026-08-20
area: DM identity / privacy / cross-client parity
repos: quorum-desktop (Tasks 1-3), quorum-shared (Task 4 — additive type change, needs a publish)
related:
  - "quorum-mobile/.agents/issues/2026-08-18-dm-identity-reveal-ledger-plan.md (the mobile half, shipped; §D and §S there are the source of this plan)"
  - "issues/2026-08-01-dm-partner-identity-lost-on-established-sessions.md (the established-session measurement both plans build on)"
  - "issues/.done/2026-08-01-identity-announce-cadence-research.md (why the send gate has a cap; the ledger sits beside it, not inside it)"
---

# DM identity on desktop: the dialect fix, then the privacy rule

## Status

Implemented 2026-08-20 on branch `feat/dm-identity-reveal-ledger`
(quorum-desktop) and `feat/dm-profile-primary-username` (quorum-shared).
Not yet merged, not yet reviewed by the lead dev.

**Tasks 1-4 are all done.** One verification item could not be built in this
repo (§Left out, below).

### What shipped

| Task | Where | Notes |
|---|---|---|
| 1 | `src/utils/dmProfileWire.ts`, intercept in `MessageService.ts` | Both dialects parse; wrapped wins; spoofed frames consumed, not rendered. |
| 2 | `src/utils/dmRevealLedger.ts`, sweep filter, `recordRevealAndAnnounce` | Fail-closed ledger; sweep gated per partner; consent recorded on deliberate sends. |
| 3 | `maybeAutoRevealToPartner`, `automaticFrameIdentityAudit.test.ts` | 1h debounce; audit covers payload AND envelope identity args. |
| 4 | `quorum-shared` `DMUpdateProfileMessage.primaryUsername`, `Conversation.claimedPrimaryUsername` | Envelope ambiguity documented on the type. Published: NOT yet (see below). |

### MEASURED, production relay, 2026-08-20

`yarn harness dm-reveal` and `yarn harness dm-auto-reveal`, both with a
control arm so a dead bench cannot read as a pass.

| Run | Observation |
|---|---|
| Fixed | `[DMProfile] broadcast to 0/1 partner(s) — 1 unrevealed (skipped)`; stranger's row stayed `"Unknown User"`; one reply then delivered the real name |
| Sweep filter reverted | `broadcast to 1/1 partner(s)`, and the leaked name landed on the stranger's row |
| Auto-reveal, fixed | 1 push after the 1st new session, still 1 after the 2nd |
| Debounce reverted | 2 pushes after the 1st, 4 after the 2nd — the redelivery storm, observed rather than argued |
| Auto-reveal ledger check reverted | the stranger learned B's name |
| Dialect fix reverted | 6 unit tests red, and only the wrapped-dialect ones |
| Identity field added to a delivery-ack | audit test red on both the runtime and the source arm |

Unit suite: 1583 passing across 170 files. `tsc --noEmit` clean, `yarn lint`
0 errors. quorum-shared: 696 passing.

### One finding worth carrying forward

The auto-reveal RED proof caught a hole in the **harness scenario itself**:
with the ledger check removed, the leak genuinely happened *and the test
still passed*, because the leak arrived carrying a different string than the
one the assertion named. Phase 1 now asserts the stranger learned **no real
name at all** (`isPlaceholderDisplayName`), not merely "not the string I
expected". A leak test that names the expected value can only catch the leak
it already imagined.

### Also fixed, not predicted by the plan

Desktop's `deleteConversation` emits a `delete-conversation` reset signal
through `submitMessage`, which creates an init envelope carrying
`displayName` / `pfpUrl`. Deleting a spammer's thread therefore unmasked
you, possibly with the first frame they ever received from you. Same shape
as the mobile trap §Task 2 step 4 warned about, found by auditing rather
than by assuming the send path was the only one. Identity is now withheld at
every session-creating call when the partner is not already revealed.

### Answering the "Not a task" question (§ before §Q)

> Can `secureChannel` emit an init-carrying frame without a deliberate user
> act behind it?

**No — and E9 needs a correction.** Identity is NOT produced by the crypto
layer on its own: every init-carrying call site takes it as an *app-code
argument*. READ 2026-08-20, all six sites: `NewDoubleRatchetSenderSession`,
`DoubleRatchetInboxEncrypt` and `DoubleRatchetInboxEncryptForceSenderInit`
inside `submitMessage` and `retryDirectMessage`, each passed
`currentPasskeyInfo.displayName` / `.pfpUrl`. Both methods are reachable only
from a deliberate act. The automatic paths (typing, receipts, the profile
push) go through `encryptAndSendDm`, which passes `undefined` unless a caller
supplies a name.

So the rule IS fully enforceable at desktop's app layer, and it now is — this
is what made the delete-conversation fix a local edit rather than a
crypto-layer conversation. No sign-off needed on this point.

### The review pass changed the shipping story

A six-reviewer pass (review-router) ran after the four tasks were committed. Two
reviewers returned "clean to merge". They were wrong, and the thing that showed
it was a harness run, not a reading.

**Two exploitable vulnerabilities were found and measured on the production
relay, both rooted in the same untrusted field.** They are written up in
`.agents/issues/.secret/` (gitignored — this repo is public) rather than here.
Both are now fixed outright. Read that file before treating this plan as closed.

### The scope grew again: quorum-mobile, and a deeper fix in both clients

The first round of fixes closed the measured attacks but left a residue, and had
not looked at the sibling client. Both were followed up:

- **quorum-mobile was checked and carried BOTH vulnerabilities.** Its reveal
  ledger was desktop's pre-fix function verbatim, and both of its
  `delete-conversation-self` gates were payload-only. Fixed on branch
  `fix/dm-trust-the-authenticated-sender`, with its own red-on-revert proofs.
- **The mitigation was replaced by a cure.** The ed448 self-authorship check was
  removed in favour of `Message.authenticatedSenderId` — a marker stamped at
  persist time from what the crypto layer authenticated, never read off the
  wire. The signature approach was replayable (a DM messageId does not commit to
  the conversation, and a space co-member can see messages we signed there), and
  keeping it beside the marker would have meant "marker OR signature", which is
  only as strong as its weakest branch. Deleted rather than kept.

That change touched all 20 of desktop's `saveMessage` call sites, because the
new argument is required rather than optional. Making it required is what
surfaced three sites where the pre-existing optional `currentUserAddress` would
have silently rebound onto the new security field with no type error at all.

**Publish ordering, and why it does NOT gate mobile.** quorum-mobile pins a
published `@quilibrium/quorum-shared` (`2.1.0-43`) rather than a local link, so
the new field was initially invisible there and the branch did not typecheck.
Blocking on a release was rejected: a branch that does not compile is not
shippable, and the shared publish is not imminent. Mobile therefore declares the
field locally (`services/dm/storedMessage.ts`) and compiles, tests and ships
against the currently published package, with a note to collapse the local type
once a release carries the field. Desktop links the local checkout and was never
affected. **All three branches are independently shippable in any order.**

Three further real findings, fixed in `b38cc948d`:

- **The reveal gate was enforced per caller, and the audit missed three.** The
  offline action-queue handlers (`reaction-dm`, `delete-dm`, `edit-dm`) passed
  the user's real name and avatar straight to the wire. Reacting to a stranger's
  first message while offline was enough to unmask you. The gate now lives in
  `encryptAndSendDm`, the chokepoint every DM identity emission passes through.
- **Auto-reveal had a debounce race** — the stamp is set after two awaits, so
  two new-session frames could both pass the check. It now claims the partner
  synchronously first.
- **Identity-push failures were all logged at `debug`**, which production
  diagnostics never show. Real failures now log at `warn`; only the expected
  "no session yet, this is first contact" case stays at debug.

Plus: a shared-type field was renamed to `claimed_primary_username` before
publish, because mobile already uses that exact key in 23 files and the
camelCase spelling would have described a field no mobile row carries.

### Left out, and why

**The `dm-reveal-cross` scenario (Task 1's cross-client verification).** It
requires a mobile-side jest scenario that renames, driven by
`run-cross.mjs` — and `run-cross.mjs` states, deliberately, that
quorum-mobile is not modified by this repo. This plan's own header scopes
Tasks 1-3 to quorum-desktop. Building only the desktop half would leave an
unrunnable file in the tree.

What covers the gap meanwhile: the wrapped dialect is unit-tested against
mobile's exact envelope shape (copied from
`dmProfileService.ts:99`), the ghost-row contract is pinned, and both
reveal scenarios run end-to-end on the real relay. What is NOT covered: that
a real mobile client's bytes parse here. That needs one small scenario in
quorum-mobile plus an orchestrator; it is the natural next task.

**Task 4 is coded but NOT published.** `@quilibrium/quorum-shared` is built
locally (`dist` regenerated) and desktop resolves it through the
node_modules symlink, so it typechecks and runs here. A real release needs a
publish and a version bump in each client. The `primaryUsername` value is
already applied into `Conversation.claimedPrimaryUsername` on receive, so
nothing further is needed in desktop once the package lands.

## Why this exists

Mobile shipped a branch that does two things: it repaired the cross-client
`dm-update-profile` break in the **desktop → mobile** direction, and it made the
DM privacy rule an explicit, persisted **reveal ledger**.

Neither half exists on desktop. The first is a bug that is worse on this side
than the one mobile fixed. The second means a privacy rule the product now
claims is only true on one of its two clients.

## The rule being enforced

Stated by the operator, 2026-08-19:

> The **sender**'s identity IS shown to the receiver. It's just the **receiver**'s
> identity that is not shown until they reply, unless they already had previous
> conversations or sessions with the same sender.

Three consequences, each load-bearing:

1. **Initiating is itself the consent.** Messaging someone, or calling them,
   reveals you to them. Intended, not a leak.
2. **The asymmetry is the point.** They do not see *you* back until you
   deliberately engage. A reply, or answering a call, is that act.
3. **Consent belongs to the relationship, not the session.** Once you have ever
   deliberately messaged someone, any new device of theirs is answered without
   asking you again.

The failure mode all of it prevents: **a spammer harvesting your identity by
merely messaging or ringing you.** Your client answers automatic frames on its
own (delivery receipts, read acks, ICE candidates, hangups). If any carried
identity, being contacted would be enough to unmask you.

**So the invariant is: an automatic frame reveals nothing. Ever.**

---

## §E. Evidence — all READ against this repo on 2026-08-19/20

The predecessor to this plan was a four-item prediction written without opening
this repo, and two of its four items were wrong. Everything below has a verified
anchor. **If you find one stale, fix the anchor here rather than working around
it.**

| # | Fact | Anchor |
|---|---|---|
| E1 | The control intercept binds `const raw = decryptedContent as any` and tests `raw.type`. It never reads `raw.content.type`. | `src/services/MessageService.ts:855`, `:907` |
| E2 | When the intercept returns false, control reaches `saveMessage`. A frame it does not recognise is **persisted**, not dropped. | `src/services/MessageService.ts:6399`; sibling path `:4196` |
| E3 | Mobile emits a full `Message` envelope with **no top-level `type`** and the payload under `content`, with a synthetic `messageId` (`dm-profile-<nonce>`). | `quorum-mobile/services/dm/dmProfileService.ts:99` |
| E4 | `broadcastProfileToAllDMs` enumerates every `type: 'direct'` conversation and pushes identity to each. Its only gate is the byte-identical dedup. | `src/services/MessageService.ts:677`, loop `:696`, gate `:715` |
| E5 | `rebroadcastProfileToAllDMsOnConnect` calls E4 on every reconnect, with no user action behind it. | `src/services/MessageService.ts:768` |
| E6 | No reveal ledger exists. `grep -rl "RevealLedger\|hasRevealedTo\|ensureRevealBootstrap" src/ .agents/` returns **zero files**. | MEASURED 2026-08-19 |
| E7 | Automatic frames carry no identity **today**: the typing forwarder passes a `TypingMessage` unchanged, and the ack branches carry no profile fields. Held by accident, not by a test. | `:630`, `:861`, `:873` |
| E8 | The inbound init-carrying decrypt branches — where an authenticated sender's new session is first seen — are `result.user_profile` and `maybeInit.user_profile`. | `src/services/MessageService.ts:4513`, `:4589` |
| E9 | Desktop's outgoing identity rides `secureChannel`'s `user_profile` on the init-carrying variant, NOT per-message app code. | `src/services/MessageService.ts:754-758` |
| E10 | The `display_name` writes near the DM send are **local DB writes recording the PARTNER's identity onto the conversation row**, not the outgoing envelope. Do not "fix" them. | `:3844-3848`, `:3868-3873` |
| E11 | Gate state persists in `localStorage` under a `quorum:`-prefixed namespace. The ledger should sit beside it, same mechanism. | `src/utils/profileSendGate.ts:28`, `:153`, `:193` |
| E12 | The harness runs **two bots in ONE process** (`createBot('alice-bot'), createBot('bob-bot')`), unlike mobile which needs two. A desktop-only two-party scenario is a single vitest file. | `src/dev/tests/harness/dm-basic.scenario.test.ts:27-28` |
| E13 | `yarn harness:cross` already pairs **mobile's jest scenario with desktop's vitest scenario** through a shared rendezvous directory. Cross-client behaviour is provable, not just arguable. | `src/dev/tests/harness/run-cross.mjs` |
| E14 | `shared`'s `DMUpdateProfileMessage` declares only `senderId`, `type`, `displayName`, `userIcon`, `bio`. No `primaryUsername`. | `quorum-shared/src/types/message.ts:51-57` |

---

## Global Constraints

1. **The ledger fails CLOSED.** Storage error, malformed identifier, any
   uncertainty ⇒ *not revealed*. This is deliberately the OPPOSITE posture from
   `profileSendGate` / `dmProfileGate`, which fail OPEN because their worst case
   is a harmless duplicate push. **Do not unify them.** Both are correct for
   their own risk.
2. **Never persist a negative.** "Not revealed yet" is the absence of a record,
   so a later reply can still flip it.
3. **Key encoding must be injective.** Use `JSON.stringify([self, partner])`,
   never `` `${self}:${partner}` ``. Addresses cannot contain a colon today, but
   nothing *enforces* that, and the failure mode of a collision is fail-OPEN —
   the one direction this feature must never fail.
4. **Automatic frames never carry identity.** Receipts, typing, ICE, hangup,
   renegotiation, key rotation. E7 says this holds today; the audit task pins it.
5. **Prove every guard can fail.** Break the protection deliberately, confirm the
   test goes red, restore. An assertion that passes either way is worse than no
   test. The mobile side shipped an unfalsifiable fail-closed proof the first
   time and had to rebuild it — the mock storage could not throw, so the safety
   branch was unreachable from any test.
6. **Do not touch E10's local DB writes.** They look like identity emission and
   are not.
7. Follow the repo's existing conventions for logging (addresses truncated, never
   raw) and for harness scenarios.

---

## Task 1 — Desktop reads the other dialect, and stops storing junk

**User-visible outcome:** rename yourself on mobile; the new name and avatar
appear in that DM on desktop. And no stray message appears in the conversation.

### The problem

Two dialects of `dm-update-profile` are live on the network:

```
FLAT     { type: 'dm-update-profile', senderId, displayName, userIcon, bio? }
         ← what desktop sends, same family as its flat receipt acks

WRAPPED  { messageId, content: { type: 'dm-update-profile', ... } }
         ← what mobile sends
```

Desktop tests `raw.type` only (E1). Mobile's envelope has no top-level `type`
(E3), so the branch is false, the intercept returns false, and the frame reaches
`saveMessage` (E2).

**It is persisted as a message in the conversation.** That is strictly worse than
the desktop→mobile failure mobile just fixed, which at least consumed the frame
cleanly.

### Steps

1. **Measure the current damage first.** Run the reproduction (below) against
   unmodified code and record what actually happens: does a bubble render, does
   the conversation preview change, does an unread badge appear? The plan asserts
   the frame is *persisted* (E2, READ) and does **not** claim to know how it
   looks. Write down what you see — it decides whether this is also a visible-bug
   fix or only a silent-data one.
2. Extend the 1d intercept at `:907` to match **either** shape. Mobile's
   `parseDmProfileUpdate` (`quorum-mobile/services/dm/dmProfileWire.ts`) is the
   reference: **wrapped is checked first and wins** if both are somehow present,
   because the content payload is the authored one.
3. Feed both shapes into the existing `handleDMProfileUpdate`. Keep the
   anti-spoof check — `senderId` must equal the authenticated envelope sender —
   and keep returning `true` even on mismatch, so a spoofed frame is consumed
   rather than rendered.
4. Extract the shape-matching into its own small module with its own unit tests,
   mirroring mobile. `MessageService.ts` is already ~7000 lines; this is the kind
   of logic that should be testable without it.

### Verification

- **Unit:** wrapped parses; flat parses; wrapped wins when both present;
  `delivery-ack`, `read-ack`, `typing-start`, an ordinary post, `{}` and `null`
  all return no match.
- **The ghost-row test, and it is the important one:** assert `saveMessage` is
  **NOT** called for a wrapped profile frame. Without this, the fix could
  intercept correctly and a future refactor could silently restore the
  persistence.
- **Cross-client, real relay (E13):** a new `dm-reveal-cross` scenario driven by
  `run-cross.mjs`. Mobile renames; desktop asserts (a) its conversation row now
  carries the new name, and (b) its captured-message list gained nothing.
- **RED proof:** revert step 2, confirm both the ghost-row test and the cross
  scenario fail. Restore.

---

## Task 2 — The reveal ledger, and the sweep that respects it

**User-visible outcome:** a stranger messages you and you don't reply. You change
your display name. They still see only your address. Reply once, and they see
your name from then on, including on any new device they set up.

### The problem

Desktop has no ledger at all (E6), and its broadcast sweep pushes identity to
**every conversation row** (E4). A row is created by a *stranger's inbound
message*, so having a row is not consent.

**So on desktop today, changing your display name announces you to people you
have never replied to.** And `rebroadcastProfileToAllDMsOnConnect` (E5) fires it
on every reconnect, with no user action behind it.

This is the same leak mobile closed, reproduced there live on the production
relay: `broadcast to 1/1 partner(s)` with the stranger in the target list.

### Steps

1. **Port the ledger.** Mobile's `services/dm/dmRevealLedger.ts` is the contract:

   | Export | Purpose |
   |---|---|
   | `hasRevealedTo(self, partner)` | fail-CLOSED read |
   | `recordReveal(self, partner, now)` | set on a deliberate act |
   | `clearReveal(self, partner?)` | partner omitted ⇒ clear all for self |
   | `messagesContainSelfAuthored(messages, self)` | pure, unit-testable |
   | `ensureRevealBootstrap(self, partner, getMessages)` | derive once from history |

   Persist in `localStorage` beside the send gate (E11), its own namespace. Honour
   Global Constraints 1-3.

2. **Bootstrap from history.** Conversations predate the ledger, so
   `ensureRevealBootstrap` answers "have I ever sent in this conversation?" by
   scanning stored messages for one authored by self, via
   `messageDB.getMessages` (`src/db/messages.ts:679`). It caches a positive and
   **never** persists a negative.

3. **Filter the sweep.** In `broadcastProfileToAllDMs` (`:696`), run each partner
   through `ensureRevealBootstrap` and skip when false. Keep the existing dedup
   gate — the two are independent and both wanted. Keep the summary log line, and
   make sure the skipped count is visible: mobile's reads
   `broadcast to 0/1 partner(s)`, which is what makes the guard observable in a
   harness run.

4. **Record consent on deliberate sends.** Find every path where the user
   deliberately initiates or replies and call `recordReveal` there. **Audit for
   this rather than assuming the send path is the only one** — on mobile the
   *delete-conversation signal* turned out to emit an init envelope with
   `display_name` attached, to a stranger, as the first frame ever sent them.
   Nobody predicted it. Check at minimum: send, edit, delete-message,
   delete-conversation, reactions, and call offer/answer.

5. **Per-device, not per-account.** A message sent from device A syncs to device B
   and is stored there with your own senderId, but nothing on B records a reveal.
   `ensureRevealBootstrap` scanning local history is what makes B answer
   correctly — and it is a *verified* reason rather than an assumed one. Do not
   shortcut it to "a self-authored message exists, therefore consent".

### Verification

- **Unit:** fail-closed on a throwing store. Build this the hard way — the mock
  must genuinely throw. Mobile's first attempt used a store that *could not*
  throw, so the safety branch was untested while appearing covered.
- **Harness, one file (E12):** two bots in one process. A messages B; B does not
  reply; B renames; **assert A's stored conversation row does not carry B's new
  name**. Then B replies once and A's row must gain it.

  **Both arms are required.** A dead bench produces "the stranger learned
  nothing", which reads as a pass. The reply arm proves the same pair and wire
  *can* carry a name, so the first arm's silence is a decision rather than a
  failure. Use two different strings so it is never ambiguous which arm delivered.

  **Assert the preconditions too:** B must actually hold a row for A, and A must
  hold a row for B. Mobile's first run failed exactly here — its send path only
  *updates* a conversation row and never creates one, so the observing bot had no
  row and could not have seen a leak even if one were pushed. Check desktop's
  equivalent before assuming.

  Reference implementation: `quorum-mobile/dev/harness/dm-reveal-two-bot.scenario.ts`.

- **RED proof:** remove the step-3 filter, confirm the harness reports the leak,
  restore. Mobile's equivalent flipped from `broadcast to 0/1` to
  `broadcast to 1/1` with the name arriving — that is what a real red looks like.

---

## Task 3 — Auto-reveal to a known partner's new device, and pin the audit

**User-visible outcome:** a friend you have messaged before reinstalls the app.
Their new device shows your name without you having to do anything. Meanwhile a
stranger's delivery receipts still tell them nothing about you.

### Steps

1. **Auto-reveal.** At the inbound init-carrying branches (E8: `:4513`, `:4589`),
   the authenticated sender is known and a new session has appeared. If the
   ledger says this partner is already revealed, push identity once.

   - Use the **authenticated envelope sender**, never a self-declared field.
   - Guard against self.
   - Debounce (mobile uses 1h). Init envelopes can be redelivered, and without a
     debounce one new device becomes a push storm.
   - Never let it throw into the receive path.

2. **Pin the automatic-frame audit.** E7 says receipts and typing carry no
   identity today. That is currently true *by accident*. Add a test that fails if
   any automatic frame gains an identity field — a static source-grep is
   acceptable and mobile has six precedents for the pattern.

   The frames in scope: delivery-ack, read-ack, typing-start/stop, ICE
   candidates, hangup, call events, renegotiation answers, key rotation.

### Verification

- Harness: B has previously messaged A. A's session is reset / a second device is
  introduced. B pushes identity once, unprompted, and **once only** — assert the
  count, not just the presence, or the debounce is untested.
- The audit test must fail when an identity field is deliberately added to a
  receipt. Prove it.

---

## Task 4 — `quorum-shared`: name the field, document the ambiguity

**User-visible outcome:** a `.q` primary name elected on mobile can reach desktop
at all. Today the field is dropped in transit.

> **Sequencing:** additive and safe, but it needs a **publish** of
> `@quilibrium/quorum-shared` and then a version bump in each client. Nothing in
> Tasks 1-3 is blocked on it. Do it last, or in parallel if someone else owns the
> release.

### Steps

1. **Add `primaryUsername?: string`** to `DMUpdateProfileMessage` (E14). Mobile
   already sends it, through an `as DMUpdateProfileMessage` cast with a comment
   acknowledging the field is additive and untyped. Desktop cannot see it even
   after Task 1 lands, because the type does not admit it.

2. **Document the envelope ambiguity on the type itself.** The type describes the
   *fields* and says nothing about whether the payload travels flat or wrapped.
   That silence is precisely how two clients shipped opposite answers without
   either being wrong.

   **Do NOT pick a winner here.** Which dialect is canonical is a wire decision
   and belongs to the lead dev (§Q1). What this task records is the *fact* that
   both exist and that receivers must be liberal. That is true regardless of how
   the decision goes, so it can land now.

3. After publishing, bump the pin in each client and apply `primaryUsername` in
   desktop's `handleDMProfileUpdate`. Store it under a **claimed** key, never as
   the verified one — mobile keeps it as `claimed_primary_username` precisely so
   an unverified claim cannot render on a surface that skips verification.

### Verification

- The cross-client harness from Task 1, extended: mobile elects a primary name,
  desktop's row carries it **under the claimed key**, and it does not appear in
  the verified slot.

---

## Not a task — the question that has to be answered first

**Desktop's outgoing identity is not app code.** Mobile's fix worked because
mobile hand-attaches `display_name` / `user_icon` to its init envelopes, so
gating them is a local edit. Desktop's rides `secureChannel`'s `user_profile` on
the init-carrying variant (E9), produced by the crypto layer during session
establishment.

Under the rule, *initiating is consent*, so identity on a **first outbound** init
is correct and needs no gate. The open question is narrow:

> Can `secureChannel` emit an init-carrying frame without a deliberate user act
> behind it?

If no, there is nothing to do. If yes, the reveal rule is not fully enforceable
at desktop's app layer, and that is a crypto-layer conversation, not a patch.
**Answer this before writing any code against it.**

---

## §Q. Open questions for the Lead Dev

1. **Canonical wire shape** for `dm-update-profile`. Now urgent rather than
   academic: E2 shows the ambiguity produces persisted ghost rows, not just
   untidiness. Receivers stay liberal for at least one release cycle either way.
2. **Receiver-driven `request-profile`** (a new control type in shared): the
   deterministic backstop for every remaining miss, ledger-gated on the responder
   side. This repo's own cadence research already ranked it best-shape. A wire
   change, so a sign-off.
3. **Deleting a conversation:** should it `clearReveal` for that partner? Product
   call, one line either way. Whatever is decided should match mobile.
4. **Scope:** the rule is DM-only — in a Space, joining is the consent. Both plans
   assume yes.
5. **E9 / the section above:** can `secureChannel` emit an init without a
   deliberate act?

---

## Estimated effort

Four tasks. On the subagent-driven cadence this repo's two prior identity plans
were measured at, that is roughly **3 hours of wall clock** (~45 min per task),
with Task 2 the largest and Task 4 gated on a package publish rather than on
work. The task count is a fact; the hours are an extrapolation from a narrow
sample.

---
*Last updated: 2026-08-20*
