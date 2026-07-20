---
type: bug
title: "announce-keys flooding: a malicious member can grow the per-device admission store without bound (needs a non-destructive cap)"
status: OPEN — known limitation, deliberately shipped without a cap; needs a solid, non-evicting fix (likely a lead-dev call)
created: 2026-07-20
severity: LOW (member-only DoS: storage/perf degradation, no impersonation, no data loss)
platforms: quorum-desktop + quorum-mobile (+ shared owns MAX_DEVICES_PER_MEMBER)
related:
  - .agents/tasks/2026-07-19-per-device-signing-keys-registration-anchored.md (the feature; lists the cap as a pre-send-side prerequisite)
  - quorum-shared src/utils/deviceKeys.ts (MAX_DEVICES_PER_MEMBER constant, currently unused)
---

# announce-keys flooding → unbounded per-device admission store

> Surfaced 2026-07-20 during code review of the desktop receive-side slice.
> A first attempt at an evict-oldest cap was written and then REJECTED because
> it silently deleted legitimate in-use devices (see "Why the naive fix is
> wrong"). Filing this so the real fix is designed deliberately, not rushed.

## The issue

Per-device signing keys are admitted by a receiver whenever a valid
`announce-keys` statement arrives (master-signed, self-certifying identity,
30s skew, LWW — see `verifyDeviceKeyStatement` in shared). Each admission is
stored one row per device tag in `space_member_devices`, and
`resolveVerifiedSender` scans a space's rows on every gated receive
(control message / read-only post / @everyone / update-profile).

Nothing bounds how many admissions a single member can create. A member can
sign an unlimited number of valid `announce-keys`, each with a fresh
`deviceInboxAddress` + `spaceKeyPublicKey`, and flood them. Every receiver
stores every one, so:

- the local `space_member_devices` store grows without bound, and
- the resolver's per-message scan degrades toward O(flood size).

## Reachability + severity

- **Reachable as soon as the receive-side ships.** A member does NOT need our
  official send-side UI: the statement format is open-source, they hold their
  own master key, and they hold the space hub key (they are a member). So they
  can hand-craft and seal valid `announce-keys` at will.
- **Low severity.** The flood is self-attributed (every admission carries the
  attacker's OWN master `userAddress` — it can never resolve to a victim, so no
  impersonation). Impact is limited to storage bloat + slower control-message
  auth on other clients. No data loss. Requires a space member. Acceptable for
  beta as a known limitation.

## Why the naive fix (evict-oldest cap) is WRONG — do not reintroduce it

The tempting fix — "cap live admissions per member at N, evict the oldest" —
was written and reverted because it breaks the feature it supports:

- **It deletes legitimate, in-use devices.** A user at the cap who adds one
  more device would have their oldest device's key deleted. If that device is
  still in use, its deletes/edits/pins silently stop being honored everywhere.
- **Thrashing.** Devices re-announce on every reconnect, so an evicted-but-active
  device re-adds itself and bumps off a different one — with many active devices
  they knock each other out indefinitely.
- **Punishes honest users for an attacker's behavior.** The whole point of
  per-device keys is durable multi-device; a mechanism that can silently drop a
  working device contradicts the feature.
- The `MAX_DEVICES_PER_MEMBER = 10` value floated for it is also arbitrary and
  far too low for a real per-user device count over time.

## Constraints a good fix MUST satisfy

1. **Never delete or break a device that is still in use.** The failure mode for
   hitting any limit must fall on the *attacker's excess* or a *brand-new*
   admission, never on an already-working device.
2. **Bound storage + resolver scan** against a malicious member.
3. **Distinguish honest growth from a flood** (or make the honest ceiling so
   high no real user ever hits it).

## Candidate directions (design deliberately; likely a lead-dev call)

- **Reject-new above a very high sanity bound** (e.g. 32–64 live admissions per
  member). Existing devices are never touched; only implausibly-many NEW
  admissions are refused. Simple; the only cost is a device-rich attacker (or an
  extremely unusual real user) can't add beyond the bound.
- **Rate-limit `announce-keys` per member** (e.g. N new device tags per time
  window) instead of a hard total — bounds flood velocity without a hard ceiling.
- **Anchor admissions to the authenticated device registration** and lazily drop
  admissions whose `deviceInboxAddress` is not in the member's current
  registration (TTL / registration cross-check). This is the strongest option:
  it ties the admission set to the user's real device list, so a flood of
  fabricated device tags is dropped on the next registration fetch. It also
  dovetails with the join-binding hardening
  (`2026-07-20-join-binding-hijack-unauthenticated-member-rebind.md`) and the
  durable design's revocation story.
- Whatever is chosen must live in shared (or be identically enforced on both
  platforms) so desktop and mobile agree.

## Current state (what shipped)

The desktop receive-side slice ships **without any cap** — deliberately, to
avoid baking in the destructive eviction. The store grows only under active
attack by a member; honest clients add one row per real device. Tracked here
until a non-destructive bound is designed. `MAX_DEVICES_PER_MEMBER` remains
defined in shared but unused pending that design.

*Last updated: 2026-07-20*
