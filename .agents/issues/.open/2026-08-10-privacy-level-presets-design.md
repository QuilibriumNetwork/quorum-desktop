---
type: task
title: "Privacy level presets: four named levels that set the privacy toggles as a group"
status: open
priority: medium
created: 2026-08-10
updated: 2026-08-10
area: privacy UX / cross-client parity
repos: quorum-desktop + quorum-mobile
related:
  - ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
  - ".agents/docs/features/privacy-settings.md"
depends_on: []
blocks: []
---

# Privacy level presets

> **⚠️ This is a SEED, not a plan. Do not implement from it.**
>
> It exists so the design conversation can start from an inventory instead of
> from a blank page. It records the idea, what the toggles actually are on each
> client today, the constraints inherited from the config-sync design, and the
> questions that need answering. **The design decisions have not been made.**
>
> Written 2026-08-10 at the end of an unrelated session (the in-app browser
> work), deliberately stopping short of design so the discussion happens with
> clean context.

## The idea

Replace "a wall of independent privacy switches" with **four named levels**, each
setting a known combination of the existing toggles. Custom is what you land on
if you touch an individual switch.

This is already referenced as a known product idea in the config-sync design,
[§6.4 "Compatibility with the privacy-levels idea"](2026-08-07-config-sync-overhaul-design.md),
which describes it as Low / Normal / High / Custom. That section is the single
most useful thing to read before the discussion — it is the only place where the
interaction between presets and sync has been thought about at all.

## Why now

The `privacyLevel` field already exists and is **inert on both clients.**

On mobile it is a hardcoded string rendered as a label:

- The onboarding step that would set it is **deliberately disabled**, not merely
  unrouted: `// 'privacy-setup', // Temporarily hidden - default to 'standard'`
  ([`context/OnboardingContext.tsx:161`](../../../../quorum-mobile/context/OnboardingContext.tsx),
  matching [`components/onboarding/StepIndicator.tsx:15`](../../../../quorum-mobile/components/onboarding/StepIndicator.tsx)). (READ)
- `privacyLevel` defaults to `'standard'`
  ([`OnboardingContext.tsx:175`](../../../../quorum-mobile/context/OnboardingContext.tsx)) and is
  **only ever stored and displayed** — `ProfileModal.tsx:4460` renders it as a
  "Privacy Level" text row. Nothing reads it to change behaviour. (READ)
- The screen itself (`app/(onboarding)/privacy-setup.tsx`) still exists and
  offers three levels — `maximum` / `enhanced` / `standard` — whose copy promises
  things nothing implements, e.g. Maximum Privacy claims *"All traffic routed
  through Q network"* and *"IP address never exposed"*. **No user currently sees
  this**, because the step is out of the flow. It is dead scaffolding, not a
  live false promise — but it should not be revived as-is. (READ)

So there is a field, a type (`PrivacyLevel = 'maximum' | 'enhanced' | 'standard'`,
`quorum-mobile/context/AuthContext.tsx:33`), and a disabled screen, all built
around an earlier three-level idea that was never wired up. Any preset work
either adopts that vocabulary deliberately or replaces it deliberately — it
should not inherit it by accident.

## Inventory: what the presets would actually be setting

**Desktop is the reference.** This is the full Privacy panel
([`src/components/modals/UserSettingsModal/Privacy.tsx`](../../../src/components/modals/UserSettingsModal/Privacy.tsx), READ 2026-08-10):

| # | Toggle | Field | On mobile? |
|---|---|---|---|
| 1 | Enable sync | `allowSync` | ✅ yes |
| 2 | Always sign Direct Messages | `nonRepudiable` | ⚠️ **per-conversation only, no global toggle** — [filed](../../../../quorum-mobile/.agents/issues/.open/2026-08-07-no-global-always-sign-dms-toggle-on-mobile.md) |
| 3 | Public profile | `isProfilePublic` | ✅ yes |
| 4 | Show Online Status | — | ❌ **not implemented on either** — desktop renders `<Switch value={false} disabled>` with copy saying "not yet available" (`:147`) |
| 5 | Delivery receipts | `deliveryReceipts` | ✅ yes |
| 6 | Read receipts (child of #5) | `readReceipts` | ✅ yes, same parent/child shape |
| 7 | Typing indicators in DMs | — | ❌ **missing** |
| 8 | Typing indicators in Spaces | — | ❌ **missing** |
| 9 | Generate YouTube previews | `generateYouTubePreviews` | ❌ **missing** (sender-side; default false) |

**Mobile has one row desktop does not:** "Screen Unknown Callers"
(`ProfileModal.tsx`). Any preset that claims to describe "your privacy" has to
account for it, or the same named level means different things on the two
clients. (READ)

So: **9 desktop rows, 4 fully shared, 1 partial, 3 desktop-only, 1 mobile-only,
1 unimplemented on both.** Deciding what a preset does on a client that lacks the
toggle is a real design question, not an edge case — see below.

## Constraints inherited from the config-sync design

These are settled decisions in the sibling doc, not open questions. A preset
design that ignores them will be re-litigating work already done.

1. **`allowSync` is a single switch today, and the tiering split is PARKED**
   (decided 2026-08-09, pending a lead-dev conversation). So a preset cannot
   currently express "sync my settings but not my Space keys" — it must choose
   between no sync at all and a full key archive. §6.4 notes this is exactly the
   false choice that makes presets awkward right now.
2. **The toggles are not on one axis.** §6.4: *"A 'High privacy' preset should
   turn the child off before the parent"* — sync leaks an activity timeline,
   whereas key backup leaves a durable, undeletable key archive. Ordering the
   toggles along a single "more/less private" slider is the obvious design and
   is probably wrong.
3. **Some toggles trade privacy against data loss, not against convenience.**
   Turning sync off is the only backup of Space access (§P3). A "High privacy"
   preset that silently disables the user's only recovery path needs copy that
   says so.
4. **`allowSync` is about to become device-local** (§5.1, desktop shipped in
   #322, mobile still to do). A preset is account-level-feeling but would be
   setting at least one device-local field. That interaction is unresolved.

## Open questions for the discussion

Roughly in the order they need answering.

1. **How many levels, and what are they called?** The config-sync doc says
   Low/Normal/High/Custom; the dead mobile screen says maximum/enhanced/standard.
   Pick one vocabulary. Is "Custom" a selectable level or just what the UI shows
   once you deviate?
2. **What does a preset do about a toggle the client doesn't have?** If "High"
   means typing indicators off and mobile has no typing indicators, is mobile
   compliant, non-compliant, or does the level render as unavailable? This
   decides whether presets can ship before parity.
3. **Does the preset persist, or is it just a shortcut?** Storing the chosen
   level means it can drift out of agreement with the toggles it set (a later
   toggle change, or a new toggle added in a release). Not storing it means the
   UI has to derive the level from the toggle values every time, and there may be
   no exact match. Both are defensible; they lead to different code.
4. **Does the level sync across devices?** It is a `UserConfig` field today. But
   see constraint 4 — if `allowSync` is device-local and a preset sets it, a
   synced preset would reach across and change a device-local decision.
5. **Should presets ship before or after the missing mobile toggles?** Presets
   over an incomplete toggle set are how the two clients end up meaning different
   things by the same word.
6. **Does this replace the onboarding privacy step, or only live in Settings?**
   §6.4 assumes User Settings. Reviving the onboarding step is a separate
   decision, and its current copy would need rewriting either way.

## Next step

Run a proper design session on this in a **fresh context**, starting from §6.4 of
the config-sync design and the inventory above. Use the `brainstorming` skill;
the output belongs in `.agents/issues/` as
`2026-08-10-privacy-level-presets-design.md` (this file, elaborated) or as a
`-plan.md` sibling once the shape is agreed.

**Do not start implementing from this file.**

## Status

**2026-08-10 — seeded, not designed.** Inventory taken and constraints gathered.
No design decisions made; all six questions above are open. Blocked on nothing
except the discussion itself.

---

*Last updated: 2026-08-10*
