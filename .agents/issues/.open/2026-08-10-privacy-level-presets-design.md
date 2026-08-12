---
type: task
title: "Privacy level: one named level over the toggles that expose you outside a conversation"
status: open
priority: medium
created: 2026-08-10
updated: 2026-08-10
area: privacy UX / cross-client parity
repos: quorum-desktop + quorum-mobile
related:
  - ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
  - ".agents/docs/features/privacy-settings.md"
  - "../quorum-mobile/.agents/issues/.open/2026-07-24-typing-indicators-and-toggles-port.md"
depends_on:
  - "quorum-mobile: typing indicators + global toggles port"
  - "quorum-mobile: generateYouTubePreviews toggle (NOT YET FILED)"
blocks: []
---

# Privacy level

> **This file replaces the 2026-08-10 seed.** The seed recorded an inventory and
> six open questions. All six are answered below, plus three the seed did not
> ask. The design was settled in conversation on 2026-08-10 with three
> independent reviews commissioned mid-way; §9 records what they changed.

## 1. What ships

One named **Privacy level** in Settings → Privacy, sitting above the five
toggles it governs, with a live description of what the current level actually
does. Two levels plus a derived Custom.

```
[●]  Enable sync                                          (i)
     Last synced 2 minutes ago
[●]  Always sign Direct Messages                          (i)
[ ]  Public profile                                       (i)
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
Privacy level     ( Maximum )  ( Standard )
Maximum — websites never learn you're here, and nobody can see
when you're typing or reading your messages.

     [ ]  Generate YouTube previews
     [ ]  Delivery receipts
          [ ]  Read receipts
     [ ]  Typing indicators in DMs
     [ ]  Typing indicators in Spaces
```

Against today's panel this is: **one selector, one description line, one row
moved up, one dead row deleted.** No headings, no cards, no collapsing, no
badges, nothing hidden.

The deleted row is **"Show Online Status"** — a permanently disabled switch for
an unimplemented feature
([`Privacy.tsx:147`](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L147))
that sits exactly where the level control goes. It is in scope here because the
layout needs the space; two independent reviewers flagged it anyway. Strict
panel shrink, zero functionality lost.

## 2. What it governs, and the rule that decides

Five toggles today:

| Field | Discloses | To whom |
|---|---|---|
| `generateYouTubePreviews` | your IP, and that you are about to share a specific video | **Google** — outside Quorum entirely |
| `deliveryReceipts` | a message reached your device | your counterparty |
| `readReceipts` | when you actually read it | your counterparty |
| `typingIndicatorsDM` | you are composing, right now | your counterparty |
| `typingIndicatorsSpaces` | you are composing, right now | **everyone in the channel** |

Membership is decided by a rule, not by a list, so a toggle added in a future
release does not need this document reopened:

> **A toggle is governed by the privacy level if and only if all three hold:**
> 1. **OFF is the more private position** — so "Maximum = everything off" is coherent
> 2. **Both directions are fully reversible and leave no durable artifact** — so no confirmation is ever needed
> 3. **Turning it off costs only convenience** — never recovery, safety, or authenticity

Applied to every row on the panel today:

| Toggle | In? | Which clause decides it |
|---|---|---|
| YouTube previews, delivery, read, typing ×2 | ✅ | passes all three |
| **Enable sync** | ❌ | fails 2 (undeletable server artifact) and 3 (its only backup of Space access) |
| **Public profile** | ❌ | fails 2 — once published, copies exist regardless of unpublish |
| **Always sign DMs** | ❌ | fails 3 — off costs impersonation detection, not convenience |
| **Screen unknown callers** (mobile) | ❌ | fails 1 — **ON** is the private position, so it points backwards on the scale |

Predicted future members, all of which pass without further debate: link
previews, OG metadata previews, remote image loading. Each is off-is-private,
fully reversible, and costs only convenience.

## 3. Why YouTube previews leads the group

It is currently the **last** row on the panel, ranked below typing indicators.
It should be first, because it is the only toggle in the group that opens a
direct connection to a company outside Quilibrium.

The fetch is a bare browser `fetch()` straight to Google's CDN from the user's
device — no proxy, no relay, no Q hop:

```ts
// quorum-shared/src/utils/youtubeUtils.ts:138-146  (READ 2026-08-10)
const url = getYouTubeThumbnailURL(videoId, 'hq');   // img.youtube.com/vi/…
const response = await fetch(url, { signal: controller.signal });
```

The call site is already gated with the comment *"fetching leaks sender IP to
Google"* ([`useMessageComposer.ts:212`](../../../src/hooks/business/messages/useMessageComposer.ts#L212)). (READ)

**This is also what the level was originally about.** The lead dev's disabled
onboarding screen offered three levels whose twelve feature bullets are
*entirely* about network connections and external fetches — "All traffic routed
through Q network", "No link previews or external fetches", "IP address never
exposed", "External images loaded", "Direct connections to services". **Not one
of the twelve mentions receipts, typing, or anything a counterparty sees**
([`privacy-setup.tsx:30-68`](../../../../quorum-mobile/app/(onboarding)/privacy-setup.tsx#L30), READ).

So the level was never conceived as a master control over the whole panel. It
was a control over *does your device reach outside the network, and does that
expose your IP*. Putting YouTube previews first restores that emphasis by
reordering rows rather than by adding structure.

## 4. Exact copy

The description line is load-bearing. It, not the level's name, is what makes
the claim honest — the name is just a preset label, the sentence states the
effect. This is the same division Firefox and Brave use for their own
Standard/Strict tiers.

| State | Description line |
|---|---|
| **Maximum** | Websites never learn you're here, and nobody can see when you're typing or reading your messages. |
| **Standard** | Link and video previews load, and people can see when you receive and read your messages, and when you're typing. |
| **Custom** | You've set these individually. |

Notes on the copy, each of which was a deliberate choice:

- **Maximum does NOT claim "your IP is never exposed."** That was the lead dev's
  wording and it is not demonstrable from this codebase — clicking a link
  exposes your IP whatever the setting says, and what Quilibrium's own transport
  exposes to the nodes you connect to was not verified during this design. The
  claim made here is narrower and checkable: *Quorum never fetches from outside
  the network on your behalf.*
- **Custom's copy is deliberately unalarming.** Custom is not a degraded state,
  it is just where the user is, and the copy must not imply they have done
  something wrong.
- **"Standard" means standard for the category, not the app's default.** It is
  what WhatsApp / Signal / Telegram do. Maximum is this app's default (§5).

## 5. Maximum is today's default, and that is fine

All five governed toggles already default to **OFF**
([privacy-settings.md defaults table](../../docs/features/privacy-settings.md), READ).
So a fresh account is already at Maximum and selecting it changes nothing.

Two consequences:

- **No migration, and no "we changed your settings" moment** for existing users.
- **The level's real traffic is the Standard direction.** Nobody will ever click
  Maximum as an act of *increasing* their privacy, because they are already
  there. The clicks it receives are people turning conveniences on, and people
  turning them back off. That is a legitimate feature; it is just not the story
  the name tells, and the design should not pretend otherwise.

An earlier draft added a `Default` chip on Maximum to signal this. It was
dropped: the description line already carries the meaning, and the chip added a
thing to read for no decision it changed.

## 6. Interaction spec

**Derivation.** The level is **computed from the toggle values on every render
and never stored.** There is no new `UserConfig` field.

```ts
// Candidate for quorum-shared — pure, platform-agnostic, mobile needs it too.
export type PrivacyLevel = 'maximum' | 'standard' | 'custom';

export function derivePrivacyLevel(c: {
  generateYouTubePreviews: boolean;
  deliveryReceipts: boolean;
  readReceipts: boolean;
  typingIndicatorsDM: boolean;
  typingIndicatorsSpaces: boolean;
}): PrivacyLevel {
  const v = [
    c.generateYouTubePreviews, c.deliveryReceipts, c.readReceipts,
    c.typingIndicatorsDM, c.typingIndicatorsSpaces,
  ];
  if (v.every((x) => x === false)) return 'maximum';
  if (v.every((x) => x === true)) return 'standard';
  return 'custom';
}
```

Deriving rather than storing was chosen because it makes drift structurally
impossible: the label cannot disagree with the switches, and when a sixth
governed toggle ships, everyone who had not opted into it lands on Custom
automatically — which is the correct and safe outcome.

**Applying a level.** `applyPrivacyLevel(level)` writes all five fields
explicitly.

> ⚠️ **Do not implement this by driving the Switch `onChange` handlers.** The
> delivery→read cascade lives *inside* the delivery Switch's handler
> ([`Privacy.tsx:168-172`](../../../src/components/modals/UserSettingsModal/Privacy.tsx#L168)),
> so a bulk setter that only touches `deliveryReceipts` leaves `readReceipts`
> stale. Set all five fields directly.

**Custom's presentation.** A two-option control with neither option selected
reads as broken. So:

- Custom is rendered as a **third option that appears only when the state is
  mixed**, already selected, and **not selectable**.
- It disappears again the moment the user picks Maximum or Standard.
- Its appearance is *feedback* — it shows up at the instant the user flips a
  switch that breaks the set, so it reads as a consequence of their action
  rather than as permanent clutter. A permanently greyed third option would be
  noise 99% of the time.
- **Custom is never a dead end.** From Custom, both Maximum and Standard remain
  live; one tap resets the whole group either way.

**No confirmation modals anywhere in this feature.** Every governed toggle is
reversible and leaves no durable artifact — that is clause 2 of the membership
rule, and it is what buys the zero-modal property. If a future toggle needs a
confirmation, it fails clause 2 and therefore is not governed.

**Implementation primitive.** Use
[`RadioGroup`](../../../../quorum-shared/src/primitives/RadioGroup/RadioGroup.web.tsx)
from quorum-shared with `direction="horizontal"` — it already exists, already
has a `.native.tsx` sibling, and already supports per-option `disabled`. (READ
2026-08-10.) Model Custom as a conditionally-present option with
`disabled: true` and `value='custom'`; a checked-but-disabled radio is valid and
announces correctly, which is cleaner than a button group faking selection with
`aria-pressed`.

**Accessibility.** The level can change *from a switch elsewhere in the panel*.
Sighted users see the selection move; screen-reader users get nothing unless
told. Add a visually-hidden `aria-live="polite"` node that announces
"Privacy level: Custom" (etc.) whenever `derivePrivacyLevel` changes. This is
specific to the derived mechanism and is easy to omit.

## 7. Explicitly excluded, with reasons — do not reopen without new information

**`allowSync` — excluded for now, on a stated unblock condition.** Not excluded
on principle. Today the single boolean bundles two incompatible things: ~40 KB
of settings (benign, reversible, what most users actually want) and a multi-MB,
**undeletable**, retroactively-decryptable key archive. There is no defensible
value for a preset to write, because every value is right about one half and
wrong about the other — which is exactly the false choice
[§6.4 of the config-sync design](2026-08-07-config-sync-overhaul-design.md)
describes. **Unblock condition:** once §5.3 splits it into `Sync settings`
(parent) and `Also back up Space keys` (child), the level can govern the parent
— small, benign, reversible — and leave the child as the explicit act it should
be. §5.3 is 🛑 PARKED as of 2026-08-09 pending a lead-dev conversation.

Excluding sync has a second, load-bearing benefit: `allowSync` is becoming
device-local (§5.1, desktop shipped in #322). A level that governed it would
have had to be device-local too, or it would reach across devices and override a
device-local decision — the exact bug §5.1 exists to fix. With sync out, the
level is a pure function of synced fields and that whole question disappears.

**`isProfilePublic` — excluded.** It publishes plaintext to a server; once
published, copies exist regardless of the working unpublish. Product decision:
this is something a user should only ever switch on as a deliberate, explicit
act, never as a side effect of picking a level.

**`nonRepudiable` — excluded.** Off costs impersonation detection, not
convenience, and its safe default is the *less* private position — so it points
backwards on the scale.

**"Screen unknown callers" (mobile only) — excluded.** ON is the private
position, so it inverts relative to everything the level governs. Same product
reasoning as public profile: explicit opt-in only.

**A third level ("Low") — rejected.** With five booleans the only candidate
discriminators between a middle and a bottom level were read receipts or YouTube
previews. One toggle is not a level. Two levels plus Custom is the honest shape.

**Link-click IP warning — out of scope, and not filed as part of this.**
Discussed and dropped. Worth recording why, because it will come up again: the
real threat is a targeted IP-grabber link from a stranger, and a modal on
*every* link click fires almost entirely on safe links, gets dismissed
reflexively within a day, and then fails silently on the one that mattered.
Warning fatigue does not merely waste the warning, it trains the user past it.
If it is ever built, scope it to senders you share no Space with, or to
first-time domains, and design it on its own terms.

## 8. Corrections to the seed

Two factual claims in the 2026-08-10 seed are wrong and are corrected here so
they are not carried forward.

1. **"`privacyLevel` is a `UserConfig` field today."** It is not. The whole
   `UserConfig` type was read
   ([`quorum-shared/src/types/user.ts:66-165`](../../../../quorum-shared/src/types/user.ts#L66))
   and contains no such field. `privacyLevel` exists only on mobile, as
   `User.privacyLevel` ([`AuthContext.tsx:33`](../../../../quorum-mobile/context/AuthContext.tsx#L33)),
   plus onboarding state and `secureStorage.ts:450`. It is **device-local and
   unsynced**. This mattered: it made "does the level sync?" an open choice
   rather than an inherited constraint, and deriving then removed the question
   entirely. (READ)
2. **The seed framed the level as a control over the whole Privacy panel.** The
   lead dev's own screen shows it was about network/IP exposure specifically —
   see §3. Designing against the wrong premise is what produced three rejected
   layouts.

## 9. What the independent reviews changed

Three reviews were commissioned on 2026-08-10 after three layouts in a row were
rejected as "still complex, not intuitive". They did not coordinate. Recorded
because two of their findings changed the design and one is a standing warning.

- **A design reviewer** found that no other Settings tab groups rows in a
  bordered card, which killed a card-based grouping proposal; and argued the
  residual overclaim was *"structural, not solvable by design polish"*.
- **A skeptic** found the defect that killed the previous draft: with the level
  derived from five toggles and *named* "privacy level", a user with sync ON and
  a public profile ON — both non-default, deliberate acts — would be told
  **"Privacy level: Maximum"**. Not hollow: false, in the one direction that
  matters, about exactly the toggles excluded for being most consequential. The
  fix is §4's division of labour: the name is a preset label, the description
  line makes the claim, and the claim is scoped to what the level actually does.
  The same reviewer verified that **no privacy-first messenger uses a named
  privacy level** — Signal, Session, Threema, Wire and Element all use flat
  individual toggles. The precedent is browsers (Firefox ETP, Brave Shields),
  and both satisfy two preconditions this design does not: their default level
  *does* something, and their levels are strict supersets on one axis. This
  design proceeds anyway, deliberately, but the divergence is real and is
  recorded rather than hidden.
- **A plain-language reviewer** established the finding that reframed the work:
  **rows 5-9 are already the most legible rows on the panel** (receipts, typing
  bubbles and link previews map onto what everyone knows from other messengers),
  while the rows people genuinely do not understand are `allowSync` and
  `nonRepudiable` — neither of which the level touches. See §11.

## 10. Cross-client parity — a hard prerequisite

Mobile is missing three of the five governed toggles. The asymmetry bites in one
direction only:

- **Maximum is already truthful on mobile.** A toggle that does not exist cannot
  be on, so mobile sits at the Maximum position for all three.
- **Standard cannot be truthful on mobile.** Selecting it would set the two
  receipts and silently do nothing for the other three.

**Decision: mobile reaches toggle parity first. This design does not ship on
either client before that.**

| Prerequisite | Status |
|---|---|
| Mobile: typing indicators in DMs + Spaces, with global toggles | Filed — [`2026-07-24-typing-indicators-and-toggles-port.md`](../../../../quorum-mobile/.agents/issues/.open/2026-07-24-typing-indicators-and-toggles-port.md). Carries a 🔴 correction about a relay-retention bug desktop already shipped and fixed; read it before slice 3. |
| Mobile: `generateYouTubePreviews` sender-side toggle | **NOT FILED.** Must be filed as part of this work. |

There is a delayed version of the same problem worth knowing about: a desktop
user picks Standard, `generateYouTubePreviews: true` rides the sync blob to
mobile, mobile ignores it — until the day mobile implements it, at which point
mobile begins fetching from Google without the user making a new decision. This
risk exists with or without the level; the level only makes the field more
likely to be `true`. Parity-first removes it.

## 11. Adjacent work this design does not do, but names

**These are the highest-leverage changes to this panel, and neither of them is
this feature.** Recorded so they are not lost.

- **Rewrite the `allowSync` and `nonRepudiable` tooltips.** Per the
  plain-language review, these are the two rows a normal person cannot parse,
  and fixing them would do more for "really intuitive" than anything done to the
  five governed toggles. Today's sync tooltip says *"increases metadata
  visibility of your account"* and never mentions the two facts that would
  change a decision: **it is the user's only backup of Space access, and once
  uploaded there is no delete.** Today's signing tooltip says *"plausible
  deniability"* to people who have never used the phrase, instead of *"a signed
  message can be shown to someone outside this conversation as proof it came
  from you."*
- **File the dead mobile onboarding screen's copy as its own issue.**
  `privacy-setup.tsx` promises *"All traffic routed through Q network"* and
  *"IP address never exposed"*; neither is implemented, and its Enhanced option
  (Q-routing *plus* external image loading) presumes a proxy layer that does not
  exist. Nobody sees it today because the step is disabled at
  [`OnboardingContext.tsx:161`](../../../../quorum-mobile/context/OnboardingContext.tsx#L161),
  but a screen that lies about the product is one hurried re-enable away from
  shipping. **This design does not delete it** — it is the lead dev's work and
  the call is theirs. File it so they can decide.

## 12. Onboarding

**No new onboarding step on either client.** Onboarding is already long enough,
and a level whose default state is what a fresh account already has does not
earn a step.

**Mobile has a live bug here that this design fixes as a side effect.** Mobile's
completion recap renders a "Privacy Level" row
([`complete.tsx:198-212`](../../../../quorum-mobile/app/(onboarding)/complete.tsx#L198))
reading `state.privacyLevel`, which defaults to `'standard'`
([`OnboardingContext.tsx:175`](../../../../quorum-mobile/context/OnboardingContext.tsx#L175)).
So **every new mobile user is told "Privacy Level: Standard"** while their
account actually has all five governed toggles off — which is Maximum. The label
is wrong today, in the direction that *undersells* the user's actual privacy.
Deriving it fixes this. (READ)

**This one fix may ship ahead of the §10 parity gate.** Deriving on a mobile
client that has only two of the five toggles still returns `maximum` correctly,
because a toggle that does not exist cannot be on — the gate exists because
*Standard* cannot be honoured, not because *Maximum* cannot. So the recap label
can be corrected as soon as `derivePrivacyLevel` lands in shared, without
waiting for the missing toggles or for any selector UI.

**Desktop gets nothing.** [`CompleteStep.tsx`](../../../src/components/onboarding/steps/CompleteStep.tsx)
is 34 lines — an icon, a title and a button, with no recap section. Building one
to host a single derived label would be inventing a step to justify a label. If
a recap is ever wanted for its own reasons, the privacy row comes along free.

**Dead plumbing to remove once the level derives:** mobile's `PrivacyLevel` type
(`AuthContext.tsx:33`, whose vocabulary is `maximum|enhanced|standard` and does
not match this design), `User.privacyLevel`, the onboarding state and setter,
and `secureStorage.ts:450`.

**Mobile's UI slot already exists.** `ProfileModal.tsx:4460` renders a "Privacy
Level" text row. It becomes the real selector — no new surface needed.

## 13. Verification

The level is derived and modal-free, so most of it is cheap to test. What
matters is that the tests could actually fail.

| What | How |
|---|---|
| `derivePrivacyLevel` | Unit tests in quorum-shared. All-off → maximum; all-on → standard; each of the five flipped alone → custom (5 cases); every one must be checked, since a rule that ignores one field passes a 3-case suite. |
| `applyPrivacyLevel` | Unit test asserting **all five** fields are written. Specifically assert `readReceipts` is set when applying Maximum from a state where delivery was already off — that is the cascade trap in §6 and it is the assertion that would have caught it. |
| Round trip | Apply Standard → derive returns `standard`. Apply Maximum → derive returns `maximum`. Flip one field → derive returns `custom`. Apply Maximum again → returns `maximum`. |
| Custom pill | Component test: renders two options at maximum/standard, three when mixed, and the third is disabled and selected. |
| `aria-live` announcement | Component test: toggling a governed Switch updates the live region's text. |
| Cross-client | The same shared test suite must run in both repos, per the config-sync design's §7 argument that a rule recorded only at the site that obeys it is invisible from the sites that do not. |

**Revert-the-fix check:** before calling any of these green, revert the
implementation and confirm the test goes red. A derived-value test that passes
against a stub is worse than no test.

## 14. Open items

1. **File the mobile `generateYouTubePreviews` toggle issue.** Hard prerequisite
   per §10, currently unfiled.
2. **File the `privacy-setup.tsx` copy issue** for the lead dev, per §11.
3. **Name the group heading, if one is wanted at all.** The current design has
   none, deliberately — the level's description line does the work a heading
   would have done. Revisit only if the panel reads as ambiguous once built.
4. **Revisit `allowSync` membership** once config-sync §5.3 unparks. §7 states
   the unblock condition.

## Status

**2026-08-10 — designed and approved, not started.** All six seed questions
answered, plus three the seed did not ask (the false-Maximum defect, the
IP-exposure framing, and the derive-vs-store fork). Blocked on mobile toggle
parity per §10; one prerequisite is filed, one is not.

---

*Last updated: 2026-08-10*
