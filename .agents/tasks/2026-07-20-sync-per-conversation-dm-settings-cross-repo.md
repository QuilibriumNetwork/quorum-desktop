---
type: task
title: "Sync per-conversation DM settings across a user's devices (cross-repo)"
status: shared ✅ merged · desktop ✅ implemented (branch, unmerged) · mobile ⏳ pending
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

### 1. quorum-shared ✅ DONE (PRs #63 + #65 merged to master, 2026-07-20/21)
- Added `UserConfig.conversationSettings` (additive, all-optional) to
  `src/types/user.ts` + the `ConversationSettingOverrides` type, plus the
  `getConversationSetting` / `setConversationSetting` / `mergeConversationSettings`
  helpers in `src/utils/conversationSettingsUtils.ts` (18 tests). #65 exported
  `ConversationSettingOverrides` from the package root (missed in #63).
- Additive + optional → safe for mobile (see `feedback_dont_break_mobile_on_shared_changes`).
- ⚠️ **Not yet published to npm.** Master carries the code but the published
  `2.1.0-36` tarball predates it. Desktop consumes shared via `link:../quorum-shared`
  (local repo), so dev/test builds see it now; a desktop **production** ship needs
  shared published to npm at a pinned version (or CI resolving the link) — confirm
  how desktop CI resolves `@quilibrium/quorum-shared` before release.

### 2. quorum-desktop ✅ DONE (branch `feat/sync-conversation-settings`, unmerged)
See the Progress section for the exact file-by-file changes + review fixes.
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

### 3. quorum-mobile ⏳ REMAINING — the mobile half (see the checklist in Progress)
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
- **quorum-shared:** ✅ **DONE — PRs #63 + #65 merged to master.**
  - #63 (`feat: add UserConfig.conversationSettings…`): `ConversationSettingOverrides`
    type + `UserConfig.conversationSettings` + the `getConversationSetting` /
    `setConversationSetting` / `mergeConversationSettings` helpers + 18 tests.
  - #65 (`fix: export ConversationSettingOverrides from package root`): one-line
    addition to the `from './user'` re-export list in `src/types/index.ts` (the
    type was in `user.ts` but not in the public API). Feature-only, no version bump.
  - Both ride the not-yet-published `2.1.0-36`. **Still unpublished on npm** — if
    `2.1.0-36` publishes without these, bump to `2.1.0-37` as its own commit
    (versioning stays lead-dev's call, see `project_quorum_shared_versioning`).
- **quorum-desktop:** ✅ **implemented** on branch `feat/sync-conversation-settings`
  (built against the locally-linked shared dist; npm `2.1.0-36` does NOT yet
  carry #63, so this must not merge/ship until shared publishes). Changes:
  - New `useDMConversationSettings` hook (write via `save-user-config` enqueue,
    optimistic config-cache update + rollback, mirroring `useDMMute`; reactive
    `getOverride` reader).
  - `ConversationSettingsModal` writes the 4 fields into
    `UserConfig.conversationSettings` (dropped the `messageDB.saveConversation`
    write); load dual-reads config override → legacy local `Conversation`.
  - `DirectMessage` now consumes `useConfig` and dual-reads `isRepudiable` +
    delivery/read receipts from the synced map (reactive to modal saves).
  - `MessageEditTextarea` dual-reads `saveEditHistory` (DM branch) from the map.
  - `ConfigService.getConfig` merges `conversationSettings` via shared
    `mergeConversationSettings` (per-entry LWW), beside the `deviceNames` merge.
  - `useMigrateConversationSettings` (mounted in `Layout`): one-time per-user
    sweep folding legacy local `Conversation` fields into the map with a low
    `updatedAt` so any genuine edit wins; guarded by a localStorage flag.
  - Added `conversationSettings?: { [conversationId]: ConversationSettingOverrides }`
    to the desktop-local `UserConfig` in `src/db/messages.ts`, mirroring shared's
    `UserConfig` field exactly (desktop still keeps its own `UserConfig` type — see
    `project_quorum_shared_migration`). Initially typed with `ConversationSettingsMap`
    as a workaround while #65's export was pending; reverted to the shared-aligned
    form once #65 merged.
  - **Post-review fixes (multi-agent /code-review high):**
    - **MessageService reader sites (was a miss).** `MessageService.ts` reads
      the effective receipt + edit-history settings on the RECEIVE path, direct
      from the local `Conversation` record — three sites the modal no longer
      writes to: receipt-intercept at (old) lines 3297-3298 and 5002-5003, and
      edit-history-on-receive at ~1455. All three now dual-read the synced map
      first (`getConversationSetting(userConfig?.conversationSettings, …) ?? local
      ?? global`). **Mobile port MUST update the equivalent receive-path readers,
      not just the modal/composer.**
    - **Reactivity revert.** `DirectMessage` and the modal load originally read
      the override from `getConfig()`/IndexedDB, where an optimistic save isn't
      persisted yet → the just-saved value visibly reverted for a cycle. Both now
      read the override from the reactive `useConfig` snapshot (`getOverride` in
      the modal); `getConfig` is kept only for global defaults.
    - Verified `mergeConversationSettings(local, undefined)` returns local
      untouched (a newer mobile blob lacking the field can't wipe desktop
      settings). Merge is strict `>` LWW, tie → local, so migration `updatedAt=1`
      always loses to a real edit.
  - **Known minor (accepted, documented):** migration skips a conversation if
    the synced map already has ANY entry for it, so a field present only in the
    legacy local record won't cross-device-propagate if a partial entry pre-exists
    (dual-read still serves it locally). The optimistic-update rollback under the
    `config:<addr>` dedup key can drop a second rapid save's optimistic value —
    inherited verbatim from `useDMMute`/`useDMFavorites`, not new here.
  - Typecheck + lint (no new warnings) + web build all green (re-verified after
    the #65 type revert).
  - **Files touched (desktop):** `src/hooks/business/dm/useDMConversationSettings.ts`
    (new), `src/hooks/business/dm/useMigrateConversationSettings.ts` (new),
    `src/components/modals/ConversationSettingsModal.tsx`,
    `src/components/direct/DirectMessage.tsx`,
    `src/components/message/MessageEditTextarea.tsx`,
    `src/services/MessageService.ts` (3 receive-path readers),
    `src/services/ConfigService.ts` (merge), `src/components/Layout.tsx` (mount
    migration), `src/db/messages.ts` (type).
- **quorum-mobile:** ⏳ **PENDING — the remaining half. Execute-ready checklist below.**

  Prereq: bump mobile's `@quilibrium/quorum-shared` pin to a published version
  that carries #63 + #65 (or the code won't have the helpers). Until then mobile
  can read the field untyped via `(config as any).conversationSettings`.

  1. **Write** — `app/(tabs)/messages/dm/[id].tsx` `updateConversationSetting()`:
     write to `UserConfig.conversationSettings[conversationId]` via `setConversationSetting`
     + the existing `saveConfig` flow, instead of `storage.saveConversation({...stored, ...patch})`.
  2. **Read (dual-read, mirror desktop)** — effective value =
     `getConversationSetting(config.conversationSettings, id, key) ?? legacy local Conversation field ?? global ?? default`, at EVERY site:
     - DM send path / composer signing lock (`isRepudiable`).
     - Edit hooks (`saveEditHistory`).
     - Receipt gating.
     - ⚠️ **Receive-path readers in mobile's MessageService equivalent** — this was
       the desktop miss (3 sites: receipt-intercept ×2 + edit-history-on-receive).
       Find mobile's equivalent of `interceptControlMessages` gating and the
       received-edit `saveEditHistory` check and dual-read them too. **Do not
       update only the modal/composer.**
  3. **Per-conversation receipt override UI** — re-add to `DMSettingsSheet.tsx`
     (the piece built + reverted on 2026-07-19); the receipt pipeline already exists.
  4. **Merge** — call shared `mergeConversationSettings(local, remote)` in mobile's
     `services/config/configService.ts` `getConfig`, beside the bookmark/mute merges.
  5. **Inbound preservation (belt-and-suspenders)** — mobile's `getConfig` already
     spreads `...decryptedConfig` (line ~397), so `conversationSettings` survives
     inbound today. Still add it to the explicit round-trip list next to
     `mutedConversations`/`bookmarks` (the `config-to-user-readback-bridge-missing`
     guard) so no future refactor silently drops it.
  6. **Migration** — one-time sweep folding local `Conversation.{isRepudiable,
     saveEditHistory,deliveryReceipts,readReceipts}` into the map with a low
     `updatedAt` (desktop uses `1`); dual-read the legacy fields for one release.
  7. Keep mute (`mutedConversations`) + favorites (`favoriteDMs`) exactly as-is.

## Interop & shipping — desktop-shipped, mobile-pending (verified 2026-07-21)

**Shipping desktop without mobile is safe. Mixed desktop↔mobile works.** The
feature is additive and mobile is forward-compatible:

- **Two different users (desktop A ↔ mobile B DMing):** zero impact.
  `conversationSettings` is a *per-user device-sync* field carried in each user's
  own encrypted `UserConfig` blob — it is NOT part of the DM wire protocol.
  Signing/receipts between A and B are unchanged; the only change is *where desktop
  reads its own setting from* (config map vs local `Conversation` record), not what
  it transmits.
- **Same user on desktop + mobile:** no breakage. Mobile **preserves** the field
  it doesn't understand — `services/config/configService.ts:397` spreads
  `...decryptedConfig` on inbound, and `saveConfig` (`:507`) encrypts/uploads the
  whole `config` object as-is (no whitelist reconstruction). So mobile round-trips
  `conversationSettings` back to the server intact and never clobbers it. Expected
  non-behavior until mobile ships: a setting changed on desktop won't take *effect*
  on mobile (mobile still reads its device-local record), and vice-versa.
- **One transient edge case (self-healing, not data loss):** a stale mobile that
  hasn't pulled desktop's latest can upload a newer-timestamped blob whose
  `conversationSettings` is absent, briefly regressing the *server* copy. But
  desktop's `ConfigService.getConfig` merges `mergeConversationSettings(localWithSettings,
  remoteWithout)` → keeps local (verified: helper returns `{...local}` when remote
  is empty), and re-publishes on its next config write. The active desktop never
  loses its settings; only a brand-new third device pulling during that window
  would miss them until the next desktop save.

## Ship order (updated)
1. ✅ shared #63 + #65 merged.
2. ⏳ Publish shared to npm (lead-dev) — needed for desktop's production build and
   for mobile to pin. Desktop dev/test already works via `link:`.
3. ⏳ Merge desktop `feat/sync-conversation-settings` (safe to merge before mobile;
   see Interop). Confirm CI shared resolution first.
4. ⏳ mobile: bump shared pin → implement the checklist above → ship.

*Last updated: 2026-07-21*
