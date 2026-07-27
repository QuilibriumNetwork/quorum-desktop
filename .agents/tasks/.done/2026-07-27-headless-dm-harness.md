---
type: task
title: "Headless DM harness — drive the real client in Node to debug DM transport without two browsers"
status: IN PROGRESS — slice 1
created: 2026-07-27
branch: feat/headless-dm-harness
area: DM transport / testing infrastructure
related:
  - .agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md (the investigation this replaces the manual rig for; §6 THE RIG)
  - .agents/bugs/2026-07-26-dm-desktop-to-desktop-captures.md (round evidence the harness output must feed)
  - .agents/tools/dm-debug/ (dr-ablate, dr-replay, dr-position-table — the log analyzers the harness feeds)
  - .agents/tasks/2026-07-21-device-registration-ghost-accumulation-cross-platform.md (why bots reuse a persisted device keyset)
---

# Headless DM harness

## Why

Every DM-transport question today costs a manual round: two browsers, hand-typed
numbered messages, save both consoles at the same instant, reassemble chunked
`[XPDUMP]` lines, glance back 20 min later for loss. The operator IS the
bottleneck (`.agents/bugs/2026-07-26-...-resurfaced.md` §6). This harness moves
the cost from *human attention* to *machine time*: one Node process hosts the
**real** `MessageService`, both sides, one clock, arbitrary volume, unattended.

It is NOT a reimplementation of the protocol. It re-hosts the real client:

| layer | browser | harness |
|---|---|---|
| crypto | SDK wasm core | same wasm core |
| storage | IndexedDB | `fake-indexeddb` (already a devDependency) |
| transport | `fetch` + `WebSocket` | Node 22 native `fetch` + `WebSocket` |
| logic | `src/services/MessageService.ts` | **the same file, imported** |

If a bug lives in the app, the harness hits it. Output is a JSONL log that feeds
`.agents/tools/dm-debug/dr-ablate.mjs` unchanged.

## Scope (this task)

- Transport only. DM send/receive between bots. NO adversarial/security scenarios
  (deliberate, per operator decision 2026-07-27 — revisit separately).
- Desktop client only. Not mobile, not the UI layer.

## Non-goals / honest limits

- Does not exercise React rendering, scroll, receipt icons — protocol + service layer only.
- Not mobile; RN-specific bugs stay on-device.
- A bot is a real device on the account → multi-device fan-out topology, not
  identical to a pure two-desktop case (but two bots + no browser IS clean d↔d).
- May NOT reproduce the aged-session degradation (§ slice 4). If synthetic volume
  doesn't age the session, that is itself a useful negative result (trigger is
  time or cross-platform, not volume) — and slice 4 falls back to importing a
  real degraded `EncryptionState` row from a browser.

## Placement (decided 2026-07-27)

No new root folder. Scenarios live in the dev test tree (already tsconfig-excluded,
already the Vitest home). Log analyzers stay next to the dr-* tools.

```
src/dev/tests/harness/          NEW — scenarios + bot rig
  README.md                     how to run (what other devs read)
  .env.example                  committed, placeholders only
  .env.local                    gitignored (.env.local + *.local.*)
  identity.ts                   ed448 hex → user keyset + device keyset (+ persist)
  transport.ts                  fetch + WebSocket, the {type:'listen'} subscription
  storage.ts                    fake-indexeddb → real MessageDB
  deps.ts                       the ~17 MessageServiceDependencies stubs
  bot.ts                        assembles one client: .send() .on() .dumpState()
  log.ts                        structured JSONL, one clock, both sides
  importSession.ts              (slice 4) load an aged EncryptionState from a browser
  dm-basic.scenario.test.ts
  dm-volume.scenario.test.ts
  dm-reconnect.scenario.test.ts
  logs/                         gitignored (real key material)

.agents/tools/dm-debug/         unchanged — dr-ablate/replay/position-table
vitest.harness.config.ts        NEW root config: node env, real WS + webcrypto, long timeout
package.json                    "harness": "vitest --config vitest.harness.config.ts"
```

### Why a separate Vitest config
`src/dev/tests/setup.ts` deliberately MOCKS `WebSocket` and `crypto` for unit
tests — the opposite of what the harness needs. Harness config: `environment:
'node'`, real `WebSocket`, real `webcrypto`, `fake-indexeddb` installed globally,
`testTimeout` in the hours. Reuses the Vite transform pipeline so lingui macros
and `.web.ts` resolution work when `MessageService` is imported (plain node can't
do this — which is exactly why the existing dr-*.mjs only import the SDK, never a
service).

## Instrumentation — does NOT need the `diag/dm-frame-join` branch (decided 2026-07-27)

The manual rig's probes (`[DM-send branch]`, `[XPDUMP]`, etc.) live only on
`diag/dm-frame-join` because a browser is a black box: the only way to see inside
is to make `MessageService` log its own guts — which smears real key material into
the service and is why that branch is never merged.

The harness runs IN-PROCESS with full access, so it instruments from the OUTSIDE
against clean `main`:
- owns transport → sees every frame (the sealed message)
- owns `MessageDB` → reads any `EncryptionState` row before/after any decrypt
- gets `DmDecryptError` directly (main already throws it, carrying raw + branch)

So the harness WRITES the `[XPDUMP]` records itself, from data it already holds,
in the exact format `dr-replay`/`dr-ablate` parse — and can dump state on EVERY
frame, not just failures (full `dr-position-table` data). No inline service
logging, no key material in service code, clean-main build.

Only genuinely-internal signals the external view can't see: which of the 5 send
sites / which decrypt branch fired. Already ruled out as causal (§3 rows 4, 8, 10;
the load-bearing signal is ratchet STATE, which the harness controls). If ever
needed, add 2 narrow mergeable log hooks to the harness build — NOT the diag branch.

→ Harness stays on `feat/headless-dm-harness` off clean `main`.

## Keys & safety (baked into README)

- Throwaway accounts ONLY, never a real identity.
- `.env.local` gitignored; `.env.example` placeholders only. Never read/commit real keys.
- `logs/` gitignored — contains real ratchet key material (same warning as §6).
- Each bot persists its device keyset to a gitignored state file and REUSES it, so
  runs don't spawn new device registrations (feeds ghost-accumulation otherwise).
- Talks to PRODUCTION `api.quorummessenger.com` (same as browsers). Real frames on
  the live relay. Throwaway accounts make this acceptable.

```
# .env.example
BOT_A_PRIVATE_KEY=          # 114-char ed448 hex, throwaway account only
BOT_B_PRIVATE_KEY=
QUORUM_API_URL=https://api.quorummessenger.com
QUORUM_WS_URL=wss://api.quorummessenger.com/ws
```

## Confirmed API surface (src/api/baseTypes.ts)

`QuorumApiClient`: `getUser` / `postUser` (register) / `getInbox` / `postInbox` /
`deleteInbox` / `getUserSettings`. Identity: `channel.NewUserKeyset(ed448)` +
`NewDeviceKeyset()` + `ConstructUserRegistration(userKeyset, existingDevs, [dev])`
→ `postUser`. Inbox address = base58btc(sha256(inbox_key.public_key)). Subscribe =
send `{type:'listen', inbox_addresses:[...]}` over the WS.

## Slices (each ends in something observable — no diff-reading required)

### Slice 1 — identity + transport + register  [DONE 2026-07-27, verified on prod]
`yarn harness ping` → a bot generates or loads a throwaway keyset, `postUser`
registers it, opens the WS, sends `listen`, prints its inbox address + "connected".
- Files: shim.ts, setup.harness.ts, env.ts, identity.ts, transport.ts,
  ping.scenario.test.ts, smoke.scenario.test.ts (offline CI-safe),
  vitest.harness.config.ts, package.json `harness` script, .env.example, README,
  .gitignore lines.
- Needs NO keys from operator (harness generates a throwaway account).
- **Verified live:** minted + registered a throwaway account on prod; relay
  confirmed 1 device; WS connected + subscribed; 2nd run reused the persisted
  device (no new registration). `.state/` gitignored & confirmed.
- **Gotchas found & solved (for the next dev):**
  - SDK browser bundle assigns `window.Buffer` at import → needs a window shim in
    its OWN module imported before the SDK (ESM hoisting). See shim.ts.
  - Installed npm package ships NO wasm; init from the sibling SDK source repo's
    `src/wasm/channelwasm_bg.wasm` (same file viteStaticCopy uses). See setup.harness.ts.
  - `js_generate_ed448` returns `{private_key, public_key}` with NO `type` field;
    add `type:'ed448'` (matches RegistrationPersister). See identity.ts withEd448Type.
  - from-hex pubkey derivation = `js_get_pubkey_ed448(base64(privBytes))` → base64.

### Slice 2 — one bot receives a real DM  [DONE 2026-07-27, VERIFIED on prod]
**Proven live:** a DM typed in a browser ("hello fomr browser") arrived at the
headless bot and was decrypted by the real `MessageService.handleNewMessage`
(init-envelope path: `SESSION REPLACED by init envelope` → `✅ decrypted`). No
second browser. Note: DMs queue on the relay inbox, so a message sent while the
bot was offline was delivered on the bot's next `listen` + decrypted on re-run.
Bot subscribes; operator sends it a DM FROM A BROWSER; harness decrypts and prints
the plaintext. This is the proof the whole stack is wired to production.
- Files: storage.ts, deps.ts, bot.ts, dm-receive.scenario.test.ts,
  integration-check.scenario.test.ts (offline: MessageDB opens + MessageService imports).
- **Built & verified so far:** MessageDB opens on fake-indexeddb; full MessageService
  import graph loads; a bot assembles the REAL MessageService + real deps, connects,
  listens, tears down cleanly (4s smoke, no crash). Receive path drives the real
  `handleNewMessage`; decrypted messages captured by teeing `messageDB.saveMessage`
  (the seam every DM receive path funnels through — faithful, no reimplementation).
- **Remaining:** operator sends one DM from a browser → confirm plaintext prints.
- **Env decisions locked (for the next dev):**
  - Environment is **jsdom** (the quorum-shared UI barrel touches `window` at import),
    NOT node. Harness must NOT load the unit-test setup.ts (it mocks WebSocket/crypto).
  - jsdom's WebSocket is a non-networking stub and undici's WS **hangs** under jsdom;
    transport imports the **`ws`** package explicitly (added as devDependency).
  - Harness vitest config mirrors the main config's react+lingui babel plugin, or
    MessageService's `@lingui/*/macro` imports fail to compile.
- **Run:** `yarn harness dm-receive` (waits 120s; override HARNESS_WAIT_MS).

### Slice 3 — two bots talk, no browser  [DONE 2026-07-27, VERIFIED live]
`yarn harness dm-basic` → bot A and bot B exchange numbered DMs both directions;
merged, timestamped, both-sides JSONL written to logs/.
- Files: bot.ts (+ ActionQueueService/Handlers wiring + `send()`), log.ts,
  dm-basic.scenario.test.ts. Tunables: HARNESS_ROUNDS, HARNESS_SETTLE_MS.
- **Proven live:** A→B ×3 all received, B→A replies ×3 all received back — full
  round trip through the REAL send path (submitMessage → action queue → sendDm →
  sendDirectMessages → enqueueOutbound → socket) and REAL receive path. Merged
  log shows each round trip in ~700ms, one clock, no skew.
- **Send-path wiring notes (for the next dev):**
  - First message (no session) takes submitMessage's LEGACY enqueueOutbound path;
    once a session exists, subsequent messages route through the ActionQueue —
    which THROWS if `setActionQueueService` was not called. Both are wired now.
  - `send-dm` handler never touches configService/spaceService (only space
    handlers do), so ActionQueueHandlers is built without them.
  - Service layer calls lingui `t` macros → setup activates an empty 'en' locale
    or they throw "without setting a locale".
- **Deferred to slice 4:** the `[XPDUMP]`-on-failure emitter that feeds
  `dr-ablate` unchanged. Fresh sessions don't fail, so there is nothing to dump
  until aging (slice 4) produces failures — that is where it becomes exercisable.

### Slice 4 — volume + aging (the open question)  [PARTIAL 2026-07-27]
`yarn harness dm-volume` — concurrent bidirectional load (the out-of-order
generator), sampling `skipped_keys_map` over the run. Files: dm-volume.scenario,
inspect.ts (ratchet-state sampler), xpdump.ts (dr-ablate-format failure capture,
auto-wired into bot on any decrypt failure), xpdump-format.scenario (format check).

- **FINDING — volume alone does NOT age a session.** Fresh accounts, concurrent
  bidirectional load, 60–82 msgs each way: skipped_keys = 0 throughout, 0
  failures, all delivered. Confirms §1 "a fresh session does not fail" with a
  controlled bench experiment, and answers the open question in the negative for
  the volume axis: the trigger is time / cross-platform / reset, NOT message count.
- **Controlled experiment that made the point** (the kind the manual rig can't run,
  ~5 min total): run 1 on accounts REUSED from dm-basic showed many AEAD failures;
  run 2 on FRESH accounts, identical load, showed zero; run 3 re-ran the reused
  pair and they no longer failed. → run 1's failures were STALE QUEUED FRAMES from
  account reuse (redelivery against a new session), not load-induced. My initial
  "harness reproduces the bug" read was FALSIFIED by the fresh-account control —
  logged here as exactly the interpretation-discipline §3 demands.
- **XPDUMP emitter DONE & verified:** on any decrypt failure the bot writes
  `logs/<ts>-<bot>.xpdump.log` in `[XPDUMP] n/1/1 {json}` format; dr-ablate's exact
  reader parses it (xpdump-format check). So `node .agents/tools/dm-debug/dr-ablate.mjs
  <harness-xpdump-log>` runs unchanged when failures occur.
- **REMAINING — importSession.ts (needs operator):** volume doesn't age a session,
  so to study a genuinely degraded ratchet, lift a real aged `EncryptionState` row
  out of a browser (it's plain JSON in IndexedDB; dr-replay already loads these) and
  keep it alive on the bench. This is the next high-value step and needs a browser
  export from the operator.

## Follow-ups (post-slice-4)

### Canonical test users (operator's two real accounts) — DONE 2026-07-27
`.env.local` `BOT_A_PRIVATE_KEY` / `BOT_B_PRIVATE_KEY` drive the operator's two
real test users via `canonical.ts` (`createUserA/B`, `createCanonicalPair({drain})`).
Context: user A owns the test spaces + the shared space with real users, so these
are the accounts for future SPACE work. Guidance (README): canonical pair for
realistic-state / space tests; throwaways for clean DM baselines. Two safety
refinements: (1) env-key bots persist **device-only** to `.state/` — the account
private key is never copied out of `.env.local`; (2) `drainInbox()` clears queued
frames to avoid the stale-frame confound on reused accounts.

### #1 regression test — end-to-end reset → recover — DONE 2026-07-27, non-overlap verified
`yarn harness dm-reset-recover`. Audited existing coverage FIRST (operator asked
not to duplicate unit tests): the offline ratchet lock
(ActionQueueHandlers.unit.test.ts:674), sent_accept plumbing
(sessionSelection.unit.test.ts:81), and isStaleInitEnvelope (18 pure-function
cases) are ALREADY unit-tested with the SDK mocked. So harness copies of those
would be pure overlap — SKIPPED. Built only the emergent behavior unit tests can't
reach: wipe one side's session mid-conversation, verify a fresh re-init recovers
the conversation both ways (real crypto, real two-party). Passes; a real AEAD
failure occurs during the transition (XPDUMP-capturable). Also added
`bot.wipeSessions()` and `refreshSubscriptions()` (listen on new session inboxes
as they are created — mirrors the app's setResubscribe).

### #2 — spaces (bot joins a space, posts, interacts) — TO SPEC
Operator's MAIN current use case: **messages not landing in spaces**. Spec the
spaces build around that specific issue before implementing. Needs triple-ratchet
session establishment + SpaceService/SyncService + channel send; user A's space
ownership is why the canonical pair matters here.

### Follow-up session 2026-07-27 (later) — reproduction + mitigation, and two bench defects

The harness delivered what it was built for: the production DM failure is now
reproducible on demand, and a client-side mitigation is measured. Details live in
`.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §1 (findings AI/AJ/AK)
and §5-B1. What belongs here is the harness work itself:

**New capability**
- `transport.ts` — controlled reordering: `holdInbound()` / `releaseInbound(order)` /
  `deliverWithheld()` / `deliver(frame)`, plus `sent` / `arrived` records and
  `ciphertextFp()` so a frame can be joined across the two sides. Withholding is
  enforced **by fingerprint**, because an un-acked frame is re-pushed on every
  `listen` — a version that only skipped the first copy was silently defeated by
  relay redelivery, and no bucket formed.
- `dm-reorder.scenario.test.ts` — builds the stale bucket, then delivers the
  sender's next chain. 3 withheld frames → exactly 3 failures, at exactly the
  colliding indices; the withheld frames then decrypt with 0 failures.
- `dm-loss.scenario.test.ts` — #183 item 2, per direction, joined by ciphertext
  fingerprint, with a long redelivery tail window (a short run cannot tell loss
  from latency) and frames addressed elsewhere excluded from the denominator.
- `dm-stale-bucket.scenario.test.ts` — the cycle at scale with the mitigation OFF
  then ON, fresh accounts per arm.

**Two defects that invalidated earlier harness numbers** (both fixed; both were
caught by controls, not by inspection)
1. **All bots shared one IndexedDB.** `MessageDB` hardcodes `DB_NAME='quorum_db'`
   and every bot uses the one global `fake-indexeddb`, so two bots were a single
   client with two `MessageService` instances writing the same rows. Each then
   subscribed to the other's session inboxes and received its own outbound
   ciphertext — 41-48% of all arrivals, every one an unavoidable AEAD failure.
   Fixed by a per-bot `DB_NAME` in `storage.ts`.
   *The control that mattered:* the app's `setResubscribe` uses the identical rule,
   so this looked like a real app defect. `dr-self-echo.mjs` found **0 self-echo in
   2709 distinct captured browser arrivals** — harness artifact, not app behaviour.
2. **The harness could not see decrypt failures.** They never leave
   `handleNewMessage` (caught, frame retained, `handled` returned). So slice 4's
   "0 failures" was measured by an observer blind to failures. `bot.ts` now tees the
   failure log line and classifies **novel vs replay** — a frame already decrypted
   once is refused by design and must not be counted. Use `bot.novelErrors()`.
   Also: `refreshSubscriptions` no longer fires per frame (a `listen` re-pushes the
   relay queue, which turned 3 expected failures into 437); it fires only when the
   inbox set changes, as the app does.

Slice 4's conclusion ("volume alone does not age a session") **still holds** and is
now genuinely evidenced: on the fixed bench a fresh pair shows 0 skipped keys,
0 novel failures and 0 self-echo.

**`importSession.ts` is no longer on the critical path.** It existed to study a
degraded ratchet by lifting one out of a browser. The degraded state can now be
*built* from a pristine pair in seconds, so the operator export is optional.

Also fixed: `vitest.config.ts` excluded `src/dev/tests/harness/**`. The scenarios
were being collected by the default config, which mocks WebSocket/crypto and never
inits the wasm, so 8 files failed `vitest run` for that reason alone. Suite is
554/554 green.

## Progress log

- 2026-07-27: branch `feat/headless-dm-harness` created; plan written.
- 2026-07-27: slice 1 DONE — throwaway account registered on prod, WS connect +
  subscribe, persisted/idempotent device. Verified live.
- 2026-07-27: slice 2 DONE — real browser-sent DM decrypted headlessly by the real
  MessageService. Env locked: jsdom + `ws` package + fake-indexeddb + wasm-from-sibling.
- 2026-07-27: slice 3 DONE — two bots exchange DMs both directions, no browser, via
  the real send + receive paths. Merged both-sides JSONL log. The two-browser loop
  is replaced.
- 2026-07-27: slice 4 PARTIAL — dm-volume + ratchet sampler + XPDUMP emitter (format
  verified against dr-ablate). FINDING: volume alone does not age a session (fresh
  accounts, concurrent load, 0 skipped keys, 0 failures); run-1 failures were stale
  queued frames from account reuse, falsified by the fresh-account control. REMAINING:
  importSession.ts to lift a real aged session from a browser (needs operator export).
- 2026-07-27: follow-ups — canonical test users (BOT_A/BOT_B via .env, device-only
  persistence, drain option) + #1 reset→recover regression test (non-overlap audited
  vs existing unit tests). Next: spec #2 (spaces) around the "messages not landing in
  spaces" issue.
