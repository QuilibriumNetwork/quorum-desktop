---
type: task
title: "update-profile receive: add per-slot staleness guard (parity with mobile)"
status: todo
priority: low
created: 2026-07-16
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
related_files:
  - "src/services/MessageService.ts"
---

# update-profile receive: add per-slot staleness guard

## Context

The two-slot identity design (see identity-resolution-and-profile-sync doc)
split `update-profile` into a per-space OVERRIDE slot
(`displayName`/`userIcon`/`bio`) and a GLOBAL slot
(`globalDisplayName`/`globalUserIcon`/`globalBio`), stored separately on the
member row. It shipped 2026-07-16 on branch `follow-global-profile`.

**Mobile** guards each slot with its own timestamp: `profileTimestamp` for the
override slot and `globalProfileTimestamp` for the global slot, applying a slot
only when the incoming message's `createdDate` is newer than the stored value
for THAT slot (see `quorum-mobile/context/WebSocketContext.tsx` ~2130/~3600).

**Desktop does NOT guard by timestamp at all.** Both receive handlers
(`MessageService.ts`, the `saveMessage` path ~1366 and the standalone path
~1931) apply profile fields whenever present. This was already true for the
override fields BEFORE the two-slot work — the gap is pre-existing, not a
regression — but it means out-of-order `update-profile` messages can let an
OLDER value win until the next broadcast corrects it.

## Symptom (theoretical, not yet observed)

A reconnect rebroadcast carrying an older global identity arrives after a newer
one (network reordering, a slow device catching up) and briefly overwrites the
newer value. Self-corrects on the next broadcast. Low probability, low harm,
but real — and the reason mobile added the guards.

## Fix

Add `profileTimestamp` + `globalProfileTimestamp` fields to the desktop member
row and, in both receive handlers, apply the override fields only when
`message.createdDate > existing.profileTimestamp` and the global fields only
when `message.createdDate > existing.globalProfileTimestamp`. Mirror mobile's
two-guard structure. Stamp the applied slot's timestamp on save.

Do this alongside the additive shared-type work (the `global_*` fields need to
land on the shared/desktop member type anyway), so it's one typed pass rather
than another `as`-cast layer.

## How to confirm it's needed

Before implementing, reproduce the reorder: send two global renames close
together from two devices (or replay an old rebroadcast after a new one) and
check whether the older value ever sticks on desktop. If it never reproduces in
practice, this can stay low-priority/wontfix. Mobile added the guard
defensively, not from an observed desktop-style failure.

---
*Last updated: 2026-07-16*
