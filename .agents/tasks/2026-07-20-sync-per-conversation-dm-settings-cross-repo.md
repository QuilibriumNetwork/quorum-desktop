---
type: task
title: "Sync per-conversation DM settings across a user's devices (cross-repo)"
status: design — not implemented
created: 2026-07-20
priority: medium
platforms: quorum-shared + quorum-desktop + quorum-mobile
related:
  - quorum-mobile/.agents/tasks/2026-07-20-sync-all-conversation-settings.md (the mobile-side draft this was cross-checked against)
  - quorum-mobile/.agents/docs/features/dm-mute-behavior-and-pattern.md (the proven UserConfig-map sync pattern to copy)
  - quorum-mobile/.agents/tasks/.done/2026-06-17-dm-conversation-settings-parity.md (mute + edit-history + receipt-pipeline history)
  - .agents/docs/config-sync-system.md (desktop config sync)
  - .agents/docs/features/messages/dm-receipts.md (desktop receipt pipeline)
---

# Sync per-conversation DM settings across devices

## Problem

Some per-conversation DM settings are **device-local** on both apps: a setting a
user changes on their phone is invisible on their desktop (and on a second
device). The state is a mixed bag, verified against the real code on 2026-07-20:

| Setting | Desktop storage | Desktop syncs? | Mobile storage | Mobile syncs? |
|---|---|---|---|---|
| DM **mute** | `UserConfig.mutedConversations` | ✅ **yes** | `UserConfig.mutedConversations` | ✅ **yes** |
| DM **favorite** | `UserConfig.favoriteDMs` | ✅ yes | `UserConfig.favoriteDMs` | ✅ yes |
| **Save Edit History** | local `Conversation.saveEditHistory` | ❌ no | local `Conversation.saveEditHistory` | ❌ no |
| **Always sign** (`isRepudiable`) | local `Conversation.isRepudiable` | ❌ no | local `Conversation.isRepudiable` | ❌ no |
| **Receipt override** (delivery/read) | local `Conversation.deliveryReceipts` / `.readReceipts` | ❌ no | (built + reverted; not present today) | ❌ no |

> **Correction to the incoming draft.** The mobile draft's table claims desktop
> DM mute is a device-local `Conversation` field that does NOT sync. That is
> wrong. Desktop mute already lives in `UserConfig.mutedConversations` and syncs
> (`src/hooks/business/dm/useDMMute.ts:55` reads `config.mutedConversations`; the
> `save-user-config` action queue uploads it). **Mute and favorites already sync
> on BOTH platforms** — they are the reference implementation, not the gap. The
> real gap is the three receipt/signing/edit-history overrides sitting on the
> local `Conversation` record.

### Where the local-only reads/writes are (evidence)

**Desktop**
- Write: `src/components/modals/ConversationSettingsModal.tsx:145-157` →
  `messageDB.saveConversation({ isRepudiable, saveEditHistory, deliveryReceipts, readReceipts })` (IndexedDB, local only).
- Read `deliveryReceipts`/`readReceipts`: `src/components/direct/DirectMessage.tsx:172-176`
  (`effective = conversation.deliveryReceipts ?? cfg.deliveryReceipts ?? false`).
- Read `isRepudiable`: `src/components/direct/DirectMessage.tsx:166` (drives the DM send-path `effectiveSkip` at :405).
- Read `saveEditHistory`: `src/components/message/MessageEditTextarea.tsx:509`.
- `ConfigService` never touches conversations — the config upload carries
  `UserConfig` only. Confirmed: zero `saveConversation`/`conversation` references in `src/services/ConfigService.ts`.

**Mobile**
- Write: `app/(tabs)/messages/dm/[id].tsx:222-246` → `updateConversationSetting()` →
  `storage.saveConversation({ ...stored, ...patch })` for `isRepudiable` and `saveEditHistory` (local only).
- The receipt **pipeline** now exists (shipped 2026-07-19: `feat: DM delivery + read receipt pipeline`, ticks, and **global** receipt toggles that DO sync). Blocker #9 from the old parity task is cleared.
- Per-conversation receipt override UI/storage was built then reverted, to land here as one coherent cross-device feature.

## Goal

**All per-conversation DM settings sync across a user's devices** (and
interoperate desktop ↔ mobile) via the already-synced, encrypted `UserConfig`
blob — one mechanism, not a per-setting bolt-on. Specifically bring these three
into sync: `saveEditHistory`, `isRepudiable`, and the `deliveryReceipts` /
`readReceipts` override. Mute and favorites are already done — **leave them
where they are.**

## Design: a synced map on `UserConfig`, keyed by conversationId

This is the pattern already proven by DM mute (see the mobile
`dm-mute-behavior-and-pattern.md`) and DM favorites.

```ts
// quorum-shared UserConfig (additive, all fields optional)
conversationSettings?: {
  [conversationId: string]: {
    saveEditHistory?: boolean;
    isRepudiable?: boolean;
    deliveryReceipts?: boolean;   // per-conversation receipt override
    readReceipts?: boolean;       // absent field = inherit the global/default
    updatedAt?: number;           // per-ENTRY last-write-wins merge key (see below)
  };
};
```

The type, plus the read/write/merge helpers, live in **quorum-shared** so both
apps share byte-identical semantics for a synced field (single source of truth —
the merge must agree across desktop ↔ mobile). Helpers:
`getConversationSetting`, `setConversationSetting`, `mergeConversationSettings`.

- **Read model:** effective value = per-conversation field `??` global setting
  (receipts) / `??` default (edit-history=false, sign=on). Absent = inherit.
  Desktop's `DirectMessage.tsx` and `MessageEditTextarea.tsx` already compute
  `conv ?? global ?? default`; the change is *where the `conv` value is read
  from* (the config map, not the `Conversation` record).
- **Write path:** the existing `saveConfig` / `save-user-config` flow. No new
  sync transport — putting the fields on `UserConfig` is all that's needed.
  Same freshness as every config field: the other device refreshes on
  restart/login/config-pull, NOT live.
- **Do NOT fold mute in.** `mutedConversations` already works and syncs on both
  platforms. Migrating a working synced feature into a new shape is risk with no
  user benefit. Keep it as a sibling array.

### Merge strategy — LOCKED: per-entry last-write-wins

`UserConfig` maps split two ways today:
- **Coarse whole-blob LWW** (no per-key merge): `mutedConversations`,
  `notificationSettings`. If device B saves config for any unrelated reason, its
  older copy of the map overwrites A's concurrent edit.
- **Per-key merge**: `deviceNames`, `userNotes`, `bookmarks` (handled explicitly
  in `ConfigService.getConfig`).

**Decision: per-CONVERSATION-entry last-write-wins, keyed by a per-entry
`updatedAt`** — matching the `userNotes` convention (each note is one entry with
one `updatedAt`). This is the elegant AND convention-consistent choice:

- Every write bumps that conversation's `updatedAt`; merge keeps the entry with
  the higher `updatedAt` (missing = 0; tie → keep local, mirroring the config's
  "equal timestamp → prefer local" rule).
- An unrelated config save on device B no longer clobbers device A's edit to a
  *different* conversation — the real failure of coarse LWW is fixed.
- **Reset-to-global keeps an empty-but-timestamped entry** (`{ updatedAt }`) as
  its own tombstone: a newer empty entry beats an older non-empty one, so a reset
  propagates without a separate deletion-tracking array. Empty entries are ~30
  bytes and bounded by conversation count; no pruning needed.
- **Not field-level.** Field-level merge (per-field timestamps) would survive the
  rare "two devices, same conversation, different field, both offline, then sync"
  case, but requires a `{ value, updatedAt }` shape per field — ugly and divergent
  from every existing config field. Entry-level accepts the same tiny concurrency
  tradeoff `userNotes` already accepts. Solid enough, far more elegant.

Implemented once in shared (`mergeConversationSettings`) and called from both
apps' `getConfig`.

## Cross-repo scope

### 1. quorum-shared (do FIRST, then publish)
- Add `UserConfig.conversationSettings` (additive, all-optional) to
  `src/types/user.ts`. **This is the only shared change.**
- Optionally add a tiny `effectiveConversationSetting(config, conversationId, key, fallback)` helper if worth centralizing the `?? global ?? default` logic across both apps.
- Additive + optional → safe for mobile, which is pinned to a published build
  (see `feedback_dont_break_mobile_on_shared_changes`). Follow the canonical
  order: **shared → publish → desktop → mobile bumps → mobile**. Mobile can read
  the field untyped via `(config as any)` before it bumps if needed.

### 2. quorum-desktop
- **Write:** `ConversationSettingsModal.tsx` writes the four fields into
  `UserConfig.conversationSettings[conversationId]` (via a `save-user-config`
  enqueue, mirroring `useDMMute`) instead of `messageDB.saveConversation`.
- **Read:** point `DirectMessage.tsx` (receipts + `isRepudiable`) and
  `MessageEditTextarea.tsx` (`saveEditHistory`) at the config map, keeping the
  existing `?? global ?? default` fallback.
- **Merge:** add the `conversationSettings` per-key merge to
  `ConfigService.getConfig` (only if the lead picks per-key merge). Desktop's
  inbound already does a full `{ ...config }` spread (`ConfigService.ts:376`), so
  a new field survives inbound with no allow-list edit — desktop has **no**
  read-back-bridge problem (it reads config straight from IndexedDB via
  `useConfig`).
- **Migration:** on first run, copy any existing local
  `Conversation.{saveEditHistory,isRepudiable,deliveryReceipts,readReceipts}`
  into the map; keep reading the local fields as a fallback for one release.

### 3. quorum-mobile
- Same move: `dm/[id].tsx` `updateConversationSetting` writes to
  `UserConfig.conversationSettings` instead of `storage.saveConversation`; the
  DM send path, composer lock, edit hooks, and receipt gating read effective
  values from the map.
- **Add a per-conversation receipt override UI** to `DMSettingsSheet.tsx` (the
  reverted piece) now that the pipeline exists.
- **Mobile-specific safety (do not skip):** mobile has the known broken
  config→`user` read-back bridge (`config-to-user-readback-bridge-missing`). Use
  the **bookmark pattern** — read `conversationSettings` straight from the MMKV
  config, not the `user` object — AND add `conversationSettings` to the explicit
  inbound preservation list in `services/config/configService.ts` `getConfig`
  (the same list that carries `bookmarks`/`mutedConversations`), so an incoming
  config can't silently drop it.
- **Migration:** same as desktop — fold local `Conversation` values into the map
  on first run, dual-read for one release.

## What goes in quorum-shared (report)

**Exactly one additive change:** `UserConfig.conversationSettings?: { [conversationId]: { saveEditHistory?, isRepudiable?, deliveryReceipts?, readReceipts?, updatedAt? } }` in `quorum-shared/src/types/user.ts`, all fields optional. Optionally a shared `effectiveConversationSetting` helper. Nothing else is a shared/wire change — the transport is the existing encrypted `UserConfig` blob. No new wire message type (unlike the separate `delete-conversation-self` work, which IS a blocked wire type). This means it can ship additively and does not carry the shared-publish blocker class.

## Not in scope
- DM **mute** and **favorites** — already synced on both platforms; leave as-is.
- **Global** delivery/read receipt toggles + the ✓/✓✓ pipeline — shipped on both.
- `delete-conversation-self` self-sync — separate task, blocked on a new wire type.
- Space (channel) settings sync — DM per-conversation only.

## Open questions for the lead (Telegram) — FYI, not blocking
1. Merge strategy is LOCKED to per-entry LWW (see above); flag only if the lead
   wants a different sync architecture.
2. Desktop ↔ mobile parity in one go, or mobile-first with desktop to follow?
3. Confirm mute/favorites stay as their own `UserConfig` arrays (not folded into
   the new map) — recommended, and assumed here.

## Progress
- **quorum-shared:** ✅ **PR #63 open** → master
  (`feat/user-config-conversation-settings`): type + helpers + 18 passing tests,
  feature-only (no version change). Build + vitest green, rebased onto current
  master. Rides the already-bumped, not-yet-published `2.1.0-36` (npm latest is
  still `2.1.0-35`; master's `chore: bump to 2.1.0-36` is the segregated bump
  from other work). My earlier local `chore/bump-shared-2.1.0-36` branch was
  redundant with master's bump and was deleted. If `2.1.0-36` publishes before
  #63 merges, bump to `2.1.0-37` as its own commit.
- **quorum-desktop:** pending shared publish (or local-link build). Rewire
  `ConversationSettingsModal` (write) + `DirectMessage`/`MessageEditTextarea`
  (read) to `UserConfig.conversationSettings` via the shared helpers; add
  `mergeConversationSettings` to `ConfigService.getConfig`; migrate local
  `Conversation` fields on first run (dual-read one release).
- **quorum-mobile:** pending; write the aligned mobile task + add the
  per-conversation receipt override UI (the reverted piece); use the bookmark
  pattern + add `conversationSettings` to `getConfig`'s inbound preservation list.

*Last updated: 2026-07-20*
