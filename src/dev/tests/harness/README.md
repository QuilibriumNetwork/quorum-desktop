# Headless harness (DM + spaces)

Drive the **real** Quorum desktop client in Node — no browser, no UI — to debug
transport. One process hosts both sides of a conversation, on one clock, at any
volume, unattended. Output is a log the existing `dr-*` analyzers read directly.

Two halves, sharing identity/transport/storage:

- **DM** — `bot.ts` + `deps.ts` + `dm-*.scenario.test.ts`. Complete through slice 4.
- **SPACES** — `spaceBot.ts` + `spaceDeps.ts` + `outbound.ts` + `space-*.scenario.test.ts`.
  Slices S0-S1 done. Built to characterise the intermittent roster-pull failure
  (`.agents/issues/.open/2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md`).

It is **not** a reimplementation of the protocol. It re-hosts the real client:
the SDK wasm crypto core, `fake-indexeddb` for storage, Node's native `fetch` +
`WebSocket` for transport, and the real `src/services/MessageService.ts` for
logic. If a bug lives in the app, the harness hits it.

> Replaces the two-browser manual rig (see
> `.agents/issues/transport/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §6) for everything
> below the UI layer.

## Quick start

```bash
# optional: only needed to drive your existing test users
cp src/dev/tests/harness/.env.example src/dev/tests/harness/.env.local

yarn harness ping        # slice 1: a bot registers, connects, subscribes
yarn harness             # run every scenario
```

No `.env.local` is required — with no keys the harness generates its own throwaway
accounts, which is all the transport scenarios need.

## Canonical test users (your two accounts)

Set these in `.env.local` (gitignored) to drive your two real test accounts:

```
BOT_A_PRIVATE_KEY=<114-char ed448 hex>   # user A — owner of test spaces + the shared space
BOT_B_PRIVATE_KEY=<114-char ed448 hex>   # user B
```

Then in a scenario:

```ts
import { createCanonicalPair, createUserA, createUserB } from './canonical';
const { a, b } = await createCanonicalPair();          // both, as your real users
const { a, b } = await createCanonicalPair({ drain: true }); // clear queued frames first
```

**When to use the canonical pair vs throwaways:**

| use the canonical pair | use throwaway `createBot('name')` |
|---|---|
| realistic state (real history, real sessions) | clean-slate baselines, deterministic mechanism tests |
| **space work** — user A owns the test spaces + the shared space, so only these accounts can post/interact there | DM send/receive/reset mechanics where history is noise |
| reproducing a "used for days, came back broken" condition | anything that must start from zero |

Two things to know about the canonical pair:
- **Stale-frame noise.** These accounts carry lots of history and queued frames;
  reusing them in a DM test can surface stale-frame redelivery (the run-1 finding).
  Pass `{ drain: true }` to clear each device inbox first, or prefer throwaways.
- **Extra device.** The harness registers itself as a *new device* on the account
  (merged with your real browser/mobile devices — it does not clobber them). Its
  device keyset persists to `.state/user-a.json` / `user-b.json`. Your **account
  private key is never written to `.state/`** — only the device keyset is; the
  account key is re-derived from `.env.local` each run.

## ⚠️ Safety

- **Test accounts only** — throwaway bots, or dedicated test users like the two
  above. Never put a personal identity's key in `.env.local`.
- `.env.local`, `.state/`, and `logs/` are gitignored — they hold **real private
  keys / ratchet key material**. Never commit them; keep logs local.
- The harness talks to **production** (`api.quorummessenger.com`) by default, same
  as the browser app. Runs create real registrations and real frames on the live
  relay. Override `QUORUM_API_URL` / `QUORUM_WS_URL` to point elsewhere.
- Each bot **persists its device keyset** to `.state/<name>.json` and reuses it, so
  re-runs do not spawn new device registrations (which would feed the
  device-registration ghost-accumulation problem).

## Why it does NOT need the `diag/dm-frame-join` branch

That branch smears probe logging (and real key material) into `MessageService`
because a browser is a black box. The harness runs in-process with full access —
it owns the transport and the DB — so it writes the `[XPDUMP]`-format records
itself, from the outside, against clean `main`. Richer data (state on every frame,
not just failures), no key material in service code. See the task file for detail.

## Layout

| file | role |
|---|---|
| `env.ts` | config + `.env.local` reader (throwaway keys optional) |
| `identity.ts` | ed448 key → registered user + device keyset (generate or from-hex) |
| `canonical.ts` | your two `.env` test users (createUserA/B, createCanonicalPair) |
| `transport.ts` | REST client + WebSocket (`{type:'listen'}` subscribe) |
| `bot.ts` | DM bot: the real MessageService + MessageDB + transport (send/receive/wipe/drain) |
| `deps.ts` | MessageServiceDependencies wiring (real for DM, no-op for space/sync) |
| `spaceBot.ts` | SPACE bot: same construction, plus create/invite/join/post and a member-row capture seam |
| `spaceDeps.ts` | the real ConfigService/SyncService/InvitationService/SpaceService graph |
| `outbound.ts` | the app's serialized outbound FIFO (spaces need it — see below) |
| `storage.ts` | MessageDB on fake-indexeddb |
| `inspect.ts` | read ratchet state (skipped-keys count) out of a bot's MessageDB |
| `xpdump.ts` | dr-ablate-format capture on decrypt failure |
| `log.ts` | structured both-sides JSONL run log |
| `*.scenario.test.ts` | runnable scenarios (this is what `yarn harness` runs) |
| `.state/` | persisted device keysets (gitignored) |
| `logs/` | structured run logs (gitignored) |

Log analyzers stay in `.agents/tools/dm-debug/` (`dr-ablate`, `dr-replay`,
`dr-position-table`) — the harness feeds them, it does not replace them.

## Scenarios

| command | what it does |
|---|---|
| `yarn harness smoke` | offline: crypto + identity pipeline (no relay) |
| `yarn harness integration-check` | offline: MessageDB opens, MessageService imports |
| `yarn harness ping` | a bot registers, connects, subscribes (hits prod) |
| `yarn harness dm-receive` | waits for a DM you send from a browser, decrypts it |
| `yarn harness dm-basic` | two bots exchange numbered DMs, no browser (HARNESS_ROUNDS) |
| `yarn harness dm-volume` | concurrent bidirectional load; samples skipped-keys growth |
| `yarn harness dm-reset-recover` | wipe a session mid-conversation, verify it re-inits and recovers |
| `yarn harness dm-reorder` | **reproduces the production DM failure on demand.** Withholds the head of a sending chain so a stale skipped-keys bucket forms, then delivers the sender's next chain: the frames at colliding indices fail AEAD, and only those |
| `yarn harness dm-loss` | send-vs-arrive frame loss per direction, joined by ciphertext fingerprint (issue #183 item 2). `HARNESS_LOSS_CANONICAL=1` runs it on the canonical aged multi-device accounts instead of fresh throwaways — the account shape is a variable in its own right, so the two arms answer different questions |
| `yarn harness dm-stale-bucket` | the reorder cycle at scale, with the client-side mitigation OFF then ON, on fresh accounts per arm |
| `yarn harness replay-captured` | runs the shipped stale-bucket retry against REAL degraded production state from saved rig logs. Needs `DM_LOG_DIR=<dir>`; skips without it |

### Space scenarios

| command | what it does |
|---|---|
| `yarn harness space-create` | S0: a bot creates a real space on production and reads its manifest back through the joiner's own decode path |
| `yarn harness space-basic` | S1: B joins A's space by invite and must receive **both** A's post and A's member row. `HARNESS_SPACE_WINDOW_MS` / `HARNESS_SPACE_SAMPLE_MS` tune the wait |

`space-basic` asserts the ROSTER as well as the message, because the roster half
is the thing under investigation. B writes only its own member row locally, so a
second row can only have come off the wire.

> ⚠️ **A green `space-basic` is not evidence the roster bug is absent.** It runs
> at N=2 members; the reported failure is at N≈79 and is intermittent. Quoting a
> few green runs as a rate is precisely the mistake that produced three wrong
> answers in the bug file. The rate is slice S2's job.

> **A sibling harness now drives the MOBILE client the same way** —
> `quorum-mobile/dev/harness/`, `yarn harness:dm`. It is shaped differently
> (mobile's DM receive path lives inside a React provider, so the bot renders it,
> and each bot needs its own process), but it measures the same thing.
>
> ⚠️ **Before quoting any 0%-loss result from either bench**, read §3.1 of
> `.agents/docs/transport-reliability-index.md`. Three such results now exist and
> none of them contradicts the loss measured in the field — each bench differs
> from the field configuration in several variables at once.

## 📊 After a run that produces a number, append a row

**`.agents/docs/transport-measurements.md`** — one row per run: date, what ran, the
configuration, the result, and one line on what it changed. Append-only; never
rewrite a past row.

Record the **class** of the result, `arrival` or `decrypt`. A frame that arrives
and fails AEAD is *not* lost, and reporting it as loss is how "desktop↔desktop
loses 100% of messages" got written down when every frame had in fact arrived and
none had decrypted.

This takes a minute and it is the difference between a bench that accumulates
knowledge and one that just prints numbers. Two weeks of results had to be
reconstructed from five separate documents because nobody was doing it.

On any decrypt failure a bot writes `logs/<ts>-<bot>.xpdump.log` in `[XPDUMP]`
format, so the existing offline analyzers run on it unchanged:

```bash
node .agents/tools/dm-debug/dr-ablate.mjs   logs/<ts>-<bot>.xpdump.log
node .agents/tools/dm-debug/dr-replay.mjs   logs/<ts>-<bot>.xpdump.log
```

## Three things that will mislead you if you don't know them

Each of these silently produced a wrong measurement before it was found. All are
fixed; the notes are here so a change doesn't reintroduce them.

1. **Every bot needs its OWN database.** `MessageDB` hardcodes
   `DB_NAME = 'quorum_db'` and all bots share one global `fake-indexeddb`, so
   without a per-bot name two bots become ONE client with two `MessageService`
   instances writing the same rows — and each subscribes to the other's session
   inboxes, so 41-48% of arrivals were the bot's own outbound ciphertext (all
   guaranteed AEAD failures). See `storage.ts`.
2. **Decrypt failures do not propagate.** The receive path catches
   `DmDecryptError`, retains the frame for redelivery and returns `handled` — that
   retention is what makes recovery work. So `try/catch` around
   `handleNewMessage` sees nothing. `bot.ts` tees the failure log line instead, and
   splits failures into **novel** vs **replay**: a frame the bot already decrypted
   is refused by design. **Quote `bot.novelErrors()`, never `bot.errors`.**
3. **Do not re-subscribe per frame.** A `listen` makes the relay re-push everything
   still queued, so re-subscribing after every frame turns one undecryptable frame
   into an unbounded redelivery loop (3 expected failures became 437). The app
   subscribes on connect; `refreshSubscriptions` now only fires when the inbox set
   actually changes.

Also: `transport.holdInbound()` / `releaseInbound()` / `deliverWithheld()` give
controlled reordering, and withholding is enforced **by fingerprint** — an un-acked
frame is redelivered on every `listen`, so a version that merely skipped the first
copy was defeated by the relay.

4. **Spaces need the app's SERIALIZED outbound queue; the DM one is not faithful
   enough.** `deps.ts` runs each enqueued action immediately and concurrently
   (`void (async () => …)()`). The app appends to a FIFO and drains it with one
   action in flight at a time (`WebsocketProvider.tsx:136-163`). Invisible for DM
   — one action, one frame. Not invisible for spaces: joining enqueues the `join`
   broadcast then `requestSync`, and a responder enqueues several sealed delta
   payloads the requester reassembles. Firing those concurrently reorders the
   wire in a way production never does, so a space harness on the DM version
   would be measuring itself. Use `outbound.ts`.
5. **A channel post is asynchronous past the call.** `submitChannelMessage`
   enqueues on the ActionQueue and returns; a handler encrypts and sends later.
   `spaceBot.post()` drains the ActionQueue and THEN the outbound FIFO. A
   scenario that assumes "the call returned, so it was sent" attributes its own
   race to the transport.

## Status

- Slice 1 (identity + transport + register) — DONE, verified on prod.
- Slice 2 (receive a real browser DM, decrypt headlessly) — DONE, verified on prod.
- Slice 3 (two bots talk, no browser) — DONE, verified live. Replaces the two-browser loop.
- Slice 4 (volume + XPDUMP capture) — DONE. Finding: volume alone does not age a
  session (re-confirmed after the fixes above; the original run could not see
  failures at all).
- **Reproduction + mitigation (2026-07-27) — DONE.** `dm-reorder` reproduces the
  production failure mode on demand, and `dm-stale-bucket` measures the client-side
  mitigation at 32→0 failures with no cost to delayed frames. So the open
  `importSession.ts` step (lift a real aged session out of a browser) is **no longer
  on the critical path** — the failure can be built from scratch instead.

### Spaces

- Slice S0 (a headless bot creates a real space) — DONE, verified on prod. Settled
  the spec's blocking unknown: **nothing in create/invite/join is
  passkey-interactive**, it is all `js_sign_ed448` over raw keys, same as DM send.
- Slice S1 (B joins and receives A's post AND A's member row) — DONE, green on
  four consecutive runs, roster complete at 9.8-11.2s. Reproducibility of the
  instrument; not a rate.
- Slice S2 (delivery rate + lag at volume, and roster size as the first swept
  variable) — NEXT. This is the one that turns the anecdote into a number.

See `.agents/issues/.done/2026-07-27-headless-dm-harness.md` for the DM slice plan,
`.agents/issues/transport/2026-07-27-headless-space-harness.md` for the space one,
and `.agents/issues/transport/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §1 for the DM
findings.
*Last updated: 2026-08-02*
