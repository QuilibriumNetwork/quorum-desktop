# Headless DM harness

Drive the **real** Quorum desktop client in Node — no browser, no UI — to debug
DM transport. One process hosts both sides of a conversation, on one clock, at any
volume, unattended. Output is a log the existing `dr-*` analyzers read directly.

It is **not** a reimplementation of the protocol. It re-hosts the real client:
the SDK wasm crypto core, `fake-indexeddb` for storage, Node's native `fetch` +
`WebSocket` for transport, and the real `src/services/MessageService.ts` for
logic. If a bug lives in the app, the harness hits it.

> Replaces the two-browser manual rig (see
> `.agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md` §6) for everything
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
| `bot.ts` | assembles the real MessageService + MessageDB + transport (send/receive/wipe/drain) |
| `deps.ts` | MessageServiceDependencies wiring (real for DM, no-op for space/sync) |
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

On any decrypt failure a bot writes `logs/<ts>-<bot>.xpdump.log` in `[XPDUMP]`
format, so the existing offline analyzers run on it unchanged:

```bash
node .agents/tools/dm-debug/dr-ablate.mjs   logs/<ts>-<bot>.xpdump.log
node .agents/tools/dm-debug/dr-replay.mjs   logs/<ts>-<bot>.xpdump.log
```

## Status

- Slice 1 (identity + transport + register) — DONE, verified on prod.
- Slice 2 (receive a real browser DM, decrypt headlessly) — DONE, verified on prod.
- Slice 3 (two bots talk, no browser) — DONE, verified live. Replaces the two-browser loop.
- Slice 4 (volume + XPDUMP capture) — DONE. Finding: volume alone does not age a
  session. Remaining: importSession.ts (lift a real aged session from a browser).

See `.agents/tasks/2026-07-27-headless-dm-harness.md` for the full slice plan.
