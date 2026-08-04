---
type: bug
title: "Desktop shows a stale display name everywhere except the User Settings field"
status: open
priority: medium
created: 2026-08-04
updated: 2026-08-04
severity: cosmetic but permanent and self-contradicting — two surfaces in the same app show two different names for the same person, and the wrong one never corrects itself
area: identity resolution / space member roster / name precedence
repos: quorum-desktop (visible) + quorum-mobile (sender)
related:
  - ".agents/issues/.open/2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/docs/features/qns-username-display.md"
---

# Desktop shows a stale display name everywhere except the User Settings field

## §1. Symptom, as reported

Change your own username on mobile. On desktop:

- **User Settings → display name field** shows the **new** name. Correct.
- **Everywhere else** — message authors, the NavRail avatar hover tooltip, member
  lists in Spaces — shows an **old** name.

Not "never updates": it updated once and froze. During a `name1..name8` test
series on 2026-08-04 every surface except User Settings sat at **`name2`** while
the field tracked `name8`. Surviving a page refresh and DM navigation.

Two surfaces in the same app, two different names, same person.

## §2. What is already ruled out (MEASURED 2026-08-04)

Do not re-investigate these; they were measured on a real device pair.

- **Mobile does broadcast.** All three Spaces, no failures, no gate suppression:
  ```
  [ProfileSync] broadcast sent space=QmZM3AKwKfMp
  [ProfileSync] broadcast sent space=Qma7EGH7RdfE
  [ProfileSync] broadcast sent space=QmbdLB6bAAdi
  ```
  (Logging added in quorum-mobile #230, which exists because this path had none.)
- **The config blob publishes and lands.** `published ts=…` followed by
  `server read-back CONFIRMS`. That is why the User Settings field is right — it
  reads channel A, the config blob.
- **Not the Space-key failure.** The same device keys 0 of 3 Spaces for config
  sync (`2026-08-04-mobile-cannot-key-any-space-it-imported-from-the-config-blob.md`
  in quorum-mobile). The obvious theory was that a device which cannot key a Space
  also cannot broadcast into it. **Refuted** by the log above on its first run.

So the sender is healthy and the break is on the desktop receive or render side.

## §3. Leading hypothesis — a stale override outranks everything (INFERRED)

Per [identity-resolution-and-profile-sync.md](../../docs/features/identity-resolution-and-profile-sync.md),
a member row carries two name slots, and the ladder is:

```
per-space override (display_name)  →  QNS .q name  →  global slot (global_display_name)  →  address
```

`applyProfileUpdate` ([MessageService.ts:269-306](../../../src/services/MessageService.ts#L269-L306))
updates them independently. Mobile's profile editor sends only
`globalDisplayName` / `globalUserIcon` / `globalBio`, so `hasOverride` is false
and **the override slot is never touched by anything mobile does today**.

If desktop holds `display_name = name2` as a per-space override — plausibly
written by an older mobile build that sent `displayName`, before the
follow-global work of 2026-07-16 — then that override outranks the global slot
forever, and every global update mobile sends lands in a slot the ladder never
reaches.

### §3-A. Why desktop's echo detection does not save it

Desktop already demotes a roster row that merely *echoes* the global name
(§3-B of the name-tier-drift task). That check compares the override against the
**current** global value.

A row that was an echo when written and has since diverged — exactly `name2`
against a global of `name8` — is indistinguishable from a deliberate per-space
override, and is therefore promoted rather than demoted. **Echo detection catches
a row that is still an echo; it cannot catch a row that used to be one.** If this
hypothesis holds, that asymmetry is the actual defect, and it is a permanent trap
rather than a decaying one.

### §3-B. Confidence, stated honestly

**INFERRED from reading the resolver and the update handler. Not measured.**
Three confident readings of this subsystem were falsified by instruments on
2026-08-04 and none by re-reading. Treat §3 as the first thing to test, not as
the finding.

## §4. Cheapest falsification, in order

1. **Read the row.** Desktop's `SpaceMember` for the user's own address in any
   affected Space. If `display_name` is `name2` while `global_display_name` is
   `name8`, §3 is confirmed outright and everything below is unnecessary.
2. **Clear the per-space override** through whatever UI exposes it (per-space
   profile / nickname). The name should immediately fall through to the global
   slot. A working workaround also confirms the diagnosis.
3. **If the row does NOT hold a stale override**, the fault is downstream in
   rendering, and §3-A of the name-tier-drift task becomes the suspect: desktop's
   global slot is a comparator, not a tier, and reaches the right output only via
   `useMembersWithPublicProfileFallback.ts:147`. Any surface resolving without
   that hook is on its own. The reported surfaces — message list, NavRail hover
   tooltip, Space member lists — are exactly the sort that might bypass it, and
   they should be checked against that hook one by one.

## §5. Scope note — do not fold this into the name-tier task

`2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md` is a
**design** task: cross-client decisions about where the avatar rule lives and how
three tiers should agree. It needs the lead, and it has no user-visible symptom.

This is an **observed bug** with a reproduction, a measured sender, and a
falsifiable cause. Folding it in would bury a reproducible defect inside a
decision that is waiting on someone else. Cross-link them; keep them apart.

They do share a root, and if §3 holds the fix likely belongs in the same resolver
that task is about — which is a reason to sequence them together, not to merge
the files.

## §6. Also relevant

- The User Settings field lags by design until desktop re-pulls the config —
  [2026-06-13-config-not-refetched-stale-until-restart.md](2026-06-13-config-not-refetched-stale-until-restart.md).
  Observed here as a delay of a minute or two, and mistaken for a second bug
  during the session. Not part of this issue.
- DM surfaces travel a **third** channel (`dm-update-profile`,
  `services/dm/dmProfileService.ts` on mobile), so a stale name in a DM header
  may have its own cause and should not be assumed to share this one.

---

*Last updated: 2026-08-04*
