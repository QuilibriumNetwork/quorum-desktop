---
type: task
title: "Backup/restore overhaul: back up everything that cannot be re-derived, and reconcile per record instead of per file"
status: open
complexity: very-high
priority: high
ai_generated: true
created: 2026-08-09
updated: 2026-08-09
area: backup & restore / data durability / config sync
repos: quorum-desktop (+ quorum-mobile, quorum-shared for parity)
supersedes:
  - ".agents/issues/.archived/2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md"
related:
  - ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
  - ".agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md"
  - ".agents/issues/.open/2026-08-05-guided-install-flow-for-safari-web-users.md"
  - ".agents/issues/.open/2025-12-09-encryption-state-evals-bloat.md"
  - ".agents/docs/features/user-data-backup.md"
  - ".agents/docs/config-sync-system.md"
---

# Backup/restore overhaul

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Claims are labelled **MEASURED** (a recorded observation exists, cited),
> **READ** (verified at the cited `file:line`, 2026-08-09) or **INFERRED**
> (reasoned, not observed).
>
> **§1 is now MEASURED** (2026-08-09) — see §1.1. The rest of the document is
> still READ/INFERRED: no backup has been taken on a real account, no database
> wiped, no restore attempted.

## What this document is

**The single issue for the backup rework.** Design plus the slice plan. It absorbs
`2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md`, now archived — its Double
Ratchet analysis is §6 here, and §6.1 records two of its claims that failed
re-checking against the code.

**Not approved for implementation.** §10 lists what has to be settled first; §10.1
is the one item that must be settled *before anything is built*, because the whole
document rests on it.

---

## 1. The finding that sets the scope

The backup is documented as protection against total data loss. For the users who
most need it, **it cannot restore a single Space** — and not because import skips
`user_config` (the known limitation), but because the space keys were never written
into the file.

**READ.** `config.spaceKeys` — the per-Space `{encryptionState, keys[]}` bundle —
is assembled from IndexedDB in exactly one place:
[`ConfigService.ts:591`](../../../src/services/ConfigService.ts#L591). That line
sits **inside `if (config.allowSync)`**
([`ConfigService.ts:554`](../../../src/services/ConfigService.ts#L554)). A
codebase-wide search for `spaceKeys` finds no other writer (`src/utils.ts:15`, the
dev DB inspector, and tests are the only other hits).

**READ.** `getDefaultUserConfig` initialises `spaceKeys: []` and `allowSync: false`
([`utils.ts:10-31`](../../../src/utils.ts#L10-L31)).

**READ.** The export reads the config straight from IndexedDB — `getAllDMData`
calls `this.getUserConfig({ address })`
([`messages.ts:2266`](../../../src/db/messages.ts#L2266)).

**Therefore:** a user who has never enabled sync has `user_config.spaceKeys === []`
on disk, permanently. Their `.qmbak` contains a list of `spaceIds` and **no key
material for any of them**. Fixing import to stop skipping `user_config` would
restore an empty array.

### 1.1 Confirmed by measurement, 2026-08-09

This was INFERRED when written. It is now **MEASURED**, and the claim held.

**Instrument:** [`src/dev/tests/services/backupSpaceKeyCoverage.test.ts`](../../../src/dev/tests/services/backupSpaceKeyCoverage.test.ts)
— integration, not unit: real `MessageDB` on fake-indexeddb, real
`ConfigService.saveConfig`, real `BackupService.exportBackup`, real WebCrypto.
Only the network and the wasm signing core are stubbed. It seeds a Space with the
full seven-key set that `SpaceService` writes on create, exports a backup,
decrypts it, and searches the whole payload for the `owner` private key.

| Arm | One flag differs | Result |
|---|---|---|
| **A — sync OFF** | `allowSync: false` | Owner key appears **nowhere** in the payload. `user_config.spaceKeys` is empty. No `space_keys` or `spaces` domain exists in the file at all |
| **B — sync ON (control)** | `allowSync: true` | The **same** export **does** carry the owner key, and all seven Space keys |

Arm B is what makes Arm A mean anything: without a control that *should* find the
key, "found nothing" is indistinguishable from "looked in the wrong place".

**Verified sensitive by mutation.** A passing assertion proves nothing until it has
been shown able to fail. Assembling `spaceKeys` outside the `allowSync` branch —
the hypothetical fix — turns **all three Arm A tests red** and leaves the controls
and Arm B green. The mutation was reverted; full suite 1169 passing.

**Two findings fell out of the same run:**
- The payload has no `space_keys` domain whatsoever, confirming there is **no second
  source** of key material in the file (§5).
- **Space Triple Ratchet states already ship in every `.qmbak` today** (§5's claim,
  now measured) — the state for `<spaceId>/<spaceId>` is present in the sync-off
  export. Only the keys that would make it usable are missing.

This is the inverse of the protection the feature advertises. The `allowSync=false`
user is precisely the one with no server-side copy of anything, and their backup is
the one that silently omits the irreplaceable part.

> **This is currently the only escape hatch for a sync-off user.** The two-tier
> config split that would have let someone sync keys while withholding preferences
> is **parked pending the lead dev** (see the decision box in
> [`2026-08-07-config-sync-overhaul-design.md`](2026-08-07-config-sync-overhaul-design.md)).
> Until that conversation happens, `allowSync` stays one switch: keys on the server,
> or keys nowhere but this device. Backup is the whole of "nowhere but this device".

---

## 2. What is actually at risk

The database has **20 object stores** (READ, schema at
[`messages.ts:260-417`](../../../src/db/messages.ts#L260-L417)). The backup writes
4 of them into the file and restores 2.

| Store | In export? | On import? | Recoverable without a backup? |
|---|---|---|---|
| `messages` | ⚠️ DM only | ✅ | ❌ DMs gone. Space messages **resync from peers** |
| `conversations` | ⚠️ DM only | ✅ | ❌ |
| `encryption_states` | ✅ **all of them, incl. Spaces** | ❌ discarded | ❌ |
| `user_config` | ✅ but see §1 | ❌ discarded | Only if `allowSync` was on |
| **`space_keys`** | ❌ | ❌ | ❌ **never — see below** |
| `spaces` | ❌ | ❌ | ✅ manifest re-fetched from the API |
| `space_members` | ❌ | ❌ | ✅ roster sync |
| `space_member_devices` | ❌ | ❌ | ✅ announce-keys |
| `user_info` | ❌ | ❌ | ✅ identity announce |
| `bookmarks` | via config | ❌ | Only if sync was on |
| `user_notes` | via config | ❌ | Only if sync was on |
| `muted_users`, `channel_threads`, `thread_read_times`, `deleted_messages` | ❌ | ❌ | ❌ local-only UX state, low value |
| `search_indices`, `action_queue` | ❌ | ❌ | ✅ rebuildable / ephemeral |
| `inbox_mapping`, `latest_states`, `conversation_users` | ❌ | ❌ | **dead stores — see §6.1** |

Two rows carry almost all the weight:

**`space_keys` is the crown jewel.** A created Space writes seven keys — `config`,
`hub`, `owner`, `inbox`, `signing`, `<groupAddress>`, `<spaceAddress>` (READ,
[`SpaceService.ts:356-431`](../../../src/services/SpaceService.ts#L356-L431)).
The `owner` private key is what proves you own the Space. It exists in exactly two
places: this device's IndexedDB, and the synced config blob if sync is on. **There
is no third copy and no re-derivation.** Lose both and the Space is unownable by
anyone, forever — the same permanent-brick class as
[`2026-08-02-delete-space-is-leave-and-can-permanently-brick-a-space.md`](../2026-08-02-delete-space-is-leave-and-can-permanently-brick-a-space.md),
reached by a different route.

**Space messages are the large, partly-recoverable one.** They live in `messages`
alongside DMs, but the export filters to `type: 'direct'` conversations
([`messages.ts:2244`](../../../src/db/messages.ts#L2244); `Conversation.type` is
`'direct' | 'group'` and Space channels are not conversation rows — READ,
`quorum-shared/src/types/conversation.ts:9`). They resync from peers, so they are
the one genuinely optional inclusion. A single-member Space, or one whose peers are
all offline, keeps nothing.

---

## 3. What a Space restore actually needs (the mechanism already exists)

Do not design this from scratch. `getConfig` already contains a working
adopt-a-Space-from-key-material path, run on every fresh device that turns sync on
(READ, [`ConfigService.ts:116-282`](../../../src/services/ConfigService.ts#L116-L282)):

1. `if (!existingSpace)` — **skip any Space already present locally.** Additive by
   construction; it cannot clobber a live Space.
2. Require a `config` key and a `hub` key, else log and skip.
3. Save every key except `signing` (the per-device-signing flip — a fresh device
   must land on its own key, [`ConfigService.ts:132-143`](../../../src/services/ConfigService.ts#L132-L143)).
4. `getSpace(spaceId)` + `getSpaceManifest(spaceId)` from the API; decrypt the
   manifest with the `config` private key. **The Space definition is re-fetched, not
   restored** — it never needs to be in the file.
5. Generate a **fresh** inbox keypair, `postHubAdd` to register it, `listen` on it.
6. Save the Space's `encryptionState` re-keyed to the new inbox address.
7. Send a `sync` control message so peers replay history.

**This is the single most important fact in this document:** restoring Spaces from a
backup is *the same operation* as adopting them from a synced config. The mechanism
is shipped, exercised on every multi-device login, and additive. The backup path
needs a different **source** for `spaceKeys` — the file instead of the server — not
a different algorithm.

**INFERRED, needs confirmation:** step 6 reuses a Triple Ratchet state captured at
backup time, so a stale `.qmbak` carries a staler state than a live config would.
Whether that matters is the Space-side echo of the DM question in §6 and should be
answered at the same time. Note the mitigating asymmetry: the inbox is regenerated
and re-registered, so this is not a straight resumption of an old session.

---

## 4. The merge problem, stated properly

The current import has one behaviour for every situation. The real situations:

| # | Local device state | Backup contains | Correct outcome |
|---|---|---|---|
| 1 | Empty (wiped/new) | everything | Restore everything |
| 2 | Spaces present (sync was on), no DMs | both | Restore DMs; **touch no Space** |
| 3 | Some Spaces (partial sync) | more Spaces | Add the missing ones only |
| 4 | Some DMs | more DMs | Union of conversations and messages |
| 5 | Live account, backup is **older** | stale everything | Add what is absent, overwrite nothing live |
| 6 | Live account, backup is **newer** (restored to the wrong device) | newer everything | Still additive — a backup must never be able to damage a working device |
| 7 | Same backup imported twice | everything | Second import is a no-op |

**The design mistake to avoid is a global mode switch** ("merge" vs "full restore",
or "is the DB empty?"). Cases 2 and 3 are the same import and disagree per domain:
Spaces must be left alone while DMs are restored, and within Spaces, some restored
and some skipped. A whole-file mode cannot express that, and "is the database empty"
is not knowable in a way that is safe to bet key material on — a device that has
logged in already has a config, an identity, and possibly a partially-synced Space
list.

**The rule instead: reconcile per record, keyed by identity, and let each domain
choose its own rule.** Every case above then falls out without a mode:

| Domain | Rule | Why |
|---|---|---|
| Spaces + `space_keys` | **Additive only.** Restore a Space iff absent locally. Never overwrite a present Space's keys | Exactly `if (!existingSpace)` from §3. The live device's keys may be newer (per-device inbox); the backup's are certainly not |
| DM messages / conversations | **Upsert by id** (already correct today) | Idempotent, gives case 7 free |
| DM ratchet states | **Only where no state exists for that conversation** — and gated on §6 | The one place where restoring can destroy something working |
| Bookmarks / user notes | **Existing merge** — last-write-wins + tombstones | `ConfigService.mergeBookmarks` ([`ConfigService.ts:821`](../../../src/services/ConfigService.ts#L821)) already solves this; reuse it rather than writing a second merge |
| Config scalars (name, bio, prefs) | **Fill absent fields only**, or explicit user choice | Silently reverting someone's display name to a six-month-old value is a bad surprise |
| `allowSync` | **Never restore it.** Device-local | Adopting it from a file re-opens exactly what [`2026-08-08-make-allowsync-a-per-device-setting.md`](2026-08-08-make-allowsync-a-per-device-setting.md) closed |
| Space messages | Upsert by id, if included at all (§7) | |

### 4.1 Additive is only half of it — deletions need tombstones

**Raised 2026-08-09, and the case list above misses it entirely.** Take a backup,
then delete some DMs, or leave a Space, or get kicked from one — then restore the
older backup. Every rule in the table says "the file has it, the device doesn't,
so add it", and the user's deliberate removal is silently undone.

Additive and tombstones are **orthogonal**, and both are required:

| Axis | What it protects | Mechanism |
|---|---|---|
| The user **changed** something | live keys beat stale keys | additive — never overwrite what is present |
| The user **removed** something | a deletion is not undone | tombstone — never re-add what was removed |

The unifying rule: **an import must never contradict a decision the user made
after the backup was taken.** "Absent locally" is not sufficient grounds to
restore, because absence has two causes — never known, and deliberately removed —
and only a tombstone distinguishes them.

**DM messages — FIXED 2026-08-09.** Tombstones existed (`deleted_messages`, DB v7)
but were written for **channel messages only**, on an explicit rationale: *"DMs
don't have a sync mechanism, so tombstones aren't needed"*. That was true when
written. **Backup restore is precisely the mechanism that makes it false.** DM
deletions now write tombstones too — purely additive, since nothing else consumes
them for DMs — and `importDMData` refuses to write any message carrying one.
Covered by `backupSpaceRestore.test.ts`, control-armed (a never-deleted message
must still restore, or the gate could pass by writing nothing) and
mutation-verified.

**Space departures — OPEN, and the harder half.** No leave/kick tombstone exists
anywhere (READ: no `deletedSpaceIds`, `leftSpaces` or equivalent in `src/`). So
restoring a backup taken before leaving **will** re-add the Space, and worse than
locally: `adoptSpaces` calls `postHubAdd` and sends a `sync` control message, so a
kicked user silently re-announces to a Space that removed them. That is an
outward-facing action taken on stale state.

The obvious fix — write the tombstone inside `MessageDB.deleteSpace()`, the single
choke point all three removal paths funnel through — **does not work as stated**,
and this is the trap to avoid:

| Caller | Meaning |
|---|---|
| [`SpaceService.ts:685`](../../../src/services/SpaceService.ts#L685) | leave / delete — a real departure |
| [`MessageService.ts:5638`](../../../src/services/MessageService.ts#L5638) | kicked — a real departure |
| [`EncryptionService.ts:305`](../../../src/services/EncryptionService.ts#L305) | **not a departure** — a space-address *migration*, which deletes the old `spaceId` and immediately re-saves under a new one |

Tombstoning in `deleteSpace` would mark a migrated Space as "left". It happens to
be harmless for the restore gate (the retired id should not be resurrected either),
but it conflates two different facts under one name, which is how the next bug gets
written. **The tombstone must be recorded by the departure call sites, not by the
store method.** A rejoin must clear it — `clearTombstonesForSpace` is the existing
precedent for exactly that.

This needs a DB version bump and touches kick/leave, so it is **its own slice**
(now slice 2b) rather than an addendum. Until it lands, the restore reports which
Spaces it re-registered so the behaviour is at least not silent.

Two further consequences worth stating out loud, because they are what make this safe:

- **Additive-only means an import can never make a device worse.** That single
  invariant covers cases 5, 6 and 7 and removes the need to reason about backup age
  at all. It should be the property the tests assert, not a behaviour that happens
  to emerge.
- **A restore must report what it did, per domain** — "12 Spaces restored, 3 already
  present, 418 DMs restored, 2 conversations skipped (live session)". A silent count
  of messages is what let the current gap sit undetected. Same reasoning as
  [`2026-08-08-record-and-show-what-the-last-config-publish-actually-did.md`](2026-08-08-record-and-show-what-the-last-config-publish-actually-did.md).

---

## 5. Where the restored Space keys come from

`spaceKeys` in the config blob is a **snapshot written only on upload** — and for a
sync-off user, never written at all (§1). The export must therefore **not** read
`user_config.spaceKeys`. It must read the live stores directly:

```
space_keys        → all rows, all Spaces        (messageDB.getSpaceKeys per Space)
spaces            → row list, for spaceIds only (definition re-fetched at restore)
encryption_states → already fully exported, Space states included
```

**READ:** `getAllEncryptionStates()` is an unfiltered `store.getAll()`
([`messages.ts:1019-1030`](../../../src/db/messages.ts#L1019-L1030)), and a Space's
state is stored under `conversationId = spaceId + '/' + spaceId`
([`ConfigService.ts:579`](../../../src/services/ConfigService.ts#L579)). **The
Space-side ratchet states are already in every `.qmbak` file on disk today** —
**MEASURED**, §1.1, the `<spaceId>/<spaceId>` state is present in a sync-off
export. Only the keys that make them meaningful are missing.

This also decouples the fix from the config-sync overhaul: reading `space_keys`
directly means a correct backup **does not depend on the parked tiering decision**,
and works identically whether sync is on, off, or has never been on.

### 5.1 Size — MEASURED 2026-08-09

~10k polynomial evals (~2 MB) are pre-allocated per **created** Space, a joined one
costs ~12-63 KB, and deleted Spaces leak their state rather than remove it (see
[`2025-12-09-encryption-state-evals-bloat.md`](2025-12-09-encryption-state-evals-bloat.md);
a real account measured 4112 KB of encryption states, and another 19.4 MB local
across 10 states of which 8 were orphaned debris).

Measured against the real export path (`backupSpaceKeyCoverage.test.ts`, "MEASUREMENT"):

| Export | `.qmbak` bytes |
|---|---|
| 1 Space + 1 DM, no eval pool | **6,469 B** (~6 KB) |
| Same, with one 2 MB eval pool | **4,200,753 B** (~4.0 MB) |
| Growth | **4,194,284 B = exactly 2.00× the pool** |

**Two findings.**

1. **The eval pool passes into the backup intact.** Nothing filters it, exactly as
   nothing filters it out of the config upload. Backup size is therefore governed by
   the evals bug, not by message volume — the account above would produce an ~8 MB
   file with *no messages at all*.
2. **🆕 The file is 2× its payload, because the ciphertext is hex-encoded**
   ([`BackupService.ts`](../../../src/services/BackupService.ts), `Buffer.from(encrypted).toString('hex')`).
   Two hex chars per byte. **Switching the encoding to base64 would cut every
   backup by ~33%** (2.00× → 1.33×) for a few lines of change, with the same
   v1-reader discipline as the rest of §7. Worth doing in slice 5 when the size
   budget is being decided anyway. Not urgent — a local file has no server ceiling
   — but it is the cheapest size win available and nothing else in the design
   competes with it.

**A `.qmbak` is a local file, not an API payload, so the ~1 MB config ceiling does
not apply.** The practical ceiling is what a user will tolerate downloading, and on
these numbers the dominant term is a bug being fixed elsewhere.

---

## 6. The DM session problem (absorbed from the archived issue)

Restoring DM *history* works today. Restoring DM *sessions* does not, and the
obvious fix is unsafe.

### The current behaviour

Export **does** capture ratchet states — `getAllDMData` returns `encryption_states`
([`messages.ts:2263`](../../../src/db/messages.ts#L2263)). Import **drops them**:
`importDMData` accepts only `{ messages, conversations }` and its transaction opens
only those two stores
([`messages.ts:2282-2288`](../../../src/db/messages.ts#L2282-L2288)), and
`BackupService.importBackup` states the intent — *"Import messages and conversations
only (skip encryption_states and user_config)"*
([`BackupService.ts:202`](../../../src/services/BackupService.ts#L202)).

**The reasoning is correct for the case it was built for**: merging a backup into a
live account, where overwriting ratchet state would break decryption with
counterparties. The problem is that restoring onto an empty database has the
opposite correct behaviour, and both go through the same code path. §4 removes that
conflation.

### Why the obvious fix is unsafe (INFERRED — needs SDK confirmation)

"Just import the encryption states when the DB is empty" **should not be implemented
as stated.**

`EncryptionState.state` is a single opaque JSON-serialized ratchet blob
([`encryption-state.ts:130-156`](../../../../quorum-shared/src/crypto/encryption-state.ts#L130-L156)).
Sending and receiving chains are not separable at the app layer.

Timeline: backup at T1 → user sends messages T1→T2 (sending chain advances) → wipe
at T2 → restore the T1 state → user sends again. The restored sending chain is
**rewound**. In Double Ratchet a message key derives from the chain key and message
number, so the same chain key at the same message number produces the **same message
key**. Encrypting different plaintext under an already-used key+nonce pair breaks
confidentiality for both messages.

Restoring state for **receiving** carries no such hazard — receiving chains derive
decryption keys and reuse is harmless. But the blob is opaque, so the app cannot
restore one without the other. **This is why the DM half needs SDK input rather than
an app-layer patch.**

### What already works (do not break it)

- **Sending re-initiates.** `DoubleRatchetInboxEncryptForceSenderInit`
  ([`MessageService.ts:1537`](../../../src/services/MessageService.ts#L1537)) opens a
  fresh session when no state is present, so a user can resume talking to the same person.
- **Inbound frames are retained, not destroyed.** Frames for an unknown inbox are
  kept unread ([`MessageService.ts:4376`](../../../src/services/MessageService.ts#L4376))
  rather than dropped, so they are recoverable if state ever returns.
- **History restore works today.**

### Directions

**D1 — Restore for receive, force-init for send.** Import the ratchet state so
retained-unread frames become decryptable, but never send from a restored state:
force a new outbound session on the first send. Requires the SDK to expose a
receive-only restore mode or a "discard the sending chain" operation. Sidesteps the
hazard entirely rather than reasoning about whether a given restore is safe.
**Evaluate first.**

**D3 — Restore only into a provably empty database.** Gate on zero encryption
states. Does *not* remove the rewind hazard — a wiped device restoring a stale
backup still has a rewound sending chain. **Insufficient alone.**

**D4 — Fallback if D1 proves impractical.** State plainly in the UI and the doc that
`.qmbak` restores *history*, not *sessions*, and that conversations resume on a new
session. Strictly better than silently implying more than it delivers, and it
**unblocks the rest of this issue** — see slice 4.

> *(D2, "complete the export first", was withdrawn 2026-08-09 — see §6.1. Nothing
> needs adding to the export for DMs.)*

### 6.1 Two corrections to the archived issue (READ)

Its "gap 2" listed `inbox_mapping` and `latest_states` as DM-session-critical stores
missing from the export. **Both are dead, and inbound routing uses neither.**

- **Routing reads `encryption_states` directly.** `handleNewMessage` builds a map
  from `getAllEncryptionStates()` keyed by `inboxId` and looks up
  `states[message.inboxAddress]`
  ([`MessageService.ts:3892-3898`](../../../src/services/MessageService.ts#L3892-L3898)).
  `inbox_mapping` is not consulted. The "unknown inbox" log it cited as evidence
  fires on a missing **state**, not a missing mapping.
- **`inbox_mapping` has no writer and no reader.** Only `getInboxMapping`
  ([`messages.ts:1054`](../../../src/db/messages.ts#L1054)) — zero callers in
  `src/` — and `deleteInboxMapping` ([`messages.ts:2423`](../../../src/db/messages.ts#L2423)).
  Nothing ever puts a row in.
- **`latest_states` is written and deleted, never read.** Written in
  `saveEncryptionState` ([`messages.ts:1640`](../../../src/db/messages.ts#L1640)),
  deleted from `EncryptionService.ts:79` and `MessageService.ts:7744`. No read path
  outside the dev DB inspector.
- **The per-conversation inbox keypair — its third open question — is inside
  `encryption_states.state`**, already exported. The blob is a serialized
  `DoubleRatchetStateAndInboxKeys`; the handler does `JSON.parse(found.state)` and
  reads `keys.sending_inbox`
  ([`MessageService.ts:4403-4406`](../../../src/services/MessageService.ts#L4403-L4406)),
  and the init path takes `inbox_private_key` off the session
  ([`MessageService.ts:4072`](../../../src/services/MessageService.ts#L4072)).

**Net: `encryption_states` alone carries the routing key, the ratchet, and the inbox
keypair.** The DM restore is materially simpler than the archived issue estimated;
the only open question is the crypto one above. Re-verify this before building
(§10.2) — if either store gains a reader in the meantime, the DM slice grows.

---

## 7. Format and versioning

`BackupFile.version` is the literal `1` and `parseBackupFile` hard-rejects anything
else ([`BackupService.ts:135`](../../../src/services/BackupService.ts#L135)). Adding
payload domains needs **version 2, and a v1 reader kept** — v1 files exist on users'
disks and must keep importing, restoring what they contain.

- **Per-domain presence flags** so a restore can report "this file has no Space keys
  — it was taken before v2" instead of silently restoring nothing. **Non-negotiable:**
  by §1, every existing v1 file in the wild is in exactly that state.
- **Space messages in or out by default?** Open — §10.4.
- **Encryption is unchanged and stays unchanged.** AES-256-GCM under
  `SHA-512('quorum-backup-v1' || privKey)[0:32]`. **No passphrase** — decided, §10.7.

---

## 8. Slices

One issue, shipped in order. Each slice ends in something observable.

**Slice 1 — Export the Space keys. ✅ SHIPPED 2026-08-09.**
`MessageDB.getAllSpaceData()` reads the `spaces` and `space_keys` stores directly;
format bumped to v2 with per-domain presence flags; v1 reader kept; a file from a
*newer* format is refused rather than half-restored. Import unchanged.
*Observable, now true:* a sync-off export carries all seven Space keys including
`owner`. Covered by `backupSpaceKeyCoverage.test.ts`, whose sync-off assertions
were inverted in the same commit — and which pins that
`user_config.spaceKeys` is **still** empty in that export, so the fix demonstrably
works by reading the owning store rather than by the snapshot quietly filling in.

**Slice 2 — Restore Spaces, additive only. ✅ SHIPPED 2026-08-09.**
`ConfigService.adoptSpaces` extracted from `getConfig` (pure move, 46 existing
tests green) and reused by the import via injection, so `BackupService` does not
depend on `ConfigService`. Exposed on the MessageDB context as `adoptSpaces`,
following the `saveConfig` pattern. Import reports per-domain counts.
Deletion tombstones for DMs landed with it (§4.1).
*Observable:* wipe a sync-off device, import → Spaces return and channels load;
import again → "0 restored, 1 already present". Both property tests
mutation-verified.

**Slice 2b — Space-departure tombstones. ✅ SHIPPED 2026-08-09.**
New `departed_spaces` store at DB v15, written at the two genuine departure sites
— `SpaceService.deleteSpace` (`left`) and `MessageService`'s removed-from-space
handler (`removed`) — and **not** in `MessageDB.deleteSpace`, which
`EncryptionService` also uses for a space-address migration. Cleared by
`InvitationService` on rejoin, next to the existing `clearTombstonesForSpace`.

**The gate lives in `BackupService`, not `adoptSpaces`.** That method also serves
config sync, where the payload is the account's *current* state published after
the departure, rather than a snapshot from the past; blocking there would break
leaving a Space on one device and rejoining on another. A backup file is stale by
construction, a synced config is not — and that distinction is asserted by a test.
*Observable:* leave a Space, import an older backup → "you left this Space after
this backup was taken", nothing re-registered. Mutation-verified, and the
departure write is asserted at the `SpaceService` call site rather than only
through the DB helper.

**Slice 3 — Honest reporting and pre-flight.** Before writing a file, show what it
will contain (including that it holds Space ownership keys — §10.7). Before
restoring, show what the file holds and what will be skipped.
*Observable:* the export dialog names the domains; a v1 file imported into v2 code
says plainly that it has no Space keys.

**Slice 4 — DM sessions.** Restore ratchet states only where no state exists for
that conversation. **The only slice gated on the SDK answer (§10.3).**
*Observable:* the two-party harness in §9.
> **This slice must not block slices 1-3, 5 or 6.** If the SDK answer is slow or
> unfavourable, ship D4 — the honest-copy fallback — and close the rest of the issue
> without it. Sequencing it fourth is deliberate: every slice it depends on is
> already delivered by then.

**Slice 5 — Space message history.** Opt-in, after §10.4 and a real size measurement.

**Slice 6 — Mobile parity.** Mobile has no `.qmbak` reader; a desktop backup should
restore on mobile and vice versa. Format and reconcile rules belong in
`quorum-shared` so the two clients cannot drift. Last deliberately: the format has
to stop moving first.

---

## 9. Verification

Blast radius is key material and message delivery — silent when wrong, undetectable
by using the app. Reasoning about the diff is not verification here.

- [x] **Baseline first, before any code.** ✅ **Done 2026-08-09** — §1.1. Automated
      rather than hand-run, so it is repeatable and runs in CI:
      `backupSpaceKeyCoverage.test.ts`. Sync-off export contains no Space key
      material. **§1 confirmed.**
- [x] **Control arm.** ✅ Arm B (sync on) finds the owner key in the same export.
      Not both-empty, not both-populated — the instrument discriminates.
- [x] **Mutation check on the instrument itself.** ✅ Assembling `spaceKeys` outside
      the `allowSync` branch turns Arm A red and leaves the controls green.
- [x] **Size measured** ✅ **2026-08-09** — §5.1. Done against the real export path
      with a realistic eval pool rather than a real account, so it is repeatable.
      §10.4 no longer waits on it.
- [ ] **Still owed: one real-account export.** The instrument measures the real
      save/export chain against a *seeded* database. That establishes the mechanism,
      not one real account's actual on-disk state — in particular how many orphaned
      encryption states a long-lived account is really carrying. Worth one export
      when convenient; it blocks nothing.
- [ ] Wipe → login → import. Record per domain what returned and what did not.
- [ ] **Additive invariant, adversarially.** Import an *old* backup into a *live*
      account with more Spaces and newer DMs. Assert byte-equality of every
      pre-existing `space_keys` row and every live encryption state. This is the
      property the whole design rests on; test it as a property, not per-case.
- [ ] Import the same file twice → second run writes nothing.
- [ ] Import a v1 file into v2 code → messages and conversations restore, and the UI
      says plainly that no Space keys were present.
- [ ] Import another account's file → still fails to decrypt.
- [ ] **Revert each fix and confirm its test goes red.** An assertion that passes
      either way is worse than no test.
- [ ] Measure the exported file size on a real multi-Space account **before** deciding
      §10.4.
- [ ] After restore with sync on: confirm the re-published config is not a *shrunken*
      Space list mid-restore, or the refuse-to-publish guard
      ([`ConfigService.ts:674`](../../../src/services/ConfigService.ts#L674)) will hold
      the upload — correct behaviour, but it must not be mistaken for a restore failure.

**Slice 4 additionally requires a two-party harness.** Two accounts, a DM with
history. Export on A, wipe A, import. Record precisely: what history is readable,
whether a message B sent while A was wiped ever decrypts, whether A can send,
whether B sees it. Control arm with no wipe at all — if both arms show the same
failure, the harness is measuring something else. Adversarial check: take a backup,
send 50 more messages, wipe, restore, send, and inspect whether any two ciphertexts
share a key/nonce pair. And confirm restoring into a **live** account still leaves
live sessions untouched.

---

## 10. To settle before implementing

1. ~~**Confirm §1 empirically.**~~ ✅ **SETTLED 2026-08-09 — the claim held.** See
   §1.1. Measured by `backupSpaceKeyCoverage.test.ts`, control-armed and
   mutation-verified. Slices 1 and 2 are solving a real problem. What is still
   owed is a real-account export for the **file-size** number, which gates item 4
   below but blocks nothing else.
2. **Re-verify §6.1 against the code.** If `inbox_mapping` or `latest_states` gain a
   reader between now and implementation, the DM slice grows.
3. **The SDK question (§6):** can a rewound sending chain re-derive an already-used
   message key, and can the SDK expose a receive-only restore (D1)? Gates slice 4 only.
   Ask about the Space-side Triple Ratchet staleness (§3 step 6) in the same conversation.
4. **Space messages in the default export?** Still open, but **no longer blocked on
   a measurement** — see §5.1. The size picture came back different from the
   assumption: the dominant term is the ~2 MB-per-created-Space eval pool, not
   message volume, and hex encoding doubles whatever that comes to. An account with
   no messages at all can already produce an ~8 MB file. So "Space messages are the
   size risk" was wrong; they should be judged on whether a backup that silently
   omits history deserves the name, which is a product call. Two cheap wins to fold
   in when it is made: base64 instead of hex (~33% off every file), and excluding
   orphaned encryption states for Spaces no longer in `spaces`.
5. **Config scalars: fill-absent, or ask the user?** (§4) — product decision.
6. **Does restore belong in onboarding?** Today import is only reachable post-login
   from Settings. For the Safari install flow
   ([`2026-08-05-guided-install-flow-for-safari-web-users.md`](2026-08-05-guided-install-flow-for-safari-web-users.md))
   this is the migration mechanism, and burying it in Settings is a poor fit.
7. **Passphrase on top of the account-key derivation? — 🛑 DECIDED 2026-08-09: NO.**
   Raised and rejected the same day. The threat model does not support it and the
   durability cost is real:
   - *File stolen, account key safe* → AES-GCM under the account-derived key already
     protects it completely. A passphrase adds nothing.
   - *File stolen **and** account key compromised* → the attacker can already log in,
     read future DMs and impersonate the user. Space ownership is marginal against a
     loss that is already total. A passphrase only helps if stored separately from the
     key, which for most users it would not be.
   - *Cost:* a forgotten passphrase makes the backup undecryptable — exactly the data
     loss the feature exists to prevent. Adding a second losable secret to a
     disaster-recovery artifact is net-negative for durability.
   - The account key already **is** a durable user-held secret: `.key` download and
     copy-to-clipboard both ship in Settings → Security
     ([`2026-06-11-port-key-paste-import-and-copy-export.md`](../port-from-mobile/.done/2026-06-11-port-key-paste-import-and-copy-export.md)).
   **What survives is a labelling requirement, not a crypto one** (slice 3): the export
   UI must say the file contains Space ownership keys. People choose where to store
   "my chat history" differently from "the keys to my Spaces".

---

## Prevention

- **Backup restore paths need per-domain reconcile rules, not one code path.** "Merge
  into a live account" and "restore onto an empty device" have opposite correct
  behaviour for session state, and a real import is usually *both at once* for
  different domains. One path serving both is what produced this.
- **Export and import must be tested as a round trip against an empty target.**
  Testing import into a populated DB hides exactly this class of defect, because the
  missing pieces are already present.
- **A snapshot field is not a source of truth.** `user_config.spaceKeys` looks like
  the Space key store and is actually a copy written on one branch of one function.
  Anything that must survive data loss should be read from the store that owns it.
- **A partial backup is a liability, not a partial win.** It changes user behaviour:
  someone who has taken a backup stops taking other precautions. If it cannot fully
  restore, the UI must say so.
- **Opaque crypto blobs constrain what the app layer can safely do.** Any feature that
  rewinds, replays or partially restores cryptographic state needs SDK-level support
  and review, not app-level cleverness.

---

## Related

- [Config sync overhaul](2026-08-07-config-sync-overhaul-design.md) — the parked tiering split is why backup is currently the sync-off user's only recovery path
- [Safari ITP wipes IndexedDB after 7 idle days](2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) — a trigger that destroys Space keys, not just DMs
- [Guided install flow for Safari web users](2026-08-05-guided-install-flow-for-safari-web-users.md) — depends on restore as its migration path
- [Delete Space is leave, and can permanently brick a Space](../2026-08-02-delete-space-is-leave-and-can-permanently-brick-a-space.md) — same permanent-loss class, different route
- [Encryption state evals bloat](2025-12-09-encryption-state-evals-bloat.md) — sets the file-size budget
- [User Data Backup & Restore](../../docs/features/user-data-backup.md) — the feature as documented; its "Known Limitations" understated §1 until corrected 2026-08-09
- [ARCHIVED: `.qmbak` backup cannot restore DM session continuity](../.archived/2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md) — absorbed into §6

_Last updated: 2026-08-09_
