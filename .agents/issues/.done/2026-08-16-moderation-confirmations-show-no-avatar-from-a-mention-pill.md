---
type: bug
title: "Mute/Block/Kick confirmations show no avatar when the profile card was opened from a mention pill"
status: done
priority: low
created: 2026-08-16
updated: 2026-08-16
area: identity resolution / moderation modals
related:
  - ".agents/issues/.done/2026-08-11-profile-card-from-a-mention-pill-shows-a-stale-bio-and-no-avatar.md"
---

# Mute/Block/Kick confirmations show no avatar when the profile card was opened from a mention pill

## Status

**2026-08-16 — shipped in PR #344** (`fix(identity): moderation confirmations use
the resolved avatar, not the caller payload`).

What landed: three call sites in `UserProfile.tsx` now pass `resolvedUserIcon`
instead of `props.user.userIcon` when opening the Block/Mute/Kick confirmations,
plus `moderationModalHandoffIcon.test.tsx` asserting the hand-off payload from an
address-only click.

Verified: tests written first and observed **red** with `userIcon: undefined` —
the exact reported symptom — including the control arm showing the two entry
points diverging; green after the fix. Identity suite 234/234, adjacent component
and hook suites 184/184, typecheck clean, lint clean on both changed files.
**Visually confirmed by the operator** in a running build.

## The report

> Channel A (the target user has never posted here, I simply mentioned their
> username and clicked it to open the UserProfileModal). When I open the
> UserProfileModal by clicking a mention in channel A, and then click mute,
> block, kick, the second modal that opens doesn't show the user pfp.
>
> Channel B (the target user has posted one msg here). I tried opening the
> UserProfileModal by clicking the user avatar in channel B, and in that way
> the confirmation modals for mute, block, kick, do show the user pfp
> correctly.

Reported as "only reproduced this once, not sure if it's a bug". It is a bug,
and it is deterministic.

**The channel is incidental.** What varies is the ENTRY POINT, and the two
happen to correlate: you can only click someone's message avatar in a channel
where they have posted. Open the card from a mention pill in channel B and the
same three confirmations lose the avatar there too.

## The mechanism

This is
`2026-08-11-profile-card-from-a-mention-pill-shows-a-stale-bio-and-no-avatar`
(PR #328) one hop further down the same chain.

That fix gave the card `useProfileCardIdentityFields`, an avatar/bio ladder
keyed on the address: caller pre-fill → per-space override → roster global slot
→ published public profile. So the CARD renders the right avatar from either
entry point, which is why the card itself looked fine in both channels.

The three moderation buttons kept handing the modals the RAW caller payload:

```ts
// src/components/user/UserProfile.tsx — before
openBlockUser({ address: props.user.address, userIcon: props.user.userIcon, … });
openMuteUser ({ address: props.user.address, userIcon: props.user.userIcon, … });
openKickUser ({ address: props.user.address, userIcon: props.user.userIcon });
```

`props.user.userIcon` is whatever the click event carried:

| Entry point | Payload | Source |
|---|---|---|
| Message avatar | fully-merged member record, icon included | `Message.tsx`'s `onUserClick` |
| Mention pill | `{ address }` and nothing else | `MessageMarkdownRenderer.tsx:877` |

The address-only payload is deliberate (the NAME resolves from `src/identity`
either way, so carrying a snapshot would just be a second thing that can
drift). So from a mention pill the modals received `userIcon: undefined`.

`ModalProvider` passes it straight through
(`ModalProvider.tsx:106/205/220`), and the confirmation modals render it as a
plain prop with no ladder of their own — `KickUserModal.tsx:85`, and the same
shape in `MuteUserModal` and `BlockUserModal`. Result: initials where the photo
belongs, in the dialog whose whole job is "confirm this is the right person".
The NAME in those modals was always correct, because they resolve it from the
address themselves via `useResolvedMemberName`.

## The fix

Pass the icon the card already resolved, since the modals can only be opened
from the card:

```ts
userIcon: resolvedUserIcon,   // ×3
```

`resolvedUserIcon` is the output of `useProfileCardIdentityFields`, already
computed at `UserProfile.tsx:162` and already rendered by the card's own
`<UserAvatar>` two elements above the buttons.

**Alternative considered and rejected as heavier:** have each modal run the
ladder itself from `userAddress` + the route's `spaceId`, the way they already
resolve the name. Correct, and more robust if a fourth caller ever opens these
modals without going through the card, but it duplicates a roster read per
modal to fix a bug with exactly one caller. Worth revisiting only if such a
caller appears.

## The test

`src/dev/tests/identity/moderationModalHandoffIcon.test.tsx` — 4 tests.

Asserts on the HAND-OFF payload (`openBlockUser`/`openMuteUser`/`openKickUser`
call args) rather than on the rendered confirmation, because the hand-off is
the value that changed and the modals downstream of it are a bare prop render.

Fixture shape matters: the roster row carries the avatar only in
`global_user_icon` (no per-space override, its normal state) and the public
profile has an empty `profile_image` (what anyone who never opted into a public
photo has). So the roster is the only source of that avatar, exactly as in the
reported case.

Carries a **control arm**: the message-avatar payload is asserted to produce an
identical hand-off. That path already worked before the fix, so if the control
is the assertion that fails, the ladder broke rather than the hand-off, and the
sibling `profileCardRosterFields.test.tsx` is the file to read.

Red-before-green was observed in the correct order: all 4 failed with
`userIcon: undefined` against the expected roster icon, including the control
arm showing the two entry points diverging, before any production change.

## Found but NOT fixed here — `isKicked` has the same shape

> **Superseded 2026-08-16.** Fixed in the follow-up, together with a parity test
> that asserts the whole card renders identically from both entry points rather
> than chasing one field at a time. See
> `2026-08-16-profile-card-entry-point-parity.md`. The section below is kept as
> the original finding.

`UserProfile.tsx:529/532/540` reads `props.user.isKicked`, also from the raw
caller payload. From a mention pill it is `undefined`, so for an
already-kicked member the Kick button does not grey out and still reads "Kick"
instead of "Kicked!".

Left alone deliberately: it is a different field with a different source (not
part of the avatar/bio ladder), fixing it means deciding where kicked-state
should resolve from, and widening a three-line UI fix to carry it would have
made this change harder to review. Worth its own issue if it bothers anyone.

## Definition of done

- [x] Mechanism traced to `file:line`, both payloads compared
- [x] Test written first, observed red for the reported reason
- [x] Fix applied, test green
- [x] Identity suite (234), adjacent suites (184), typecheck, lint
- [x] Visually confirmed in a running build, from both entry points
- [x] Merged as #344

---

*Last updated: 2026-08-16*
