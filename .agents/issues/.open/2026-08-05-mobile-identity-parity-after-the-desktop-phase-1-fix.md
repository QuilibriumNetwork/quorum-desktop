---
type: task
title: "Does mobile need the desktop identity fixes? Three questions, one of them urgent"
status: open
priority: medium
created: 2026-08-05
updated: 2026-08-05
area: identity resolution / desktop-mobile parity
repos: quorum-mobile (investigate), quorum-desktop (reference implementation)
source: raised while verifying the desktop Phase 1 fix on a device — "wondering if mobile also needs all these fixes"
related:
  - ".agents/issues/.open/2026-08-05-own-identity-cross-device-sync-design.md (what desktop did and why)"
  - ".agents/issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md (the bug, with measurements)"
  - ".agents/issues/.open/2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# Does mobile need the desktop identity fixes?

Desktop shipped Phase 1 on 2026-08-05 (branch `fix/own-identity-single-author`).
This is the mobile side of that question, filed so it does not evaporate.

**Nothing here is asserted. Every item says what to check and what would settle
it.** Three confident readings of this subsystem were falsified by measurement in
one day, so this file deliberately does not guess.

## §1. What desktop fixed, and whether mobile plausibly shares it

| desktop defect | mobile likely affected? | why |
|---|---|---|
| Self surfaces read a device-local store nothing syncs | **probably YES** | mobile has the same shape: an MMKV `auth:user` record in `AuthContext`, and its config→user bridge runs only on the login path. A rename made on desktop may not reach mobile's own surfaces until relaunch. |
| Join stamps our own roster OVERRIDE slot | **UNKNOWN — the urgent one** | see §2 |
| Incoming join filed under the override slot | **UNKNOWN** | same trace |
| The global slot is a comparator, not a tier | **NO** | mobile already passes the global name into shared's `resolveDisplayName` as a real rung, and its fallback hook already implements override → global → public for names AND avatars. This was the desktop-only half of the drift. |
| Avatar/bio read the override slot only | **NO** | same reason |
| A peer can overwrite our own override via sync | **NO** | mobile neither asks nor answers sync (`WebSocketContext.tsx` removed handlers) |

## §2. 🔴 The urgent question

**Does mobile stamp its own per-space OVERRIDE slot at join, the way desktop did?**

If it does, then mobile is still *creating* the permanent traps desktop just
cleared — and desktop clearing them does not stop mobile making new ones, for
that user and for everyone in the space. The desktop fix would be continuously
undermined by the other client.

Where to look: mobile's join path (the equivalent of desktop's
`InvitationService` own-row write) and its `join` receive handler (desktop's
`MessageService` ~4950). Desktop's fix was to write `global_display_name` /
`global_profile_image` with a `globalProfileTimestamp` and leave the override
empty.

**This is the item to answer first.** The rest can wait.

## §2-B. 🔴 The other urgent one: desktop → mobile per-space overrides never arrive

MEASURED 2026-08-05, both directions, two independent fields:

| direction | arrives? |
|---|---|
| mobile → desktop | ✅ yes, immediately (name, bio) |
| **desktop → mobile** | ❌ **no** (name + avatar 2026-08-01, bio 2026-08-05) |

Reproduces on demand. The user-visible end state is **the same space showing two
different bios on the two devices**.

Because mobile → desktop works, the relay does deliver to a sender's own other
device, and desktop's receive path is fine. So the fault is mobile's receive of a
**desktop-sent** `update-profile`, or desktop's send reaching mobile specifically.

Strongest candidate, from the owning issue's §4: `update-profile` is authorised
against the VERIFIED signer. Desktop signs with its own per-space signing key; if
mobile has not admitted that device key (`announce-keys`) it drops the message
fail-closed. That would be invisible and would explain the asymmetry exactly.

Full record and hypothesis ranking:
`2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md`.

## §3. ✅ What a device test already settled — do NOT redo it

MEASURED 2026-08-05: a per-space name set **on mobile** reached **desktop**
correctly. So channel C does carry per-space overrides between a user's own
devices, at least mobile → desktop.

That matters twice:

1. It removes the motivation for the deferred Phase 2 (moving per-space profiles
   into the config blob). See the design doc's §6 gate.
2. It partly refutes `2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md`,
   which assumed they never cross and was never traced. **The desktop → mobile
   direction is still untested** — that issue observed exactly that direction, so
   it is not closed, only narrowed.

## §4. What NOT to do

- **Do not port desktop's resolver changes to mobile.** Mobile already has the
  ladder; desktop was the one behind. Copying would be a regression.
- **Do not port the one-time override clear blindly.** Desktop's was justified by
  a measurement on a real account showing four diverged overrides that could not
  be told from deliberate ones. Whether mobile's rows are in the same state is a
  question, not a given — measure before destroying anything.
- **Do not decide unilaterally whether mobile should change.** Per the atlas
  rule, when one client has something the other lacks, frame it for the lead
  rather than deciding. That applies squarely to §2.

## §5. Definition of done

- [ ] §2 answered by reading mobile's join and join-receive paths, with file:line
- [ ] If mobile does stamp: decided WITH the lead whether mobile changes, and filed in the mobile repo
- [ ] Mobile's `auth:user` staleness (§1 row 1) confirmed or refuted by a trace
- [ ] The desktop → mobile per-space direction measured, and `2026-08-01-per-space-override-does-not-reach-your-own-other-devices.md` updated with both directions

---

*Last updated: 2026-08-05*
