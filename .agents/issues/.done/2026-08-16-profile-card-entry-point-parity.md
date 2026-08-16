---
type: bug
title: "The profile card's Kick button state came from the click payload, so it was wrong from a mention pill"
status: done
priority: low
created: 2026-08-16
updated: 2026-08-16
area: identity resolution / profile card
related:
  - ".agents/issues/.done/2026-08-16-moderation-confirmations-show-no-avatar-from-a-mention-pill.md"
  - ".agents/issues/.done/2026-08-11-profile-card-from-a-mention-pill-shows-a-stale-bio-and-no-avatar.md"
---

# The profile card's Kick button state came from the click payload

## Status

**2026-08-16 — shipped in PR #345** (`fix(identity): resolve the profile card's
kicked state from the roster, and assert entry-point parity`).

What landed: `isKicked` now resolves from the roster row inside
`useProfileCardIdentityFields`, and `profileCardEntryPointParity.test.tsx`
asserts the whole card renders identically from both entry points, in the card
and drawer variants.

Verified: parity test written first and observed **red**, naming the Kick button
as the only divergence in both variants; green after the fix. Identity suite
238/238, typecheck clean, lint clean on all three changed files.

**Closed on the automated evidence.** The fix was not exercised by hand in a
running build, and closing did not wait for that. The standing rule
(`AGENTS.md`) requires, for a `type: bug`, *either* tests run in-session *or*
operator confirmation — not both. Red-on-revert plus whole-DOM parity in two
variants satisfies the first, so the extra visual gate was a criterion this file
had invented for itself, not a requirement.

Recorded because the reverse mistake is the expensive one: an issue held open on
a self-imposed checklist item is invisible work, and the checklist item was
written by the same pass that wrote the fix.

If anyone does want the manual check later: kick a member, open their profile
card from a **mention** of them, and the button should read "Kicked!", greyed
out.

## Why this exists: the same bug had been fixed twice, one field at a time

| Fix | Field | Date |
|---|---|---|
| #328 | the card's own bio and avatar | 2026-08-11 |
| #344 | the avatar handed to Block/Mute/Kick | 2026-08-16 |
| this | the Kick button's `isKicked` state | 2026-08-16 |

All three are one defect wearing different hats. A mention-pill click passes
`{ address }` and nothing else; a message-avatar click passes a fully-merged
member record. **Any field the card reads off that payload rather than resolving
from the address renders differently depending on which pill you clicked.**

Fixing them one at a time does not converge. Each fix leaves the next unfound
field in place, and nothing tells you how many remain. #344's write-up closed
with a "Found but NOT fixed" section naming `isKicked` — which is exactly how
the third instance was about to become the fourth.

So the instrument came first this time, and the fix second.

## The instrument

`src/dev/tests/identity/profileCardEntryPointParity.test.tsx` renders the card
from both payloads against **identical sources** and asserts the entire rendered
output matches. Not one field: the whole DOM.

The fixture is deliberately hostile — the member is kicked, and their avatar and
bio exist only in the roster's live-pushed global slots while the public profile
is empty. That is the state where the caller payload and the address-keyed
sources disagree most, so a field read from the wrong source cannot pass by
coincidence.

Three assertions, in increasing strictness:

1. **Button summary** (label + disabled state per control). Runs first because
   it names the offending control in one readable line.
2. **Byte-identical normalised markup**, card variant.
3. **Byte-identical normalised markup**, drawer variant — a different render
   path through the same component, so it can diverge independently.

Plus a control arm asserting the two payloads really are different objects, so
the file cannot pass trivially by comparing two identical inputs.

Only `button-<random>` ids are normalised away (`Button.web.tsx:12` generates
them per render). Nothing else is masked; masking is how a parity test quietly
stops testing.

## What it found

Exactly one divergence, in both variants — about 5KB of markup identical, then:

```
btn-danger-outline  "Kick"      ← mention pill  (isKicked undefined)
btn-disabled        "Kicked!"   ← message avatar (isKicked true)  + disabled=""
```

Meaning: for a member you have **already kicked**, opening their card from a
mention pill showed an enabled "Kick" button instead of a greyed-out "Kicked!".

It also confirms the useful negative: after #328 and #344, nothing else on this
card is read raw. That was previously an assumption.

## The fix

`isKicked` is a real persisted roster field — written by `MessageService.ts:5914`,
mapped at `indexedDbAdapter.ts:159`, read off the same row by
`useChannelData.ts:106`. `useProfileCardIdentityFields` already reads that exact
row for this address, so resolving it there costs nothing extra (same react-query
key, a cache read).

```ts
isKicked: member ? Boolean(member.isKicked) : callerIsKicked,
```

**The precedence is deliberately the reverse of the avatar's.** The avatar puts
the caller pre-fill first to avoid a flash while the roster read settles, which
is safe because the two agree. `isKicked` can genuinely disagree: a caller
snapshot taken before the kick says `false` while the roster says `true`, and
letting a stale `false` win would re-enable a destructive moderation action
against someone already removed. Freshness beats flicker for that control. The
caller value survives only as the fallback when there is no roster row at all
(a DM).

## Scope note

The parity test covers `UserProfile` only, which is what the report was about.
Other surfaces that render a member from a caller-supplied payload are not in
scope here and have not been checked for the same class of defect.

## Definition of done

- [x] Instrument written first, observed red, naming the divergence
- [x] Divergence traced to a real persisted field with an address-keyed source
- [x] Fix applied, parity green in both variants
- [x] Identity suite (238), typecheck, lint
- [x] Supersedes the "Found but NOT fixed" note in the #344 write-up
- [x] Merged as #345
- [ ] Visually confirmed in a running build — **not done, and not required**;
      closure rests on the in-session test evidence above

---

*Last updated: 2026-08-16*
