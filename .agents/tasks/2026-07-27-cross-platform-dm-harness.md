---
type: task
title: "Cross-platform DM harness — a headless mobile bot, and mobile↔desktop on one bench"
status: NOT STARTED — spec
created: 2026-07-27
branch: feat/mobile-dm-harness (mobile) + feat/cross-platform-harness (desktop)
area: DM transport / testing infrastructure / cross-repo
repos: quorum-mobile (slices 1-3), quorum-desktop (slice 4)
related:
  - .agents/tasks/.done/2026-07-27-headless-dm-harness.md (the desktop harness this extends — read FIRST)
  - .agents/bugs/2026-07-26-dm-desktop-to-desktop-resurfaced.md (the investigation)
  - src/dev/tests/harness/ (the existing rig: bot.ts, deps.ts, transport.ts, log.ts, xpdump.ts)
  - .agents/tools/dm-debug/ (dr-ablate, dr-replay, dr-position-table — analyzers both platforms feed)
  - ../quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md (mobile transport context)
---

# Cross-platform DM harness

## Why

The desktop harness answered desktop↔desktop. But the operator's field observation
is that **DM loss is worse mobile→desktop and mobile→mobile than desktop→desktop**
(2026-07-27). The common factor in both bad cases is *mobile*, and there is
currently no bench that can run mobile's DM path at all — every mobile finding
still costs a device, a human, and a manual round.

The desktop harness's whole thesis was moving cost from human attention to machine
time. Right now that only holds for the platform pair that already works.

## Where this task lives, and why

It lives in **quorum-desktop** for two reasons, the second decisive:

1. Slice 4 requires desktop changes (alias config in `vitest.harness.config.ts`
   plus the cross-platform scenario files).
2. **quorum-mobile gitignores its entire `.agents/` folder** ("Local agent tooling —
   not synced with upstream"). A task file written there would never be committed.

**Slices 1-3 are implemented entirely in quorum-mobile** and touch no desktop code.
A mobile-side agent picking this up works from this file but commits in that repo.
Do NOT mirror this plan into `../quorum-mobile/.agents/` — it would be a local-only
copy that silently diverges.

## ⚠️ READ THIS FIRST — the premise this task was originally written on is dead

The first draft of this document (2026-07-27, morning) proposed a 2×2 direction
matrix using desktop↔desktop as a clean control, and treated `desktop→mobile` as an
untested cell. **Both assumptions are wrong**, and the operator corrected them by
pointing at the live investigation:

- `quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md`
  (29 instrumented rounds, PART I §A-§E is current; §26/§27 are the live sections)
- `quorum-mobile/.agents/tasks/2026-07-24-transport-reliability-START-HERE.md` (stale,
  dated 2026-07-24 — superseded by the bug doc above; do not plan from it)

What that investigation already establishes:

| my assumption | reality |
|---|---|
| desktop↔desktop is a clean control | **Falsified 2026-07-26** — d↔d reproduced 0/10 both directions, frames arriving and failing AEAD. Recorded in §A and §E of the bug doc. |
| `desktop→mobile` is untested | Tested across many rounds. Latest: **d→m 12/12 two consecutive rounds**; round 27 had 51/51 decrypt failures self-heal. |
| mobile's **send** path is the suspect | That was the 2026-07-25 model. It was explained and **shipped fixed in PR #180**. Superseded. |
| batch decrypt (recon #3) is the leading suspect | The receive pipelines of **both** apps are considered fixed as of 2026-07-26. Not the live suspect. |
| payload size might amplify the loss | **Measured and rejected** — §27.5 discriminator table: losses proportional at every wire length (2/4 @1810, 2/6 @1858, 4/11 @3106). The loss is **size-blind**. |

**The current state of the investigation (as of 2026-07-26, rounds 28-29):** twelve
client-side fixes shipped; both receive pipelines fixed; frame-loss trend across one
day 45% → 18% → 13/34 → 4/34. The **two remaining root causes are upstream**, filed
as [quorum-mobile issue #183](https://github.com/QuilibriumNetwork/quorum-mobile/issues/183):

1. **Channel-crate fork** when a receiver's first-ever frame sits at chain position > 0
   (deterministic offline repro exists: `dr-advanced-start-fork.mjs` — needs no harness).
2. **Node write-layer "black hole"** — frames handed to the socket, signed, connection
   open, never retrievable. Reproduces **mobile↔mobile too** (8/25, round 29),
   **size-blind, shape-blind, session-state-blind, and strongly directional**
   (32% one way, ~0% the other, same devices, same minutes, same hub).

§27.5 tested four client-side discriminators against the black hole. All negative.
**No client-side fix is reachable from the current evidence — only a mitigation.**

## What the harness is actually for, given that

The original framing ("find which direction is broken") is answered. The value now is
different, and narrower — but one item is genuinely decisive:

### 📊 RUN 1 RESULT (2026-07-28) — black hole did NOT reproduce; result is weaker than the decision rule I set

`HARNESS_LOSS_ROUNDS=200 HARNESS_LOSS_SETTLE_MS=600000 yarn harness dm-loss`, 833 s,
fresh throwaway accounts, production relay.

```
A->B  sent=201  arrived=201  missing=0  loss=0.0%  unmatched-arrivals=0
B->A  sent=201  arrived=201  missing=0  loss=0.0%  unmatched-arrivals=0
posts decrypted: alice=402 bob=402          (201 sent + 201 received each)
self-echo: 0 / 0                             (per-bot DB fix holding)
novel decrypt failures: alice=0  bob=18      (all healed — 0 permanent loss)
replays (expected refusals): alice=142  bob=3
```

Missing count was **0 at every settle checkpoint** from +75 s to +600 s — this is not
a short-window artifact.

**⚠️ I over-stated the decision rule before running this.** I said zero loss would make
RN's native layer the prime suspect. It does not, and the reason is in the
investigation doc I had just read:

- The black hole is **intermittent and directional** — round 29 measured 32% one way
  and ~0% the other, *same devices, same minutes, same hub*. One clean run is fully
  consistent with having been on the quiet side of that asymmetry.
- §27.4 reads the asymmetry as pointing at **per-writer or per-inbox node state**
  rather than blanket sampling loss. If that is right, this scenario's deliberate use
  of **fresh throwaway accounts** selects for exactly the population *least* likely to
  be in the affected state. The design choice that removes the queued-frame confound
  may also remove the phenomenon.

**Honest verdict: not reproduced, inconclusive.** It does not exonerate the node and it
does not implicate RN. What it does establish is a clean desktop↔desktop Node baseline
— worth having, and a precondition for the runs that could actually discriminate.

**To make this experiment decisive, next:**
1. **Repeat on the canonical accounts** (`createCanonicalPair({ drain: true })`) — real,
   aged, heavily-used identities with many registered devices. That is the population
   closest to the phones that showed loss, and it directly tests the per-writer /
   per-inbox reading. Highest-value single follow-up.
2. **Repeat the throwaway run several times.** One clean run against an intermittent,
   directional phenomenon is one sample. A handful of clean runs is a measurement.
3. Only then read anything into a null result.

**Side finding worth keeping:** bob took **18 novel decrypt failures, all healed, zero
permanent loss**, with 18 distinct frames captured to
`logs/2026-07-28T07-56-03-295Z-loss-b-336395.xpdump.log`. That is the §A.1 class
(frames arriving ahead of the ratchet root, healing once later traffic advances it)
reproducing cleanly and analyzably on the bench — the class #265 targets. `dr-ablate`
and `dr-replay` run on that file unchanged.

### 📊 RUN 2 RESULT (2026-07-28) — canonical aged accounts, second null, and it re-earns the mobile bot

`HARNESS_LOSS_CANONICAL=1 HARNESS_LOSS_ROUNDS=200 HARNESS_LOSS_SETTLE_MS=600000`.
Real aged multi-device accounts, `drain: true`, production. Operator had a browser
client open on **each** account during the run (noted — see caveats).

```
A->B  sent=201  arrived=201  missing=0  loss=0.0%  unmatched-arrivals=3
B->A  sent=201  arrived=201  missing=0  loss=0.0%  unmatched-arrivals=3
posts decrypted: alice=402 bob=402         (full delivery both ways)
self-echo: 0 / 0
novel decrypt failures: alice=53  bob=87   (ALL healed — 0 permanent loss)
raw: aSent=3618  bSent=3619
```

Missing was 0 at every checkpoint +75 s → +600 s.

**Write amplification is real and large.** A pushed **3618 frames for 200 messages —
~9 frames per message**, against 402 (~1:1) on throwaways. That is the ghost-device
accumulation (§7b, `deviceCount: 11 seen`) as raw wire cost.

> ⚠️ **Do not quote "3618 frames, zero loss".** Only **201 per direction are
> measurable** — the join deliberately excludes frames fanned out to the accounts'
> other devices, because they can never arrive at the peer bot and are not loss. The
> other ~3400 frames are unobserved, not observed-good. If the black hole is
> per-inbox and lives on a ghost-device inbox, this run could not have seen it.

**Two independent nulls now, and they are the first desktop-side measurement of this
at all** — `dm-loss`'s own header notes the write-layer drop "has never been measured
desktop↔desktop". It has now, twice: fresh throwaways and aged real accounts.

**What this shifts.** §26 puts the drop at ~80% node-side, with the stated residual
being *"client JS visibility ends at `ws.send` into RN's native layer"*. Removing RN's
native layer and keeping everything else — same relay, same protocol, aged accounts,
9× fan-out — produces no loss, twice. That is the first evidence that discriminates at
all, and it moves probability **toward** the RN native layer.

**What it does NOT establish.** Desktop and mobile differ in more than the transport:
different send code, different frame cadence, different fan-out behaviour. So this
narrows the field to "something about the mobile path" without isolating the transport
within it. Three live candidates remain:
(a) RN's native WebSocket drops frames — **client-side and fixable**;
(b) the node drops *mobile-shaped* writes specifically;
(c) per-writer/per-inbox node state these accounts are not in.

### ⭐ Which is exactly what slices 1-3 now isolate — the mobile bot has an evidence-driven purpose

Run mobile's **client code** on the **Node `ws` transport**. That holds mobile's send
logic constant and swaps only the transport:

- loss **disappears** ⟹ candidate (a). RN's native WebSocket is the culprit. Client-side,
  fixable, and it reverses "upstream, out of our hands" for issue #183 item 2.
- loss **appears** ⟹ (a) is dead. It is mobile's send logic or node-side handling of
  mobile-shaped writes — and #183 item 2 gets much stronger, with a headless repro.

This is a **single-variable experiment**, which is what the investigation has never
been able to run: every prior round changed platform, transport and client code
together. It is the strongest justification this task has had, and it replaces the
speculative framing the document opened with.

Caveat to carry into it: browser clients were open on both accounts during run 2. They
cannot corrupt the loss join (they hold no keys to the bots' inboxes, and their
fan-out frames are excluded from the denominator) but they add receipt traffic and
ratchet churn. The investigation's standing protocol is "two clients only" — for any
run that produces a *positive* result, re-run with them closed before believing it.

### 🥇 1. Resolve the node-vs-native-layer residual — and this needs NO mobile work

§26 puts confidence that the write drop is node-side at **~80%**, with an explicit
stated residual: *"client JS visibility ends at `ws.send` into RN's native layer, so a
native-layer drop cannot be fully excluded."*

**The harness eliminates that variable by construction.** It uses the Node `ws`
package. There is no React Native native transport anywhere in the loop.

- Loss **reproduces** headlessly ⟹ RN's native layer is exonerated; node-side goes
  from ~80% to near-certain, and issue #183 item 2 gets materially stronger.
- Loss **does not** reproduce ⟹ the RN native layer becomes the prime suspect, which
  is a client-reachable bug and reverses the whole "upstream, out of our hands"
  conclusion.

Either outcome is worth more than another device round, and **`dm-loss.scenario.test.ts`
already exists on desktop and already measures per-direction loss joined by ciphertext
fingerprint.** This is runnable today. It is the single highest-value thing on this
page.

### 🥈 2. Characterise the black hole at scale, unattended, for the Lead

Every round so far is 25-30 hand-run frames costing device time. The 32%/0%
directional asymmetry — which §27.4 flags as the finding most likely to help the Lead
localise it ("a uniform random drop does not produce 33%/0% between two peers on the
same hub in the same minutes") — rests on **a single round**.

A harness runs thousands of frames, both directions, for hours, unattended. Is the
asymmetry stable? Per-writer or per-inbox? Time-varying? Does it correlate with
anything at all? That converts one suggestive round into evidence worth sending
upstream, at zero device cost.

### 🥉 3. Prove mitigation 1 before shipping it

§26.1 resend-with-dedupe (blind double-write, ~12% loss → ~1.4%) is the highest-value
client item on the board, Kyn-gated and unbuilt. The bench already has the exact
pattern — `dm-stale-bucket.scenario.test.ts` runs a mitigation **OFF then ON, fresh
accounts per arm**. Measuring the improvement at N=hundreds beats shipping on an
estimate.

### What the harness is NOT needed for any more

- **Direction coverage.** Answered by rounds 1-29.
- **mobile↔mobile coverage.** §26.3 decided and executed it with two physical devices;
  rounds 28-29 are done.
- **The crate fork.** Has a deterministic offline repro already.

Slices 1-4 below remain the plan for a mobile bot, but their **priority drops**: the
decisive experiment (item 1) runs on the desktop harness that already exists.

## The four seams (mobile vs the desktop harness)

| seam | desktop harness | quorum-mobile | cost |
|---|---|---|---|
| crypto | SDK wasm, loads in Node as-is | `quorum-crypto` Expo native module (uniffi → Rust), cannot load in Node | **low** — see recon #1 |
| storage | `fake-indexeddb` + real `MessageDB` | `expo-sqlite` (SQLCipher), `react-native-mmkv` (29 sites), `expo-secure-store` | **medium** |
| transport | Node `fetch` + `WebSocket` | same protocol, constructed inside a React context | low |
| orchestration | `MessageService` — plain class, `new`-able | `context/WebSocketContext.tsx`, **6216 lines of React hooks** | **the blocker** |

## Recon findings (2026-07-27, against real code — these shaped the slices)

**1. The crypto swap needs no production code change.**
`quorum-shared/src/crypto/wasm-provider.ts` exports `WasmCryptoProvider implements
CryptoProvider` — the same interface `services/crypto/native-provider.ts:322`
implements, against the same Rust crate (wasm bindings vs uniffi bindings). Its
constructor takes the wasm module by injection (`constructor(wasmModule:
ChannelWasmModule)`), so there is no init magic to replicate — the desktop
harness's `setup.harness.ts` already loads that wasm from the sibling SDK source
repo and can be reused verbatim.

Every mobile call site does a bare `new NativeCryptoProvider()`. So the harness
supplies a shim module of the same shape and **aliases** `services/crypto/native-provider`
to it at the bundler boundary:

```ts
export class NativeCryptoProvider extends WasmCryptoProvider {
  constructor() { super(getInitializedWasm()); }
}
```

Zero app edits for the crypto seam. (Caveat in #3.)

**2. The mobile send path is already harness-ready.**
`sendEncryptedMessageToAllDevices` (`hooks/chat/useSendDirectMessage.ts:1139`) is a
**plain exported async function, not a hook**, and it already takes `enqueueOutbound`
and `subscribe` as parameters — the exact dependency-injection shape desktop's
`deps.ts` supplies. Send needs almost no extraction. The receive path is what's
trapped in the context.

**3. ⚠️ The mobile DM receive fast path is native-only and CANNOT be harnessed.**
`batchUnsealEnvelopes` (native-provider.ts:990) and `batchProcessMessages` (:1054)
are direct `QuorumCrypto.*` uniffi calls with **no JS or wasm equivalent** — the
`ChannelWasmModule` interface has no batch functions. This is a mobile-only Rust
path that desktop does not have at all.

That matters more than anything else in this task, because it is *also the leading
suspect*. native-provider.ts:1233 already logs a documented partial-failure mode on
it:

> `[batchProcessMessages] native side returned truncated:true — some messages have
> empty decrypted_message. Refetch needed.`

A wasm-backed harness routes **around** the suspect. There is currently no
batch-disable toggle (grepped: none) — batch failures fall back to per-message
`handleIncomingMessage` automatically (WebSocketContext.tsx:~5081), so the harness
needs to add a seam that forces the JS path.

**This is a feature of the design, not just a limit, provided we state it up front:**
if mobile↔mobile comes back **clean on the bench but red on device**, that is strong
positive evidence the fault is in the batch path or the uniffi bridge — both of
which the harness excludes by construction. A green harness is a real result here,
not a failed session. Do not let a later reader mistake it for one.

## Scope

- DM transport only. No spaces, no sync, no UI — same boundary `deps.ts` already
  draws with its loud no-ops.
- Mobile's **non-batch** DM path. Batch is explicitly out of scope (recon #3).
- Reuses the existing rig wholesale: `log.ts`, `xpdump.ts`, the `dr-*` analyzers,
  the `.env.local` / `.state/` / `logs/` safety conventions.

## Non-goals / honest limits

- **Does not test the uniffi bridge.** `parseNativeResult`'s error sniffing, the
  base64/JSON round-trips, `ratchet-mutex` under real async native call timing —
  all invisible to a wasm-backed bot.
- **Does not test the native batch decrypt path** (recon #3).
- **Does not test SQLCipher.** The harness drops `PRAGMA key`; encryption-at-rest
  bugs stay on-device.
- Does not exercise RN rendering, FlashList, or notification wake paths.
- A bot is a real device on the account → multi-device fan-out topology, same
  caveat as the desktop harness.

## Safety (inherited, non-negotiable)

Same rules as `src/dev/tests/harness/README.md` §Safety: throwaway or dedicated test
accounts only, never a personal identity; talks to **production**
`api.quorummessenger.com` by default, so every bot is a real device registration on
a real account.

⚠️ **Mobile's `.gitignore` covers `.env*.local` but NOT `.state/` or `logs/`.** Those
hold device keysets and ratchet key material. Add those lines **before the first run
that touches a real account**, not after — committed key material is not cleanly
undoable.

⚠️ **Persist device keysets from the first commit, not as a follow-up.** Desktop's
bots reuse a saved keyset so re-runs don't spawn new device registrations. Skipping
this feeds the open ghost-device-accumulation problem
(`.agents/tasks/2026-07-21-device-registration-ghost-accumulation-cross-platform.md`)
with every harness run.

## Config changes and blast radius

Everything else in this task is new files that nothing imports — delete them and both
apps behave identically. These are the edits that touch existing config, each with
its own failure signature. Read this before starting slice 1.

| # | file | change | what breaks, and how you'd know |
|---|---|---|---|
| 1 | `mobile/jest.config.js` | add `testPathIgnorePatterns` for the harness dir | **Will break without it.** `testMatch` is `**/*.test.ts` (anywhere), so `*.scenario.test.ts` gets collected by the app's jest run and fails under the wrong setup. Signal: `yarn test` reports failures in files you didn't touch. Desktop hit this exactly — 8 files failing `vitest run` for this reason alone. |
| 2 | `mobile/package.json` | harness devDeps + a `harness` script | Deps are never bundled (nothing in the app imports them), but installing rewrites the lockfile and triggers the `postinstall`, which wipes Metro/`.expo` caches. First app start after is slow — expected, not a fault. Real risk is a resolution conflict. Check: install, start on a device, send one DM. |
| 3 | `mobile/.gitignore` | add `.state/`, `logs/` | Safety, not breakage. See §Safety above. |
| 4 | `mobile/tsconfig.json` | possibly exclude the harness dir | `include` is `**/*.ts`, so harness files land in app typecheck and IDE errors. Cosmetic, but noisy. Mobile has no `typecheck` script today, so low urgency. |
| 5 | `desktop/vitest.harness.config.ts` | alias → mobile's built bundle | Test-config only. Desktop's `package.json` is **not** touched (see slice 4). |

**One real-code change, in slice 2, isolated on its own branch.** Nothing above
touches shipping behaviour; slice 2 does.

## Slices

Each ends in something observable without reading a diff.

### Slice 1 — the shim stack proves itself  [quorum-mobile]
**Observable:** `yarn harness ping` in quorum-mobile → a bot registers on prod,
opens the WS, subscribes, prints its inbox address and "connected".

Nothing DM-specific. This exists to prove the four shims load together before any
logic is written — exactly how desktop's slice 1 de-risked its stack.

- `dev/harness/shim.ts` — RN/Expo globals, mirroring desktop's window shim
- `dev/harness/wasm-provider-shim.ts` — recon #1's `NativeCryptoProvider` subclass
- `dev/harness/sqlite-shim.ts` — `node:sqlite` behind the sync expo-sqlite surface
  `messagesDb.ts` actually uses (`execSync` / `runSync` / `getAllSync` /
  `getFirstSync` / `prepareSync` / `withTransactionSync`), minus `PRAGMA key`
- `dev/harness/mmkv-shim.ts` — in-memory `Map` behind `createMMKV`
- `dev/harness/securestore-shim.ts` — in-memory, seeded from `.env.local`
- `vitest.harness.config.ts` (mobile) — node env, aliases `@/*` → repo root, maps
  the five shims, maps `@quilibrium/quorum-shared` → `dist/index.js` (the **node**
  build, not `index.native.js` — mobile's `jest.config.js` already documents why)

Plus config edits 1-4 from §Config changes. **Do edit 1 (`jest.config.js`) and edit 3
(`.gitignore`) in the same commit as the first scenario file**, not later: edit 1
prevents a confusing red suite the moment a `.scenario.test.ts` exists, and edit 3
must land before anything writes key material.

> **Expected:** ping connects.
> **Most likely failure:** the shared node barrel still reaches a RN module on some
> import path, or `@/` alias collisions inside mobile's own tree.
> **Signal:** import-time throw naming an expo/RN module.
> **Countermove:** extend the alias map; mobile's `jest.config.js` `moduleNameMapper`
> is a working precedent for exactly this and should be copied from, not reinvented.

### Slice 2 — extract the DM receive core  [quorum-mobile]
**Observable:** the mobile app still works on a device (no behaviour change), and
the extracted module is importable in Node with no React.

Pull `handleIncomingMessage` and its DM helpers out of `WebSocketContext.tsx` into
a plain class/module, leaving the context a thin caller. Send needs little or
nothing (recon #2).

**This is the only change to shipping mobile code in the whole task, and it is the
only genuine risk.** This code runs for every mobile user on every DM received.

Protections, all three required:
- **It is a move, not a rewrite.** Same logic, new location. No behaviour change is
  intended, so any behaviour change is a bug.
- **Run the existing DM tests before and after.** Mobile already has 13 test files
  over this exact area (`confirmSenderSession`, `dmRatchetSerialization`,
  `dmSelfEchoGuards`, `encryptionStateDurability`, `initEnvelopeGuard`,
  `perDeviceSessionInbox`, `receiptReconciliation`, `receiptWiring`,
  `sessionSendShape`, …). Identical results before and after is the readable
  green/red signal that the move was clean.
- **Its own branch, verified on a real device before merge.** Separate from all
  harness work, so backing it out takes nothing else with it.

Also add the seam that forces the non-batch path (recon #3) — a **constructor flag,
not an env var**, so scenarios must set it explicitly.

> ⚠️ **The flag MUST default to batch-ON.** It exists only so a harness scenario can
> opt out. A backwards default silently strips the fast decrypt path from every
> mobile user, with no error and no failing test — the app would just get slower on
> message-heavy syncs. Cheap to get right, invisible when wrong. Check it twice, and
> assert the default in a unit test.

Scope to the DM path only; resist touching space/sync routing in the same pass.

> **Expected:** a mechanical move.
> **Most likely failure:** `handleIncomingMessage` closes over refs
> (`fullUserAddrRef`, `preUnsealedCacheRef`) and query-client state, so it doesn't
> lift cleanly.
> **Signal:** the extracted module needs 10+ constructor params.
> **Countermove:** that's the signal to pass a deps object, exactly as
> `MessageServiceDependencies` does on desktop. Mirror its shape — it makes slice 4
> nearly free.

### Slice 3 — mobile↔mobile  [quorum-mobile]
**Observable:** `yarn harness dm-basic` → two mobile bots exchange numbered DMs
both directions, merged both-sides JSONL in `logs/`. **This is the worst field case,
reproduced on a bench, with zero cross-repo work.**

Port `bot.ts` / `deps.ts` / `transport.ts` / `log.ts` from desktop. Carry over the
two bench defects the desktop harness paid for — they will recur verbatim:
1. **Per-bot database.** Desktop's `storage.ts` documents what a shared DB did:
   41-48% of arrivals were the bot's own outbound ciphertext. Namespace the sqlite
   file per bot from the first commit.
2. **Failures don't escape the receive path.** They're caught and the frame
   retained, so a naive observer measures "0 failures" while the log fills with AEAD
   errors. Tee the failure log line and classify **novel vs replay** — an already-
   decrypted frame refused on redelivery is the protocol working. Quote
   `novelErrors()`.

Also port `refreshSubscriptions`' change-detection: a `listen` re-pushes the whole
relay queue, which on desktop turned 3 expected failures into 437.

Then port the scenarios that already found things: `dm-reorder`, `dm-loss`,
`dm-stale-bucket`.

### Slice 4 — mobile↔desktop  [quorum-mobile build + quorum-desktop scenarios]
**Observable:** `yarn harness dm-cross` in quorum-desktop → a mobile bot and a
desktop bot exchange DMs in one process, one clock, one merged log. Completes the
2×2.

**The join is a built artifact, not a source import.** Both repos use `@/` (desktop
→ `desktop/src`, mobile → repo root) and a bundler alias cannot mean two things in
one module graph. So:

- quorum-mobile adds a tsup entry that emits a **Node-targeted ESM bundle** of the
  bot factory with `@/` resolved and the five shims baked in
- quorum-desktop points a **path alias** in `vitest.harness.config.ts` at that built
  file, and imports it
- cross-platform scenarios live in `src/dev/tests/harness/`, alongside the existing
  ones, feeding the same `log.ts` and `dr-*` analyzers

> **Deliberately NOT `link:../quorum-mobile`** (revised 2026-07-27 after review).
> Mobile's package is `"private": true` with `main: ./index.js` — the whole RN app.
> Linking it drags that entire project into desktop's dependency tree, triggers
> desktop's install + postinstall, and risks resolution conflicts, all to reach one
> built file. A vite alias reaches the same file with zero changes to desktop's
> `package.json`. Blast radius: one test config line vs. the dependency graph.

> ⚠️ **Mobile gitignores `dist/`**, so the bundle is never committed. A desktop
> cross-platform run therefore depends on a build that may not exist locally. The
> scenario must check for the file and fail with *"run `yarn harness:build` in
> quorum-mobile first"* — not a raw module-not-found, which reads as a broken test
> and costs someone an afternoon.

The build step doubles as the extraction's fitness test: if slice 2 left the DM core
entangled with `WebSocketContext`, the bundle won't build small (or at all).

> **Expected:** a bundle in the low hundreds of KB.
> **Most likely failure:** it drags in expo-router / notifications / navigation.
> **Signal:** bundle size, or an unresolvable import at build time.
> **Countermove:** treat it as slice 2 feedback and cut the dependency, not as a
> bundler problem to alias away. Aliasing the symptom here is how the harness stops
> resembling the app.

**Version-skew watch:** desktop links `../quorum-shared` (live), mobile installs a
published copy. Both are `2.1.0-37` as of 2026-07-27, so no skew today — but the
moment shared is edited locally the two bots diverge silently. Assert both bots'
resolved shared version in the cross-platform scenario's setup and fail loudly.

## Independent follow-up — `dm-conversation-mix` (buildable on desktop TODAY)

Not gated on any slice above. Belongs to the shared harness, so it runs on desktop
now and gains a mobile arm for free once slice 3 lands.

**What it is:** one scenario where two bots hold a *realistic* exchange — text,
replies, reactions, typing indicators, with delivery/read receipts flowing naturally
— measured with the same instruments `dm-loss` already uses. Not one scenario per
action verb.

**Why the traffic shape and not the actions.** `dm-basic` sends N text messages in a
tidy alternating loop. A real conversation generates several times the frames,
bidirectional and interleaved: every message draws a delivery-ack and a read-ack
back, typing fires continuously, reactions arrive in bursts. Every genuine finding
this harness has produced — the stale bucket, the reorder failures — is a
**frame-ordering and ratchet-state** phenomenon. Frame mix is therefore the variable
that can plausibly change the outcome; payload content provably cannot.

Corroborated by `.agents/tasks/2026-07-27-combined-receipt-ack-and-protocol-options.md`,
which exists precisely because receipt acks are extra frames on the same ratchet, and
which cross-references typing as more control traffic on that same ratchet.

**Include typing deliberately** — `sendEphemeralDMControl` (MessageService.ts:429) is
the one action here that is *structurally* a different path: it calls
`encryptAndSendDm` directly, bypassing the action queue, and never persists. It earns
its place on that merit, not because it is an "action".

### ⛔ Settled: do NOT add a harness scenario per message action

Asked and answered 2026-07-27. Recorded so it isn't re-litigated.

- **They are one code path.** delete, edit, pin, reaction, remove-reaction and
  replies all enter `submitMessage` (MessageService.ts:2766). Identical encryption,
  ratchet advance, wire frame and decrypt. The only difference is a `type` field in
  the payload and post-decrypt handling. The ratchet cannot distinguish a reaction
  from "hello", and the ratchet is what this harness tests.
- **Two of them aren't transport at all.** Bookmark never emits a DM frame (it is
  `ConfigService` config-sync plus a local row). Signed/unsigned is `submitMessage`'s
  `skipSigning` flag, and signature verification happens *after* decrypt, so it
  cannot affect whether a message lands.
- **They are already covered.** `src/dev/tests/services/ActionQueueHandlers.unit.test.ts`
  has 70 cases with dedicated blocks for reaction, pin-message, unpin-message,
  edit-message, delete-message, reaction-dm, delete-dm, edit-dm, send-delivery-ack
  and send-read-ack. Harness copies would be pure overlap — the same audit the
  original harness task ran before skipping its own duplicate candidates.

### 🟡 AMPLIFIER, NOT CAUSE: images and GIFs — multi-MB frames, never yet sent on the bench

> **Twice corrected. Now essentially closed as a lead.**
>
> 1. I first called this the highest-value scenario. The operator pointed out field
>    testing has been almost entirely **plain text**, and the asymmetry shows up there
>    — so size cannot be the mechanism. Demoted to "possible amplifier".
> 2. Then the investigation doc closed even that: **§27.5 measured it.** Losses were
>    proportional at every wire length (2/4 @1810, 2/6 @1858, 4/11 @3106). The black
>    hole is **size-blind**, which rules out MTU, size thresholds and chunking bugs.
>
> So `dm-large-payload` has **no diagnostic value for the known loss**. Keep this
> section only for the payload facts below, which are independently interesting (a 2 MB
> GIF really does become ~5.4 MB on the wire, and mobile really does duplicate it), and
> may matter for memory, latency or battery. **Do not build it as a transport
> experiment.** If it ever gets built, it is a performance question, not a loss one.

**This reverses an earlier call in this document.** The first pass assumed media was
referenced by URL and therefore out of scope. That was wrong. The operator corrected
it, and the code confirms: media is **inlined as base64 into the message payload**.
`services/media/imageAttachment.ts:10` states it outright — *"Convert to base64 data
URLs for transmission"*. `EmbedMessage.imageUrl` carries the bytes, not a link.

This makes frame *size* a first-class transport variable, and it is completely
untested — `dm-basic` sends short text strings.

**Verified payload sizes** (`quorum-shared/src/utils/imageConfig.ts` +
`quorum-mobile/services/media/imageAttachment.ts`):

| case | binary | base64 in the payload |
|---|---|---|
| static image (compressed to target) | 1 MB | **~1.33 MB** |
| + `thumbnailUrl` when image >300px | ~20-40 KB | extra data URL in the same message |
| **GIF — not compressed at all** (`preserveGifAnimation: true`), hard cap 2 MB | 2 MB | **~2.7 MB** |
| **GIF as actually sent on mobile** — the GIF branch sets `thumbnailUrl: imageUrl`, assigning the *same full-size data URL twice* | 2 MB | **~5.4 MB in one message object** |

Two multipliers on top:

1. **No cap anywhere in the client.** Greps for `maxPayload`, `MAX_FRAME`,
   `payloadTooLarge`, `413`, and any chunking logic return nothing. Whatever the
   payload is, it goes on the socket whole.
2. **Per-device fanout.** `sendEncryptedMessageToAllDevices` encrypts separately for
   every recipient device, so ciphertext scales with device count. One 5.4 MB GIF to a
   counterparty with 4 devices is tens of MB pushed in a single send.

**Why this fits the observed asymmetry.** The reason to care is that it matches the
symptom shape: mobile users send camera photos and GIFs far more than desktop users
do, over flakier networks, and mobile's native batch decrypt path (recon #3) would be
handling multi-MB payloads. Large frames are a plausible mechanism for
"mobile→anything is worse", and nothing in the existing bench would have caught it.

**If ever built** (performance question, not a loss one):
- realistic ~1.3 MB image messages, and ~5 MB GIF messages, vs the text baseline
- measure latency, memory and battery, not loss — loss is already known size-blind
- vary recipient device count to exercise the fanout multiplier

**Unverified, worth checking early in that work:** whether desktop duplicates the GIF
into `thumbnailUrl` the same way mobile does. Mobile's duplication is confirmed at the
GIF branch of `processImageAsset`; the desktop send-side construction was not located
(only its render path, `useMessageFormatting.ts`). If desktop does *not* duplicate,
mobile is putting ~2× the bytes on the wire for the same GIF, which is a concrete
cross-platform asymmetry in exactly the direction the field reports point.

**Stickers stay out of scope** — `StickerMessage` is `{type:'sticker', stickerId}`, a
genuine reference, and stays small.

**Separate thread, not harness work:** a search for `encryptFile` / `encryptMedia` /
`mediaKey` across `quorum-desktop/src` and `quorum-shared/src` returned nothing. For
inlined media this is moot (the bytes ride inside the encrypted message body), but
`tus-js-client` in mobile's dependencies indicates a separate upload path exists for
*video* — `pickMedia` confirms video skips base64 and streams from `localUri`. Whether
that upload is E2E encrypted is unexamined. A privacy question, not a transport one.

## Open question for after slice 3

If mobile↔mobile is **clean** on the bench, recon #3 becomes the primary hypothesis
and the next task is a native-side one (differential-test `batchProcessMessages`
against per-message decrypt on a device, chasing the documented `truncated:true`
path). Note that in the progress log rather than treating a green bench as a dead
end.

## Progress log

- 2026-07-27: spec written. Recon done against real code in both repos — findings
  #1-3 above. Not started.
- 2026-07-27: config/blast-radius review with the operator. Five changes:
  (a) §Config changes added — the jest `testMatch` collision is a *certain* breakage,
  not a risk; (b) slice 4 drops `link:../quorum-mobile` for a vite path alias, so
  desktop's `package.json` is untouched; (c) mobile gitignores `dist/`, so the
  cross-platform scenario needs an explicit "build mobile first" guard;
  (d) the non-batch flag's default documented as a silent-failure hazard;
  (e) placement re-confirmed — mobile gitignores `.agents/` entirely, so a task file
  there would never be committed.
- 2026-07-27: scope question from the operator — should the harness cover message
  actions (delete/edit/bookmark/pin/signed-unsigned), reactions, replies, and then
  embeds/images/stickers? Audited the code: no, and both refusals are recorded above
  with their evidence so they aren't re-litigated. What came *out* of the question is
  worth more than the question — `dm-conversation-mix`, testing traffic **shape**
  rather than payload type. Buildable on desktop today, independent of slices 1-4.
- 2026-07-27: **correction, operator-supplied.** I had ruled embeds out on the
  assumption media was URL-referenced. Wrong — media is base64-inlined into the
  payload ("Convert to base64 data URLs for transmission",
  `mobile/services/media/imageAttachment.ts:10`). Real payloads are ~1.33 MB for an
  image and **~5.4 MB for a 2 MB GIF** (mobile duplicates the full data URL into
  `thumbnailUrl`), with no client-side cap and per-device fanout on top. Frame size is
  therefore a major untested transport variable that fits the mobile-worse symptom.
  `dm-large-payload` added as the **highest-value** scenario on the list. The lesson
  for whoever reads this next: the earlier ruling was reasoned from a type definition
  (`imageUrl?: string` *looks* like a link) instead of from the code that fills it.
- 2026-07-27: **ranking corrected by the operator.** Field testing has been almost all
  plain text, and the mobile-worse asymmetry appears there — so payload size cannot be
  the mechanism, only a possible amplifier. `dm-large-payload` demoted from lead
  hypothesis to reproduction leverage. Follow-on inference recorded in §What the field
  evidence already implies: the bad cases (mobile→desktop, mobile→mobile) point at
  mobile's **send** path, which is in tension with recon #3's **receive**-side suspect.
  `desktop→mobile` is the untested cell that discriminates, and is now the
  highest-information single experiment.
- 2026-07-27: **premise falsified — largest correction in this file.** The operator
  pointed at the live investigation
  (`quorum-mobile/.agents/bugs/2026-07-24-dm-desktop-frames-undecryptable-state-divergence.md`,
  29 rounds). Everything I had reasoned toward was already known or already dead:
  desktop↔desktop is NOT a clean control (falsified 2026-07-26, 0/10 both directions);
  `desktop→mobile` is not untested (12/12, two consecutive rounds); mobile-send was
  the 2026-07-25 model and shipped fixed in PR #180; and size was measured
  size-blind in §27.5. I had asked for a manual test that has been run ~29 times.
  Task re-scoped: see §READ THIS FIRST. The harness's live value is now **item 1 —
  it removes RN's native transport from the loop**, which is the exact residual §26
  cannot close (~80% node-side). That runs on the *existing desktop* harness, today,
  with no mobile work. **Lesson: this file should have opened by reading the sibling
  repo's investigation. `.agents/` is gitignored in quorum-mobile, so a desktop-side
  agent will not stumble on it — the `related:` frontmatter is the only pointer.
  Follow it first.**
- 2026-07-28: **two `dm-loss` runs executed, both null.** Run 1 throwaways (402
  frames), run 2 canonical aged multi-device accounts (201 measurable per direction,
  3618 pushed, ~9 frames/message fan-out). 0.0% loss both directions, both runs,
  stable across a 10-minute settle. First desktop-side measurement of the write-layer
  drop that exists. Moves probability toward the RN native layer without isolating it.
  **Net effect on this task: slices 1-3 are re-justified on evidence** — running
  mobile's client code on the Node `ws` transport is a single-variable experiment
  (transport swapped, send logic held constant) that the investigation has never been
  able to run. Priority for the mobile bot goes back UP.
  Side corpus: 140 novel-but-healed decrypt failures captured
  (`user-a` 53 / `user-b` 87 records), the aged-session lag class, `dr-ablate`-ready.

---
*Last updated: 2026-07-27*
