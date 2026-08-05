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

**Why the rule exists** (worth knowing, because it explains why the exemption is
what it is). In 2019 ITP capped JavaScript-set cookies to 7 days to stop
first-party cookies being used for cross-site tracking. Trackers moved their
identifiers into `localStorage` and IndexedDB instead — storage which, in
WebKit's own words, has *"no expiry function at all"* and which a site cannot
even ask the browser to time-limit. The 2020 change extended the same 7-day rule
to all script-writable storage to close that bypass. The underlying heuristic is
"a site you genuinely use will be revisited, and revisiting resets the counter" —
sound for tracking, and wrong for local-first apps where local storage is the
only copy of the data. This was flagged at the time: contemporary coverage of the
backlash warned it could *"effectively block decentralized apps using the browser
as a trusted replication node in a peer-to-peer network"*, which describes Quorum
exactly. Apple's answer to that class of app has been consistent: install it.
Chrome and Firefox do **not** time-delete first-party storage — Safari is the
outlier, not the norm.

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

### M1 — Make `.qmbak` able to restore DM sessions → **split out**

> **Corrected 2026-08-05.** An earlier draft of this issue described this as a
> small conditional-import fix. That was wrong. The export is missing
> `inbox_mapping` and `latest_states`, the ratchet blob is opaque so send and
> receive chains cannot be separated at the app layer, and naively restoring a
> rewound sending chain risks message-key reuse. It needs SDK input.

Tracked separately as
[2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md](2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md).
It is **independent of ITP** — it applies equally to cache clears, device resets
and new devices — so it should not block or be blocked by the mitigations below.

### M2 — Warn Safari users and steer them to install → **specced separately**

The only mitigation that **prevents** the wipe rather than softening it, and the
only one that does not ask the user to weaken their browser's privacy settings.
Installed web apps are exempt from ITP eviction.

Full spec: [2026-08-05-guided-install-flow-for-safari-web-users.md](2026-08-05-guided-install-flow-for-safari-web-users.md).
**It covers macOS desktop as well as iOS** — Add to Dock (Safari 17+) is the
desktop equivalent of Add to Home Screen and grants the same ITP exemption.

Three things found while speccing it that belong here:

- **Install is gated on an unverified assumption.** Nobody has confirmed that passkey auth (`navigator.credentials.get()` + `largeBlob`) works inside an iOS standalone web app. If it does not, this mitigation collapses and this bug needs a different answer. That check is Phase 0 of the install task and should run before anything else here.
- **Installing does not carry the user's data across.** An iOS Home Screen web app gets a **separate storage partition** from Safari: no shared IndexedDB, localStorage, cookies or service worker. So telling a Safari-tab user to install means telling them to start with an empty database and leave their DM history behind in the tab. The handoff is export `.qmbak` → import in the installed app, which routes this bug straight through [the backup issue](2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md) and its session-continuity gap. **The two issues are less independent than originally filed.** (Whether macOS Add to Dock partitions the same way is unverified, and desktop users are the ones likeliest to have the most history to lose.)
- **The install advice is only safe if the origin never changes.** Passkeys are scoped to `app.quorummessenger.com` (the SDK omits `rp.id`, so WebAuthn defaults it to the calling origin's effective domain), and IndexedDB is keyed by origin. The QStorage hosting migration must therefore change only what sits *behind* that hostname. If the URL changes, every passkey stops working and every local database is orphaned at once — and an installed web app is pinned to its origin too, so everyone who followed this advice would be stranded. Full detail in the install task under "Blocking constraints".

### M3 — Call `navigator.storage.persist()` on startup (code, trivial)

Genuinely protects Chrome and Firefox users against quota-pressure eviction, and
succeeds on Safari once the app is installed. Log the result so we can see, in the
field, how often it is granted.

### M4 — Prompt for a backup on a schedule (UX, medium)

The `.qmbak` export exists but is manual and buried in Settings → Privacy/Security.
A periodic nudge (or an automatic export to the Downloads folder in Electron)
converts it from a feature nobody uses into an actual safety net. **Blocked on
[the backup issue](2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md)** —
prompting users to take a backup that cannot fully restore would manufacture
exactly the false confidence that issue is about.

### M6 — Document the user-level ITP opt-out, but do not recommend it (docs, trivial)

Safari → Settings → Privacy → uncheck **Prevent Cross-Site Tracking** disables ITP
entirely, including this deletion. (A Develop → Experimental Features toggle for
just this rule also exists but resets on every Safari update, so it is not a real
answer.)

Record it for completeness, and do **not** put it in user-facing guidance. Asking
the users of a privacy-focused encrypted messenger to switch off their browser's
anti-tracking protection in order to keep their data is a bad trade and a worse
look — and this user base is the one most likely to have set it deliberately.
M2 (install) achieves the same protection without asking anyone to weaken
anything.

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
