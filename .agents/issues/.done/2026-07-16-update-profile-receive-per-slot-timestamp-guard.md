---
type: task
title: "update-profile receive: add per-slot staleness guard (parity with mobile)"
status: done
priority: low
created: 2026-07-16
completed: 2026-07-16
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

## Done — 2026-07-16 (desktop branch `feat/two-slot-identity-types-and-timestamp-guard`)

Implemented alongside the shared-type task in one typed pass.

- Added `profileTimestamp?` + `globalProfileTimestamp?` to the desktop member
  row (`SpaceMemberRow` in `src/db/messages.ts`). ✅
- New `applyProfileUpdate(participant, content, createdDate)` helper in
  `MessageService.ts` replaces `applyGlobalProfileSlots`. It mirrors mobile's
  `applyOverride` / `applyGlobal` structure: each slot (override vs global) is
  applied only when the incoming `createdDate` is newer than that slot's stored
  timestamp, and stamps the applied slot's timestamp on save. ✅
- Wired into BOTH receive handlers (the `saveMessage` path and the standalone
  path) and the send-side self-apply (the editing device's own immediate local
  write). Self-apply uses its own send `createdDate`, so the user's latest edit
  always wins locally AND is protected from a later out-of-order echo of an
  older edit. ✅
- **Guard only — no inbox delete.** Mobile deletes the space-inbox message when
  both slots are stale; desktop does NOT, because desktop's P2P transport has no
  per-space server inbox to acknowledge. That cleanup belongs to the future
  hub-log migration (confirmed coming to desktop), at the transport layer, not
  in this handler. Noted in an `applyProfileUpdate` code comment so the future
  migrator wires the inbox-ack at the transport layer — the guard itself is
  transport-agnostic and needs no change.

**Verification:** desktop `tsc` clean, eslint 0 errors, MessageService unit
tests 24/24 pass. The rapid two-device LWW reorder was NOT reproduced
behaviorally (per "How to confirm it's needed" — the guard is defensive parity
with mobile, matching the doc's low-residual-risk assessment).

*Last updated: 2026-07-16*
