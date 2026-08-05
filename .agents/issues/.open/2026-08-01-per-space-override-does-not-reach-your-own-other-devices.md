---
type: bug
title: "A per-space name/avatar set on one of your devices never reaches your own other devices"
status: open
priority: medium
created: 2026-08-01
updated: 2026-08-05
severity: your own second device shows you following your global identity, as if you had never set the override
area: per-space profile override / channel C / multi-device
repos: quorum-desktop + quorum-mobile (observed desktop → mobile; the reverse is untested)
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/issues/.done/per-space-profile-data-flow-analysis.md"
  - "quorum-mobile/.agents/tasks/.done/2026-07-16-profile-identity-sync-ARCHITECTURE.md"
  - "quorum-mobile/.agents/bugs/2026-06-22-userconfig-blob-not-live-synced-cross-device-master.md"
---

# A per-space override never reaches your own other devices

## Status

observed 2026-08-01 on a live two-device test, cause not yet traced

> **⚠️ NARROWED 2026-08-05 by measurement — half the premise is false.**
>
> A per-space name set **on mobile reached desktop correctly and immediately**,
> over channel C. So per-space overrides *do* cross a user's own devices; the
> general claim in this file's title is wrong as written.
>
> What remains open is the **direction this file actually observed**: desktop →
> mobile (§1 step 4). That is untested since, and is the only live part of this
> issue. §5 already listed the reverse direction as untested; it is now measured
> and working.
>
> **This mattered beyond this file.** An entire deferred architecture — moving
> per-space profiles into the encrypted config blob — was designed on the
> assumption that channel C could not carry them between a user's own devices.
> The measurement killed it before it was built. See
> `2026-08-05-own-identity-cross-device-sync-design.md` §6.
>
> Retitle this issue to name the direction when someone next touches it.


## §1. Observed (live test, 2026-08-01)

1. User A, on **desktop**, sets a per-space name and avatar via
   **Space Settings → Account**.
2. ✅ A's own desktop updates immediately, on every existing message.
3. ✅ User **B** (a different person, on desktop) sees the new name and avatar
   immediately on A's existing messages. **The override propagates correctly to
   other members** — that half works.
4. ❌ **A's own mobile device shows the override fields EMPTY**, so it renders A's
   global name and avatar instead.

The failing party is the user's **own second device**, not other members.

## §2. Why it slipped through — two docs each assumed the other covered it

This is not an unexamined area. It was analysed and the case was assumed working:

- `.agents/issues/.done/per-space-profile-data-flow-analysis.md:490-504` walks the
  two-device scenario explicitly and concludes *"Each device receives both
  updates ✅ / Other device syncs shortly after"*, rating the risk **LOW**. That
  assumption is what this observation falsifies.
- `quorum-mobile/.agents/tasks/.done/2026-07-16-profile-identity-sync-ARCHITECTURE.md:86`
  lists a cross-device test matrix, but every row is about a **global** rename.
  The per-space **override** cross-device case is absent from it.

## §3. It is NOT the known UserConfig cross-device bug

`quorum-mobile/.agents/bugs/2026-06-22-userconfig-blob-not-live-synced-cross-device-master.md`
covers **channel A**: the encrypted `UserConfig` blob (global name, avatar, bio,
`isProfilePublic`, mutes, bookmarks) has no push counterpart, so a running peer
device only re-reads it on restart or an incidental UI trigger.

**A per-space override is not in that blob.** It lives in **channel C**, the space
member roster, and travels as an `update-profile` broadcast into the space. Your
other device *is a member of that space*, so it should receive the broadcast like
any other member — and §1 step 3 proves the broadcast itself is fine, because a
different user got it. So this is a distinct defect that happens to look similar.

Do not close this as a duplicate of the UserConfig master without re-reading both.

## §4. Hypotheses, untested — start here

1. **Self-messages are filtered on receive.** The most likely candidate: a
   handler that skips a control message whose `senderId` is the local user, which
   would be reasonable for most control types and wrong for this one.
2. **Per-device signing rejection.** Control messages authorize against the
   verified Ed448 signer. Desktop signs with its own per-space signing key; if
   A's mobile has not admitted that device via `announce-keys`, it drops the
   message fail-closed. Note this would NOT affect user B if B had admitted the
   device — so it is consistent with the observation.
3. **The broadcast never reaches the sender's other devices at all** — a relay
   fan-out question, not a client one.
4. **Mobile stores it but the Account tab reads the wrong field.** Cheapest to
   check: inspect the mobile `space_members` row for A directly before assuming a
   transport problem.

Rule out 4 first (it is a local read), then 1, then 2.

## §5. Scope not yet established

- Untested in the **mobile → desktop** direction.
- Untested whether **clearing** an override cross-device behaves any differently.
- Unknown whether a restart of the second device fixes it (which would place it
  closer to the channel-A restart-gated family after all, and would be a strong
  clue).

Establish the restart behaviour first — it is one minute of work and it splits
the hypothesis space in half.

---
*Last updated: 2026-08-05*
