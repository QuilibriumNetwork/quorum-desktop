---
type: bug
title: "Safari (macOS + iOS) wipes all IndexedDB after 7 idle days — DM ratchet state and history are unrecoverable"
status: open
priority: high
ai_generated: true
created: 2026-08-05
updated: 2026-08-05
related_docs:
  - "../../docs/features/user-data-backup.md"
  - "../../docs/cryptographic-architecture.md"
  - "../../docs/features/profile-sync-returning-user-login.md"
related_reports:
  - "../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md"
---

# Safari wipes all IndexedDB after 7 idle days — DM ratchet state and history are unrecoverable

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Found while researching PWA feasibility. **This is not a mobile-only or
> future-only problem** — it affects `app.quorummessenger.com` users on
> **macOS Safari today**.

## Status

Unverified against a live Safari instance. The mechanism is confirmed from
WebKit's own documentation and the code paths are confirmed by reading this
repo, but **no one has yet watched a real Quorum account get wiped**. That
reproduction is step 1 of any fix (see Verification). Filed as `high` rather
than `critical` because the affected population is currently unmeasured.

## Symptoms

A user who opens Quorum in **Safari** (macOS or iOS), then does not return to
the site for **7 days of Safari use**, finds on their next visit that:

- their message history is gone
- their DM conversations no longer decrypt incoming messages
- the app behaves as if they had logged in on a brand-new device

Their **account is not lost** — the passkey lives in the platform authenticator,
not in browser storage — so they can log back in. Profile, spaces and space keys
come back. **DM history and DM sessions do not.**

### Who is affected

| Client | Affected? | Why |
|---|---|---|
| macOS Safari (tab) | **Yes** | WebKit ITP |
| iOS Safari (tab) | **Yes** | WebKit ITP |
| Safari, added to Dock (macOS 14+) | No | Standalone web apps have their own use counter |
| iOS, added to Home Screen | No | Same |
| Electron desktop app | No | Chromium, no ITP |
| Chrome / Brave / Edge / Firefox | No | Eviction only under disk pressure, and `persist()` is honoured |
| iOS Chrome / Brave / Firefox | **Yes** | All iOS browsers are WebKit |

**The at-risk user is the occasional Safari web user**, not the daily one. Daily
use resets the counter and they never see it. Someone who travels for two weeks,
or checks Quorum weekly, is squarely in range.

**Unmeasured and needed:** what share of web users are on Safari, and what share
use the web app rather than Electron. That number sets the real priority.

## Root Cause

### 1. WebKit deletes script-writable storage after 7 days of non-interaction

WebKit's ITP deletes **all** script-writable storage for an origin after seven
days of browser use without user interaction on that site. Covered: **IndexedDB**,
LocalStorage, SessionStorage, Media keys, and **Service Worker registrations and
cache**.

Two details that are easy to get wrong:

- It is **seven days of Safari use**, not seven calendar days. A user who does not open Safari at all does not burn the counter.
- Any interaction with the site as first-party **resets** the counter.

Exemption, in WebKit's own words: *"Web applications added to the home screen are
not part of Safari and thus have their own counter of days of use… We do not
expect the first-party in such a web application to have its website data
deleted."*

Sources: [WebKit — Full third-party cookie blocking and more](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) (the announcement),
[WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) (2023 quota model),
[lapcatsoftware — Safari Un-Intelligent Tracking Prevention](https://lapcatsoftware.com/articles/2023/8/5.html)
(2023, demonstrates the deletion on **macOS desktop** with evidence from Safari's
own resource-load-statistics SQLite DB).

### 2. `navigator.storage.persist()` is never called — and would not help in a tab anyway

**The app never calls it.** Repo-wide grep for `storage.persist` / `StorageManager`
across `src/` and `web/` returns **zero hits** (MEASURED).

Worth fixing regardless, but be clear about what it buys: WebKit *"grants a
request based on heuristics like whether the website is opened as a Home Screen
Web App"* ([Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)).
In a plain Safari tab the request is refused. **`persist()` helps Chrome and
Firefox users; it does not rescue the Safari tab case.** Only installing does.

### 3. What is actually lost vs recoverable

| Data | Store | Recoverable? | How |
|---|---|---|---|
| Account identity | passkey `largeBlob` (platform authenticator) | ✅ | Not browser storage; survives |
| Profile (name, avatar, bio) | encrypted server config | ✅ | Re-fetched on login |
| Spaces list | encrypted server config | ✅ | Same |
| Space keys + space ratchet state | encrypted server config (`config.spaceKeys`) | ✅ | [ConfigService.ts:545-561](../../../src/services/ConfigService.ts#L545-L561) backs up `keys` + `encryptionState` per space |
| Bookmarks, settings | encrypted server config | ✅ | Same parcel |
| **DM message history** | IndexedDB `messages` | ❌ | No server-side message storage (P2P) |
| **DM conversation metadata** | IndexedDB `conversations` | ❌ | Same |
| **DM Double Ratchet states** | IndexedDB `encryption_states` | ❌ | Same |
| Space message history | IndexedDB `messages` | ⚠️ | Likely re-syncable from peers via the sync manifest protocol — **unverified** |

The existing [User Data Backup & Restore](../../docs/features/user-data-backup.md)
doc already names this class of loss: *"scenarios where DM data is permanently
unrecoverable due to the P2P architecture (no server-side message storage)"*. It
lists browser cache clears and the Safari passkey bug. **ITP eviction belongs on
that list and is not currently on it.**

### 4. The `.qmbak` backup does not restore DM continuity

This is the part worth acting on, because it is a code fix rather than a platform
constraint.

Export **does** capture ratchet states — `getAllDMData()` returns
`encryption_states` ([messages.ts:2251](../../../src/db/messages.ts#L2251)) and
`BackupService` writes them into the payload.

Import **discards them, unconditionally**. `importDMData` accepts only
`{ messages, conversations }` and its transaction opens only those two stores
([messages.ts:2270-2278](../../../src/db/messages.ts#L2270-L2278)).
`BackupService.importBackup` comments the intent: *"Import messages and
conversations only (skip encryption_states and user_config)"*
([BackupService.ts:202](../../../src/services/BackupService.ts#L202)).

**The reasoning is sound for the case it was designed for** — merging a backup
into an account with live sessions, where overwriting ratchet state would break
decryption with counterparties. It is wrong for the disaster-recovery case, where
there is no live session to protect and the states in the file are the only copy
that exists.

Net effect: restoring a backup after a wipe gives you back your **readable
history**, but not the ability to **continue those conversations** on their
existing sessions.

### 5. Partial mitigation that already exists in the send path

Not all DM function is lost. `DoubleRatchetInboxEncryptForceSenderInit`
([MessageService.ts:1537](../../../src/services/MessageService.ts#L1537)) lets the
app open a **new** session when no encryption state is present, so a user can
start talking to the same person again. And inbound frames for an unknown inbox
are *retained unread* rather than dropped ([MessageService.ts:4376](../../../src/services/MessageService.ts#L4376)),
so they are not destroyed on arrival.

So the accurate statement is **not** "DMs are permanently broken". It is: history
is lost, in-flight messages on the old session cannot be read now, and the
conversation resumes on a fresh session. Confirming that this actually happens
end to end is part of Verification below.

## Proposed mitigations

Ordered by ratio of user protection to effort.

### M1 — Restore ratchet states when the target is empty (code, small, highest value)

Make the import conditional instead of unconditional: if `encryption_states` is
empty for a conversation, import the state from the backup; if a live state
exists, keep skipping it. This preserves the original merge safety and turns
`.qmbak` into real disaster recovery.

- `src/db/messages.ts:2270` — extend `importDMData` to accept `encryption_states` and add the store to the transaction
- `src/services/BackupService.ts:202` — stop dropping them at the call site
- Needs a test that a restore into an empty DB yields a decryptable existing session, and that a restore into a live account leaves the live state untouched

### M2 — Warn Safari users and steer them to install (UI, small)

Detect WebKit-without-standalone (`navigator.standalone === false` plus a Safari
UA check, or `display-mode: browser`) and show a persistent, dismissible notice
explaining that browser storage will be cleared after a week of not visiting, with
one-click paths to **Add to Dock** (macOS 14+) or **Add to Home Screen** (iOS).

This is the only mitigation that actually prevents the wipe rather than softening
it. Costs nothing and works today.

### M3 — Call `navigator.storage.persist()` on startup (code, trivial)

Genuinely protects Chrome and Firefox users against quota-pressure eviction, and
succeeds on Safari once the app is installed. Log the result so we can see, in the
field, how often it is granted.

### M4 — Prompt for a backup on a schedule (UX, medium)

The `.qmbak` export exists but is manual and buried in Settings → Privacy/Security.
A periodic nudge (or an automatic export to the Downloads folder in Electron)
converts it from a feature nobody uses into an actual safety net. Only worth
building **after M1**, since today's backup does not restore session continuity.

### M5 — Add ITP eviction to the backup doc's list of loss scenarios (docs, trivial)

[user-data-backup.md](../../docs/features/user-data-backup.md) lists cache clears,
device resets and the Safari passkey bug. Add this, so the next person to read it
knows it is a routine occurrence rather than an edge case.

## Verification

**Do not close this on reasoning.** The mechanism is documented but the specific
consequence for a Quorum account has not been observed. Establish the baseline
first, then re-run after each mitigation.

- [ ] **Reproduce.** On a Mac, log into `app.quorummessenger.com` in Safari, seed a space and a DM with history. Use Safari daily for other sites, never returning to Quorum. Check at day 8. Record exactly which IndexedDB databases survive (`quorum_db`, SDK `KeyDB`).
  - Faster proxy for iteration: Safari → Develop → Empty Caches, or delete the origin's data in Settings → Privacy → Manage Website Data. Confirm it produces the same end state before trusting it as a substitute.
- [ ] **Control arm.** Same procedure in Chrome. It must **not** wipe. If both arms wipe, the instrument is measuring something else.
- [ ] Confirm the installed case is exempt: repeat with the app added to the Dock.
- [ ] After a wipe, confirm what login actually restores (expected: profile, spaces, space keys; not DMs).
- [ ] After a wipe, confirm a DM to an existing contact re-initiates via `ForceSenderInit` and both sides can talk again.
- [ ] After M1, confirm a `.qmbak` restore into the wiped profile brings back a *decryptable* existing session — and that restoring into a live account still leaves live states untouched.
- [ ] Revert M1 and confirm the new test goes red. An assertion that passes either way is worse than no test.

## Prevention

- **Treat "the browser deletes our data" as a supported scenario, not an anomaly.** For a P2P app with no server-side message store, local storage is the only copy of DM history. Any recovery path must be tested against a genuinely empty database, not only against a merge into a live one.
- **Backup import paths need two modes.** "Merge into live account" and "restore onto empty device" have opposite correct behaviour for session state. Conflating them is what produced M1.
- **Check platform storage policy when choosing a store.** WebKit's rules differ from Chromium's in ways that are invisible during development, because developers interact with their own app daily and never burn the counter.

## Related

- [PWA feasibility report](../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md) §3.2 — where this was found; the same eviction rule is the reason installation is a precondition for the PWA plan rather than an enhancement
- [User Data Backup & Restore](../../docs/features/user-data-backup.md) — the `.qmbak` feature and its current limits
- [Cryptographic Architecture](../../docs/cryptographic-architecture.md) §Key Storage Locations — what lives in IndexedDB
- [Profile Sync on Returning User Login](../../docs/features/profile-sync-returning-user-login.md) — the recovery path that already exists for identity and profile
