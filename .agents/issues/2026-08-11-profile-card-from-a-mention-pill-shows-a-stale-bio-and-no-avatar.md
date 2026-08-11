---
type: bug
title: "The profile card opened from a mention pill shows a stale bio and no avatar"
status: in-progress
priority: medium
created: 2026-08-11
updated: 2026-08-11
area: identity resolution / profile card
repos: quorum-desktop (this), quorum-mobile (parity not yet checked)
related:
  - ".agents/issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md"
  - ".agents/issues/.open/2026-08-10-identity-resolution-architecture-design.md"
---

# The profile card opened from a mention pill shows a stale bio and no avatar

## Status

**Fixed on `fix/profile-card-mention-fields`, branched off the identity work
(`d244903fe`), NOT off `main` — the code being fixed only exists on the identity
branch.**

Verified: 8 new tests green, and **red on revert** — reverting only the component
wiring makes the three component tests fail with the exact reported symptom
(`"The bio I published to my public profile months ago."` where the roster bio
belongs). Full suite 1384 passed / 1 unrelated load-induced timeout
(`fetchSpaceReplies.unit.test.ts`, green in isolation). Typecheck and lint clean.

Not yet verified: the visual pass in the running app, and the **reported stale
NAME** (see "The name, which this does not explain").

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

**Open question for the operator:** re-check the name specifically, with the
same person, from both entry points, after the avatar/bio fix lands. It is
possible the bio and the missing picture dominated the impression.

## Not covered

- **DMs.** `props.spaceId` is absent there, so there is no roster to read and
  the ladder degrades to caller → public profile, exactly as before. The DM
  sidebar was not part of this report.
- **Mobile parity.** Not checked. Mobile has its own
  `useMembersWithPublicProfileFallback` and its own profile card; if its card
  has an address-only entry point, it very likely has this bug too. Per the
  standing lesson in the parity index, a fix that lands on one client and leaves
  the other as a TODO is not a shipped fix.

## Definition of done

- [x] Mechanism traced to `file:line`, with the two payloads compared
- [x] One ladder, shared with the surfaces that already had it right
- [x] Tests green, and shown red with the fix reverted
- [x] Full suite + typecheck + lint
- [ ] Visually confirmed in the running app, from both entry points
- [ ] The reported stale NAME re-checked, or filed separately
- [ ] Mobile parity checked, or explicitly deferred
- [ ] Merged (branched off the identity work, so it lands after that does)

---

*Last updated: 2026-08-11*
