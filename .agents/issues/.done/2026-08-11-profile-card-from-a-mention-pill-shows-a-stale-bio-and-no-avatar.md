---
type: bug
title: "The profile card opened from a mention pill shows a stale bio and no avatar"
status: done
priority: medium
created: 2026-08-11
updated: 2026-08-11
area: identity resolution / profile card
repos: quorum-desktop (this), quorum-mobile (a different defect, filed there)
related:
  - ".agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md"
  - ".agents/issues/2026-08-10-identity-resolution-architecture-design.md"
---

# The profile card opened from a mention pill shows a stale bio and no avatar

## Status

**2026-08-11 — shipped in PR #328** (`fix(identity): the profile card's avatar
and bio follow the roster, not the published profile`).

What landed: `useProfileCardIdentityFields`, which owns the card's avatar and
bio ladder in one place — caller pre-fill → per-space override → roster global
slot → published public profile → own config bio (self only) — plus two pure
precedence functions and a test file. `UserProfile.tsx` calls the hook instead
of its two inline expressions.

Verified: 8 new tests green, and **red on revert** — reverting only the component
wiring makes the three component tests fail with the exact reported symptom
(`"The bio I published to my public profile months ago."` where the roster bio
belongs). Identity suite 251/251 on the final base; typecheck and lint clean.
Independent code review found nothing at or above its reporting bar, having
re-run the red-on-revert check itself. **Visually confirmed by the operator**
from both entry points, on a build containing the fix.

**Sequencing, recorded because it was contested.** The work was branched off
`feat/identity-provider` rather than `main`, because the card it fixes only
existed there — on `main` at the time, `resolvedBio` was
`props.user.bio || ownConfig?.bio`, with no public-profile rung at all, and the
name still went through the since-deleted `resolveProfileCardName`. A report
that the base "predated the refactor" and that the diff would need re-deriving
was wrong: the base was one commit behind that branch's tip, and the rebase
applied clean, twice. The identity branch then squash-merged as #327, so the
final ship was `git rebase --onto origin/main`, replaying six commits.

## The report

In a channel, the profile card opened from a **mention pill** showed a display
name and a bio that were stale — editing them on that user's own device did not
change them — and no profile picture at all. The same person's card opened from
their **message avatar**, one click away, showed everything correctly and
updated immediately.

## The mechanism

Both entry points render the identical component with identical props, except
for the `user` payload:

| Entry point | Payload | Source |
|---|---|---|
| Message avatar | the fully-merged member record | `Message.tsx`'s `onUserClick` |
| Mention pill | `{ address }` and nothing else | `MessageMarkdownRenderer.tsx`'s `handleClick` |

The address-only payload is deliberate, not an oversight: the NAME resolves from
`src/identity` keyed on the address, so carrying a name snapshot through the
click event would just be a second thing that can drift.

The name survived that narrowing. **The avatar and bio did not.** They are not
names, so the identity module deliberately does not carry them (design
constraint 4), and the card's own address-keyed fallback was only two rungs
deep:

```
bio  = props.user.bio      || publicProfile.bio            || ownConfig.bio
icon = props.user.userIcon || publicProfile.profile_image
```

That skips the tier every other surface renders from: `space_members`'
per-space override and its live-pushed `global_user_icon` / `global_bio` slots,
written by the identity announce (`MessageDB.tsx`) and merged for message
rendering by `useChannelData`. The published public profile is **opt-in**
(so `profile_image` is normally empty), and cached for **an hour** (so the bio
lags). With the caller's copy absent, the card fell straight through to it.

So the defect is not "the card trusts the caller" — it is the opposite. The card
resolves from the address correctly, and the source it resolves *to* was the
worst one available.

## The fix

`useProfileCardIdentityFields` owns the whole ladder in one place:

```
caller pre-fill → per-space override → roster global slot → public profile
                                                          → own config bio (self)
```

Identical to `useChannelData`'s merge and to `pickBookmarkSenderIcon`, which
fixed this same class of bug for bookmarks in August. The precedence rules are
pure functions (`pickProfileCardIcon`, `pickProfileCardBio`) so they can be
tested without IndexedDB or a mounted component.

**Cost: none in the channel case.** The roster read uses `buildSpaceMembersKey`
— the key `Channel` (via `useSpaceMembers`) and `useMultiSpaceRosters` have
already populated. A cache read, not a second IndexedDB round trip. Checking the
key before asserting a cost is the standing lesson from
`2026-08-10-name-surfaces-that-never-reached-the-resolver.md`, where the same
"this would cost N requests" intuition was wrong three times in one piece of
work.

The caller pre-fill deliberately stays the top rung. It is itself a snapshot of
the two member tiers below it, so it changes nothing about correctness — it only
avoids a flash on the avatar path while the roster read settles.

## The name, which this does NOT explain

**The reported stale display name has no mechanism in this code.** Both cards
call `useResolvedMemberName(props.user.address, { spaceId, enrich: true })`;
neither reads `props.user.displayName` for the rendered name. Same hook, same
address, same `<IdentityScopeProvider>` — the name cannot differ between the two
entry points.

The test therefore carries a **control arm**: the same two payloads are rendered
against identical sources and asserted to agree on the name as well as on the
bio and avatar. It passes. So:

- if that assertion ever fails, the defect is in name resolution, not in this
  ladder;
- if it keeps passing while the running app still shows a difference, then the
  divergence is in the **sources**, not in the component — a different hunt,
  most likely the roster row the identity provider holds for that address.

**Closed, not pursued.** The operator could not recall the name specifically,
and the identity branch's own work (the root provider gaining real rosters for
every space, `d1f016d7`) covers the plausible source-side cause. The control arm
stays in the test as the tripwire: if the name ever diverges between these two
entry points, that assertion is what says so.

## One thing to know if you touch the older card test

`src/dev/tests/identity/migrated/UserProfile.test.tsx` (untouched here) mocks
`messageDB` without a `getSpaceMembers` method. The card now queries the roster
unconditionally, so in that file every render rejects that query, silently
swallowed by react-query's `retry: false`. Harmless today — none of its fixtures
exercise the per-space-override tier, and all five still pass — but a future
edit there that assumes roster data flows through will be surprised. The new
test file mocks it properly.

## Not covered

- **DMs.** `props.spaceId` is absent there, so there is no roster to read and
  the ladder degrades to caller → public profile, exactly as before. The DM
  sidebar was not part of this report.
- **Mobile parity — checked, and it is a DIFFERENT bug.** Mobile's
  `UserProfileModal` has no fallback chain and needs none: every caller hands it
  an already-resolved identity. Its avatar goes through `resolveMemberAvatar`
  (override → global slot) and is fine. Its **bio has no such resolver** — four
  call sites read `member.bio` raw, i.e. the per-space override only, so the bio
  disappears for any member the visible-senders merge never touched (most
  visibly the space-settings member list, which never goes through that merge at
  all). Filed as
  `quorum-mobile/.agents/issues/.open/2026-08-11-profile-modal-bio-is-read-raw-so-it-vanishes-for-any-unmerged-member.md`.

  Worth noting for anyone doing the next parity sweep: the two clients had the
  same *class* of defect (a rendered identity field not going through a ladder)
  with completely different *shapes* — desktop's was gated on which pill you
  clicked, mobile's on whether the member had posted recently. Looking for
  desktop's symptom on mobile would have found nothing.

## Definition of done

- [x] Mechanism traced to `file:line`, with the two payloads compared
- [x] One ladder, shared with the surfaces that already had it right
- [x] Tests green, and shown red with the fix reverted
- [x] Full suite + typecheck + lint
- [x] Independently code-reviewed in a fresh context
- [x] Rebased onto the identity branch tip, clean
- [x] The reported stale NAME resolved (closed above, not pursued)
- [x] Visually confirmed in the running app, from both entry points
- [x] Mobile parity checked (a different defect, filed on mobile)
- [x] Merged as #328, after the identity work landed as #327

---

*Last updated: 2026-08-11*
