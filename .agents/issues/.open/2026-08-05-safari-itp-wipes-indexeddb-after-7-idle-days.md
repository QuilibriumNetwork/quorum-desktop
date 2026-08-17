---
type: bug
title: "Safari (macOS + iOS) wipes all IndexedDB after 7 idle days — DM ratchet state and history are unrecoverable"
status: open
priority: high
ai_generated: true
created: 2026-08-05
updated: 2026-08-17
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

**2026-08-17 — M4 shipped in PR #350** (`feat(settings): remind sync-off users
that this device is their only copy`), along with the two measurements this
issue asked for.

What landed: a warning on the General settings tab shown only when `allowSync`
is off and no backup was taken in 30 days, linking straight to Data Backup;
`utils/lastBackup.ts` to record exports; and the `dm-itp-wipe` and
`space-wipe-restore` harness scenarios that establish claims B and C below.

**Stays open — deliberately.** The remaining work needs Apple hardware or is
unbuilt:

- **Claim A is still unverified** and cannot be verified on this machine. Real
  Safari, and a 7-day counter that cannot be advanced from outside.
- **M2** (guided install) — specced separately, unbuilt, and gated on the same
  hardware for its own Phase 0 (does passkey auth work in an installed iOS web
  app).
- **M3** (`navigator.storage.persist()`) — unbuilt.
- **M5** (add ITP eviction to the backup doc's list of loss scenarios) — not
  done. PR #350 touched that doc for a different reason and did not add it.
- **M6** (record the user-level ITP opt-out) — not done.

**The consequence is now measured. The Safari trigger is not.**

The issue makes two claims, and they need different instruments:

| Claim | Status |
|---|---|
| **A.** WebKit deletes script-writable storage after 7 days of Safari use without interaction | **Still unverified here.** Documented by WebKit and demonstrated by third parties, but nobody on this project has watched it happen. Needs real Safari on Apple hardware; the 7-day counter cannot be advanced from outside. |
| **B.** Once the database is gone, DM history and sessions do not come back, while the conversation can resume on a fresh session | **VERIFIED 2026-08-17**, headless, by `dm-itp-wipe` (see Verification). |
| **C.** Login restores profile, Spaces and Space keys | **VERIFIED 2026-08-17** by `space-wipe-restore` — **but only when `allowSync` is on, which is not the default.** With sync off the eviction takes the Spaces as well. The recoverability table below is corrected accordingly. |

Splitting them matters because B is where every mitigation lands, and B is
**not Safari-specific**: the client cannot tell *why* its database vanished.
ITP, a "clear site data" click and a brand-new device are the same event to it.
So B was testable immediately, on Windows, without Apple hardware — which is
what made the 8-day Mac reproduction stop being a blocker on everything else.

Still `high` rather than `critical`: the affected population remains unmeasured
(what share of users are on Safari web rather than Electron).

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

> **⚠️ Corrected 2026-08-17 after measurement.** An earlier version of this table
> marked profile, Spaces and Space keys as recoverable without qualification.
> **That is only true if the user has `allowSync` ON.** It is device-local and
> **defaults to OFF** ([ConfigService.ts:289](../../../src/services/ConfigService.ts#L289),
> `storedConfig?.allowSync ?? false`), and both the `spaceKeys` build and the
> `postUserSettings` call sit inside `if (config.allowSync)`
> ([:695](../../../src/services/ConfigService.ts#L695),
> [:864](../../../src/services/ConfigService.ts#L864)). With sync off, **nothing
> is ever published**, so there is nothing to restore from and the eviction takes
> the Spaces too. Measured both ways by `space-wipe-restore` — see Verification.

| Data | Store | Recoverable? | How |
|---|---|---|---|
| Account identity | passkey `largeBlob` (platform authenticator) | ✅ | Not browser storage; survives |
| Profile (name, avatar, bio) | encrypted server config | ✅ **only if `allowSync`** | Re-fetched on login. MEASURED: returns with sync on, absent with sync off |
| Spaces list | encrypted server config | ✅ **only if `allowSync`** | MEASURED: 1 Space restored with sync on, 0 with sync off |
| Space keys | encrypted server config (`config.spaceKeys`) | ✅ **only if `allowSync`**, minus `signing` | MEASURED: 6 of 7 keys return. `signing` is skipped **by design** ([ConfigService.ts:467](../../../src/services/ConfigService.ts#L467)) so a restored device signs with its own per-device `inbox` key |
| Space ratchet state | encrypted server config (`config.spaceKeys[].encryptionState`) | ✅ **only if `allowSync`** | MEASURED: the Space group ratchet is the *only* ratchet state that returns |
| Bookmarks, settings | encrypted server config | ✅ **only if `allowSync`** | Same parcel, same gate |
| **DM message history** | IndexedDB `messages` | ❌ | No server-side message storage (P2P). MEASURED: 0 restored |
| **DM conversation metadata** | IndexedDB `conversations` | ❌ | Same. MEASURED: 0 restored |
| **DM Double Ratchet states** | IndexedDB `encryption_states` | ❌ | Same. MEASURED: not in the config parcel; does not return |
| Space message history | IndexedDB `messages` | ⚠️ | Likely re-syncable from peers via the sync manifest protocol — **still unverified** |

**The practical consequence of the `allowSync` gate.** The population most
exposed to this bug is not the one the table originally implied. A sync-off user
— the default — loses *everything* local to an eviction: DMs **and** Spaces
**and** profile. The server is holding nothing for them.

**Their one protection is a `.qmbak` file**, and since PR #324 it is a real one:
the export reads the `space_keys` and `spaces` stores directly rather than the
sync-only `user_config.spaceKeys` snapshot, so a sync-off backup carries the
Space keys — including `owner` — that it previously omitted. See M1 for the
measured coverage. That makes the ordering here:

1. **M2 (install)** — the only mitigation that stops the wipe happening.
2. **M4 (prompt for a backup)** — the only thing that helps a user it already
   happened to, and now unblocked.
3. Everything else softens the edges.

`allowSync` stays **off** by default (product decision, 2026-08-17). This issue
should not propose flipping it; it should assume sync-off is the norm and make
the backup path carry the weight.

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

### M1 — ~~Make `.qmbak` able to restore DM sessions~~ → **RESOLVED, and the answer was "no"**

> **Superseded 2026-08-17.** This mitigation is closed. Both of its premises have
> moved, and the earlier text here — plus its link to a since-archived issue —
> was sending readers to the wrong conclusion.

**What was decided.** Restoring DM ratchet state is now deliberately **never**
done, rather than done carefully. Rewinding a sending chain risks message-key
reuse, and the overhaul chose to remove that hazard instead of managing it
(slice 4 of [the backup/restore overhaul](2026-08-09-backup-restore-overhaul-design.md),
which **supersedes** the old split-out issue, now at
`.agents/issues/.archived/2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md`).

**What shipped instead (PR #324).** The export stopped reading the
`user_config.spaceKeys` snapshot — empty for a sync-off user — and now reads the
`spaces` and `space_keys` stores directly. So a backup carries the Space key
material it always claimed to, **regardless of `allowSync`**.

**Verified 2026-08-17** by running the suites, not by reading them: 36 tests pass
across `backupSpaceKeyCoverage.test.ts` and `backupSpaceRestore.test.ts`,
including `restores a Space onto a wiped device`, which throws the database away
and asserts the `owner` **private key** comes back from the file. A live-relay
restore is covered by `space-kick.scenario.test.ts`, whose control arm confirms a
Space does rebuild for a user who was never kicked.

**So, for a sync-off user holding a backup:**

| | Restored from `.qmbak`? |
|---|---|
| Spaces, Space keys (incl. `owner`), profile | ✅ |
| DM message history, conversations | ✅ |
| DM Double Ratchet sessions | ❌ **by design** — conversations resume on a fresh session |

The residual is no longer a missing capability. It is that **taking a backup is
manual**, which is M4.

### M2 — Warn Safari users and steer them to install → **specced separately**

The only mitigation that **prevents** the wipe rather than softening it, and the
only one that does not ask the user to weaken their browser's privacy settings.
Installed web apps are exempt from ITP eviction.

Full spec: [2026-08-05-guided-install-flow-for-safari-web-users.md](2026-08-05-guided-install-flow-for-safari-web-users.md).
**It covers macOS desktop as well as iOS** — Add to Dock (Safari 17+) is the
desktop equivalent of Add to Home Screen and grants the same ITP exemption.

Three things found while speccing it that belong here:

- **Install is gated on an unverified assumption.** Nobody has confirmed that passkey auth (`navigator.credentials.get()` + `largeBlob`) works inside an iOS standalone web app. If it does not, this mitigation collapses and this bug needs a different answer. That check is Phase 0 of the install task and should run before anything else here.
- **Installing does not carry the user's data across.** An iOS Home Screen web app gets a **separate storage partition** from Safari: no shared IndexedDB, localStorage, cookies or service worker. So telling a Safari-tab user to install means telling them to start with an empty database and leave their history behind in the tab. The handoff is export `.qmbak` → import in the installed app. **Updated 2026-08-17:** that handoff now works for everything except DM session continuity — Spaces, keys and history all cross over (see M1), and existing conversations resume on a fresh session. So install advice is safe to give provided it is paired with "export a backup first", which is not optional here: without the file, a sync-off user who installs starts from nothing. (Whether macOS Add to Dock partitions the same way is unverified, and desktop users are the ones likeliest to have the most history to lose.)
- **The install advice is only safe if the origin never changes.** Passkeys are scoped to `app.quorummessenger.com` (the SDK omits `rp.id`, so WebAuthn defaults it to the calling origin's effective domain), and IndexedDB is keyed by origin. The QStorage hosting migration must therefore change only what sits *behind* that hostname. If the URL changes, every passkey stops working and every local database is orphaned at once — and an installed web app is pinned to its origin too, so everyone who followed this advice would be stranded. Full detail in the install task under "Blocking constraints".

### M3 — Call `navigator.storage.persist()` on startup (code, trivial)

Genuinely protects Chrome and Firefox users against quota-pressure eviction, and
succeeds on Safari once the app is installed. Log the result so we can see, in the
field, how often it is granted.

### M4 — Prompt for a backup → ✅ **SHIPPED 2026-08-17 in PR #350**

> **What landed.** `BackupStatus` on the General settings tab, directly below
> the passkey warning. Shown only when `allowSync` is off **and** no backup was
> taken in the last 30 days, so a sync-on user never sees it. No dismiss button:
> taking the backup is the dismissal, because an X would silence the warning
> while leaving the user equally exposed. The link lands on the Data Backup
> section and moves focus there. `utils/lastBackup.ts` records exports, written
> inside the hook so the silent no-keyset return cannot mark a user as covered.
>
> **Not a schedule.** It prompts; it does not export. And it only reaches users
> who open Settings — which, as `SyncStatusLine` already notes for itself, is
> the population least in need of it. A surface outside Settings was considered
> and deliberately deferred; that remains the real gap.
>
> **Known limit, accepted:** an anchor-click download reports nothing back, so
> cancelling the browser's save dialog still records a backup. The 30-day expiry
> bounds it to being reminded late rather than never.

Original reasoning, kept because it explains why this was blocked for so long:

The `.qmbak` export exists but is manual and buried in Settings → Privacy/Security.
A periodic nudge (or an automatic export to the Downloads folder in Electron)
converts it from a feature nobody uses into an actual safety net.

> **Unblocked 2026-08-17.** This was previously held back on the grounds that
> "prompting users to take a backup that cannot fully restore would manufacture
> false confidence". That reasoning no longer applies: since PR #324 a backup
> restores Spaces, Space keys and DM history, for sync-off users too (M1). The
> only thing it does not restore is DM session continuity, and that is a
> deliberate decision rather than a shortfall, so a prompt is no longer promising
> something the file cannot deliver.

**With `allowSync` staying off by default, this is the only protection a default
user has.** The server holds nothing for them: no profile, no Spaces, no keys. A
`.qmbak` file is the entire safety net, and today it only exists if the user went
looking for it. The honest framing for any prompt is therefore "this is your only
copy", not "extra safety".

Copy should not over-promise: a restore brings back history and Spaces, and
existing DM conversations continue on a new session.

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

**Do not close this on reasoning.**

### Measured 2026-08-17 — `dm-itp-wipe` (headless, Windows)

`src/dev/tests/harness/dm-itp-wipe.scenario.test.ts`, run with
`yarn harness dm-itp-wipe`. Two bots on the live relay, real `MessageService`,
real SDK crypto, `fake-indexeddb` for storage. It seeds DM history both ways,
destroys one side's entire database with `indexedDB.deleteDatabase` (the way the
browser does it, not row by row), and counts what is left through
`getAllDMData` — deliberately the same read the `.qmbak` export uses, so a count
of zero means *a backup taken at that moment would capture nothing*.

```
bob BEFORE  messages=3 conversations=1 sessions=1
bob AFTER   messages=0 conversations=0 sessions=0
seeded=3 revived=0 onDiskNow=[recover-init #1 | after-wipe #1]
databases immediately after wipe:            quorum_db_itp-alice
databases after first read (init recreates): quorum_db_itp-alice, quorum_db_itp-bob
```

What that establishes:

- **The DM loss is total.** Messages, conversations and ratchet states all go to
  zero together. Nothing in the app restores them.
- **The conversation still resumes.** With no encryption state present, the send
  path opens a fresh session (`ForceSenderInit`) and traffic flows both ways
  again — `recover-init #1` reached the peer, `after-wipe #1` came back.
- **Resuming does not revive history.** 0 of 3 seeded messages returned. This is
  the distinction the issue turns on, and it is now pinned by an assertion
  rather than by argument.
- **Control arm held.** The eviction hit one side only; the other party's census
  was byte-identical before and after. If both had moved, the harness would have
  been sharing one database between bots and every number above would be junk.

Two things it measured that were **not** obvious beforehand, both worth carrying
into any fix:

- **`quorum_db` existing proves nothing.** The database is recreated, empty, the
  instant anything reads — `MessageDB.init()` rebuilds the schema. A diagnostic
  that checks for the database's presence would report "fine" on a wiped account.
  Sample before the first read or the measurement is worthless.
- **Counting persistence callbacks overcounts.** One logical message can be saved
  more than once (un-acked frames are redelivered on `listen`; the receive path
  also salvages the message embedded in a refused init envelope). A first cut
  asserted `=== 2` and measured 4. The test asserts on distinct message bodies.

**The test can fail** (checked, not assumed): swapping `wipeAll()` for the older
`wipeSessions()` — which removes only `encryption_states` — turns it red with
`messages=3 conversations=1 sessions=0`. So it genuinely distinguishes a session
wipe from a storage eviction, which is exactly the difference this issue is about.

### Measured 2026-08-17 — `space-wipe-restore` (headless, Windows)

`src/dev/tests/harness/space-wipe-restore.scenario.test.ts`, run with
`yarn harness space-wipe-restore`. Answers the "what does login restore"
question, which `dm-itp-wipe` could not reach: that path runs through
`ConfigService.getConfig`, and the DM harness is transport-level.

Two accounts, identical shape (one Space, a profile name, a DM each). **One
variable: `allowSync`.** Both are evicted identically, then both log back in.

```
sync ON  BEFORE   spaces=1 keys=[…,config,hub,inbox,owner,signing] name=Synced   dmMessages=2 dmConvs=1
sync ON  WIPED    spaces=0 keys=[]                                  name=(none)  dmMessages=0 dmConvs=0
sync ON  RESTORED spaces=1 keys=[…,config,hub,inbox,owner]          name=Synced  dmMessages=0 dmConvs=0

sync OFF BEFORE   spaces=1 keys=[…,config,hub,inbox,owner,signing] name=Unsynced dmMessages=2 dmConvs=1
sync OFF WIPED    spaces=0 keys=[]                                  name=(none)  dmMessages=0 dmConvs=0
sync OFF RESTORED spaces=0 keys=[]                                  name=(none)  dmMessages=0 dmConvs=0
```

- **Sync on:** the Space, its keys and the profile name all return. DMs stay at
  zero — the login that rebuilt an entire Space restores no conversation data,
  because none of it is in the parcel.
- **Sync off:** nothing returns. Not the Space, not the keys, not the profile.
  This is the default setting.
- **`signing` is the one key that does not come back, deliberately.**
  `adoptSpaces` skips it ([ConfigService.ts:467](../../../src/services/ConfigService.ts#L467))
  so a restored device signs with its own per-device `inbox` key rather than
  adopting the shared slot. The test asserts the exact key set, so removing that
  `continue` goes red rather than silently regressing the per-device signing design.
- **Only the Space group ratchet returns.** The restored `encryption_states` row
  is `<spaceId>/<spaceId>`. The DM ratchet is not in the config and does not come
  back — which is the same conclusion `dm-itp-wipe` reached from the other side.

**Causation checked, not assumed.** Flipping *only* the sync-off arm to
`allowSync: true` makes it restore its Space (`spaces=0` → `1`) and turns the
test red. So the difference between the arms is `allowSync` itself, not some
incidental difference between the two accounts.

### Still open

- [ ] **Reproduce claim A.** On a Mac, log into `app.quorummessenger.com` in Safari, seed a space and a DM with history. Use Safari daily for other sites, never returning to Quorum. Check at day 8. Record exactly which IndexedDB databases survive (`quorum_db`, SDK `KeyDB`).
  - Needs Apple hardware. Cloud Safari services do not help: their sessions last minutes and the counter needs days.
  - The "faster proxy" (Empty Caches / Manage Website Data) is now redundant for the *app-side* question — `dm-itp-wipe` answers it repeatably. The Mac run is only needed to confirm WebKit's **trigger**.
- [ ] **Control arm.** Same procedure in Chrome. It must **not** wipe. Only meaningful once the Safari arm above actually runs.
- [ ] Confirm the installed case is exempt: repeat with the app added to the Dock.
- [x] ~~After a wipe, confirm what login actually restores (expected: profile, spaces, space keys; not DMs).~~ **Done** — `space-wipe-restore`, see above. The expectation was right *for sync-on users only*; the table above is corrected.
- [x] ~~Decide whether a sync-off user losing their Spaces to an eviction is acceptable.~~ **Decided 2026-08-17: `allowSync` stays OFF by default.** So the answer is not to sync more, it is to make the backup path carry the weight — M2 to prevent the wipe, M4 to make a backup exist when it happens anyway. Do not reopen this as "default sync on".
- [x] ~~After a wipe, confirm a DM to an existing contact re-initiates via `ForceSenderInit` and both sides can talk again.~~ **Done** — see above.
- [x] ~~After M1, confirm a `.qmbak` restore into the wiped profile brings back a *decryptable* existing session — and that restoring into a live account still leaves live states untouched.~~ **Moot.** M1 was resolved by deciding never to restore DM ratchet state, so there is no restored session to check. The half that does apply — a restore into a live account leaving live state untouched — is covered by the additive property tests in `backupSpaceRestore.test.ts`.
- [x] ~~Revert M1 and confirm the new test goes red.~~ **Done in the equivalent form**, by the people who shipped it: the sync-off export assertions in `backupSpaceKeyCoverage.test.ts` were mutation-verified (assembling `spaceKeys` outside the `allowSync` branch turns all three arm-A tests red, controls stay green). The two scenarios added by this issue were mutation-verified the same way — see each Measured block above.
- [ ] **Confirm a `.qmbak` round trip survives a real eviction end to end**, rather than a fixture wipe: same account, database destroyed underneath it, import, then actually use the restored Space. `backupSpaceRestore.test.ts` swaps in a fresh database and `space-kick` restores into a *different* bot identity; neither is quite the returning user. Low priority — the parts are each measured, only the seam is not.

## Prevention

- **Treat "the browser deletes our data" as a supported scenario, not an anomaly.** For a P2P app with no server-side message store, local storage is the only copy of DM history. Any recovery path must be tested against a genuinely empty database, not only against a merge into a live one.
- **Backup import paths need two modes.** "Merge into live account" and "restore onto empty device" have opposite correct behaviour for session state. Conflating them is what produced M1.
- **Check platform storage policy when choosing a store.** WebKit's rules differ from Chromium's in ways that are invisible during development, because developers interact with their own app daily and never burn the counter.

## Related

- [PWA feasibility report](../../reports/2026-08-05-pwa-mobile-fallback-feasibility.md) §3.2 — where this was found; the same eviction rule is the reason installation is a precondition for the PWA plan rather than an enhancement
- [User Data Backup & Restore](../../docs/features/user-data-backup.md) — the `.qmbak` feature and its current limits
- [Cryptographic Architecture](../../docs/cryptographic-architecture.md) §Key Storage Locations — what lives in IndexedDB
- [Profile Sync on Returning User Login](../../docs/features/profile-sync-returning-user-login.md) — the recovery path that already exists for identity and profile
- `src/dev/tests/harness/dm-itp-wipe.scenario.test.ts` — the reproduction of the app-side DM consequence; `yarn harness dm-itp-wipe`
- `src/dev/tests/harness/space-wipe-restore.scenario.test.ts` — what login restores, sync on vs off; `yarn harness space-wipe-restore`
- [Make allowSync a per-device setting](2026-08-08-make-allowsync-a-per-device-setting.md) — the `allowSync` gate this issue now depends on
- [Backup/restore overhaul](2026-08-09-backup-restore-overhaul-design.md) — shipped the Space-key backup (PR #324) that makes `.qmbak` the sync-off user's recovery path. **Supersedes** the old `qmbak-backup-cannot-restore-dm-sessions` issue this file used to link to, now in `.archived/`

---

*Last updated: 2026-08-17*
