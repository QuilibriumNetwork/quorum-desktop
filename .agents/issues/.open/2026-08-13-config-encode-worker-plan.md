---
type: task
title: "Move the config-save encode chain to a Web Worker (Job A)"
status: open
priority: high
created: 2026-08-13
updated: 2026-08-13
area: performance / config sync
---

# Move the config-save encode chain to a Web Worker

**Observable outcome:** flipping a notification switch in Space Settings stops freezing
the UI. Today it blocks for ~1.8s.

Fixes the measured cause in
`.agents/issues/2026-08-13-notification-toggle-freeze-is-the-config-encode-chain.md`.
Read that first — every number below comes from it.

## Why this shape, in one paragraph

A browser A/B showed the queued `save-user-config` causes 93% of the freeze, and a bench
showed that within it, **string marshalling is 78% and signing only 9%**. The expensive
part — JSON, AES-GCM, hex, base64 — **needs no private key**. So it can move off the main
thread without touching the security argument that stalled the 2025 worker plan
(`.archived/background-action-queue-with-worker-crypto.md`), which assumed the cost was
signing and therefore needed the key.

Per-stage, 4MB config: `json 27ms · aes 274ms · hex 716ms · base64 1083ms · sign 216ms`.

**Scope is Job A only.** Moving *signing* (and with it kick/send/join crypto) is Job B: it
needs the WASM SDK and the keyset inside the worker, and is separately justified by
`.done/2025-01-30-kick-user-ux-improvements.md` (a 5-8s freeze on kick, still unfixed
despite that file sitting in `.done/`). Do not bundle them.

## The security property that makes this cheap

`ConfigService.ts:702-710` imports the AES key with **`extractable: false`**. A
non-extractable `CryptoKey` is structured-cloneable, so it can be `postMessage`d to the
worker, and the worker can **use** it to encrypt while being **unable to read the key
material**. The worker therefore receives no secret it could leak. This is strictly better
than the raw-key passing that report `007-plaintext-private-keys-fix.md` contemplated for
Job B, and it is why Job A carries essentially no security surface.

Do not "simplify" this by exporting raw key bytes and importing them in the worker. That
would throw the property away for no gain.

## STEP 1 — Spike first: measure the postMessage cost. Do not skip.

**This step exists because the win is not obviously net-positive, and this issue has
already produced two confidently-wrong diagnoses.**

The worker must return results to the main thread. At a 4MB config those are an ~8MB hex
string and a ~10.7MB base64 string. Structured-cloning them back is a copy, and if that
copy costs 500ms the gain largely evaporates.

- [ ] Bench `postMessage` round-trip cost for an 8MB string and a 10.7MB string.
      ⚠️ `yarn bench` runs under **jsdom, which has no `Worker`** — `new Worker` throws
      there. Two options: bench Node `worker_threads` inside `src/dev/tests/perf/` (same
      V8 structured-clone serializer, acceptable as a first-order proxy), or get the
      faithful browser number by extending the probe harness on
      `local/toggle-freeze-ab-DO-NOT-MERGE`. State in the recorded result which one it is.
- [ ] Compare against transferring an `ArrayBuffer` with a **Transferable**, which is
      zero-copy and may be dramatically cheaper.
- [ ] **Decision gate.** "Expensive" means: the **main-thread** share of the round-trip
      exceeds ~150ms at these sizes (the success band for the whole fix is 150-350ms
      total blocked, so a 150ms copy would eat most of the budget). If so, change the
      contract so the worker returns `ArrayBuffer`s (transferred) and the main thread
      does the final cheap conversion, or move signing into the worker too so only a
      small signature comes back.
      ⚠️ The signing option is not free: it puts the raw private key in the worker, which is
      Job B's security question all over again. Prefer the Transferable contract; in-worker
      signing is a last resort needing its own review, not a casual fallback.

Do not write the worker until this number exists.

## STEP 2 — Build the worker

- [ ] `src/workers/configEncode.worker.ts` (new folder — production worker code, distinct
      from `src/dev/`).
- [ ] **Structure: pure module + thin shell.** Put the encode chain in a pure module
      (e.g. `src/workers/configEncode.ts`) that touches no worker or DOM globals; the
      `.worker.ts` file is a thin `onmessage` shell around it. The main-thread fallback
      (Step 3) calls the **same module** — one implementation executed in either place,
      never two copies that must be kept byte-identical by hand. This is also what makes
      Step 4's equality test easy: the test imports the pure module directly.
- [ ] Input: `{ configJson: string | ArrayBuffer, key: CryptoKey, iv: Uint8Array, ts: number }`
- [ ] Work: AES-GCM encrypt → hex → append iv hex → utf-8 → append 8 timestamp bytes → base64
- [ ] Output: `{ ciphertext, signedPayload }` in whatever representation Step 1 chose
- [ ] Use `self.crypto.subtle`, never `window.crypto` — `window` does not exist in a worker.
- [ ] Avoid `Buffer` inside the worker. It is a polyfill and is a prime suspect for why
      the browser figure sits at the top of the measured range; use `TextEncoder` and a
      chunked base64 instead.

## STEP 3 — Wire it into ConfigService

- [ ] Replace the inline chain at `ConfigService.ts:832-858` with an `await` on the worker.
- [ ] **Keep a main-thread fallback.** If the worker fails to construct (Electron quirk,
      CSP, bundling problem), fall back to running the same pure encode module (Step 2)
      on the main thread — do **not** keep a second inline copy of the chain. Saving the
      user's config must never depend on the worker starting. This is a correctness
      requirement, not a nicety.
- [ ] The fallback must also cover **runtime** failure, not just construction. A worker
      `error`/`messageerror` mid-save must reject the awaited promise (then fall back
      inline or let the queue's retry handle it) — a save must never hang on a dead worker.
- [ ] One worker instance, created lazily on first save and reused. Do not spawn per save.
- [ ] **Correlate request and response** (an id per message), or serialize saves through
      the worker. One reused worker with two in-flight saves that swap replies means the
      wrong bytes get signed — exactly the silent auth failure Step 4 warns about, and
      invisible to every test that saves one config at a time.
- [ ] **Keep the RPC plumbing separate from the config logic.** The id correlation, error
      propagation and fallback wrapper are generic worker plumbing (e.g. a small
      `src/workers/workerRpc.ts`), with nothing config-specific in them. Job B — and any
      future worker, e.g. a config *decode* path — should reuse that helper instead of
      rebuilding it.

## STEP 4 — Verification

The first item is the one that matters; the rest support it.

- [ ] **Byte-identical output test.** Worker output must equal the current implementation's
      output *exactly*, for the same input. The server verifies a signature over these
      exact bytes, so a one-byte difference is a silent auth failure, not a visible bug.
      Assert equality of both `ciphertext` and `signedPayload` against the existing code
      path across several sizes including an empty config.
      ⚠️ Two traps: (1) after Step 3 the "existing code path" no longer exists in
      production code — **copy today's inline chain verbatim into the test file as a
      frozen reference implementation** (Buffer and all) before rewiring, and assert
      new-module output equals reference output. (2) The unit suite's setup **mocks
      crypto** (see the comment at `vitest.perf.config.ts:35-38`) — an equality test
      there would compare mocks with mocks and prove nothing. Run this test under the
      harness setup (`setup.harness.ts`), where crypto is real.
- [ ] Falsification check: deliberately corrupt one byte in the worker output and confirm
      the test goes red. An equality test that cannot fail is worse than none.
- [ ] `yarn test:run` green; `tsc --noEmit` exit 0.
- [ ] **Electron.** Build and run the **packaged** Electron app (the prod path loads over
      `file://` — see Risks; dev mode proves nothing), save a config, confirm the worker
      loads and the fallback is not silently doing all the work. Workers behave
      differently there and this was flagged untested in the 2025 plan.

### The falsifiable prediction

Re-run the A/B probe (`local/toggle-freeze-ab-DO-NOT-MERGE`), baseline arm, one click:

> **Predicted: total blocked drops from ~1817ms to roughly 150-350ms**, that residue being
> signing (~216ms at 4MB) plus React work. The `no-enqueue` arm already measured a 136ms
> floor, so anything near that is a success.
>
> **If it lands above ~800ms, this plan is wrong** — most likely the postMessage copy in
> Step 1 was underestimated, or the freeze has a third contributor nobody has found.

Costs the user ~1 minute. Write the number into the issue either way, including if it
disappoints.

## Risks

| Risk | Handling |
|---|---|
| Electron worker behaviour untested | Step 4; fallback path means worst case is today's performance, not breakage. Specifics (`web/electron/main.cjs:110-119`): **prod loads `dist/index.html` over `file://` with `webSecurity: true`; dev loads localhost with `webSecurity: false`** — so a dev-mode Electron check proves nothing about the packaged app, and `file://` is where Chromium workers historically misbehave. Also check Vite's `worker.format`: dev serves the worker as a module while the build default bundles it as classic iife, so dev and packaged builds run different worker types. Test the packaged build. |
| No Vite worker config exists in the repo | Use `new Worker(new URL('./configEncode.worker.ts', import.meta.url), { type: 'module' })`, which Vite supports natively |
| Byte-drift breaks server-side signature verification | Step 4's equality test is the gate |
| postMessage copy eats the win | Step 1 measures it before any code is written |
| CSP blocks worker construction | **Checked.** `web/index.html:8` is `default-src *; img-src * data: blob:; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'`. There is **no `worker-src`**, so workers fall back through `child-src` to **`script-src 'self'`**. A same-origin bundled worker is fine; a **`blob:` worker URL would be blocked**, and some Vite setups use one. If construction fails, this is the first thing to check — and the fix is a `worker-src` directive, not loosening `script-src`. |

## Explicitly out of scope

- Signing, and any crypto needing the keyset (Job B).
- The mention/reply recount. It is genuinely wasteful (~1200 IndexedDB round-trips per
  toggle) but measured *not* to cause this freeze. Fixing it here would muddy the result.
- The broken queue dedup (`ActionQueueService.enqueue` computes
  `hasProcessingTaskWithKey` and never gates on it). Real bug, separate change.
- Shrinking the config blob. A genuine lever since every stage is linear in size, but
  independent of this work.

## Note for a reviewer

Two prior diagnoses of this freeze were confidently wrong and both survived independent
review; only measurement caught them. The specific thing to be sceptical of here is
**Step 1**: the whole plan assumes moving work to a worker is net-positive, and that is an
assumption about copy costs, not a measured fact. If Step 1 comes back badly, the right
outcome is to abandon or reshape this plan, not to proceed and hope.

Also worth checking: this repo is **not** cross-platform any more (confirmed by the owner
2026-08-13), despite `AGENTS.md` and the `quorum-shared-migration` docs still describing
that migration as active. So a web-only Worker needs no `.native` counterpart — but those
docs are stale and misleading on the point.

---

*Last updated: 2026-08-13*

## Review Log
**2026-08-13 - claude-fable-5**: First review pass. Verified every code reference against the codebase: key import extractable:false confirmed at ConfigService.ts:702-711; encode chain confirmed at 832-858 (plan said 857, corrected); CSP quote verbatim at web/index.html:8 and the worker-src fallback reasoning is correct; broken dedup confirmed (ActionQueueService.ts:126 computed, 140-142 log-only); all referenced .agents docs, yarn bench and vitest.perf.config.ts exist. Nothing implemented yet (no src/workers/, no new Worker in src) so plan stays open. All edits applied, none pending.
- Added missing edge case: request/response correlation (or serialization) on the reused worker — two in-flight saves swapping replies would sign the wrong bytes, a silent auth failure invisible to single-save tests
- Added missing edge case: fallback must cover runtime worker failure (error/messageerror mid-save), not only construction failure — a save must never hang on a dead worker
- Added security caveat to the Step 1 decision gate: the move-signing-into-the-worker escape hatch reopens Job B's raw-private-key question and must not be treated as a casual fallback
- Enriched Electron risk with MEASURED facts from web/electron/main.cjs:110-119: prod loads over file:// with webSecurity:true, dev loads localhost with webSecurity:false, so only the packaged build is a valid test; flagged Vite worker.format dev-vs-build difference (module vs iife) as a thing to check

**2026-08-13 - claude-fable-5**: Follow-up in the same session, at the owner's request: added two structural notes so extensibility does not depend on the implementer rediscovering them.
- Step 2: encode chain lives in a pure module with a thin worker shell; the Step 3 fallback calls the same module, so there is one implementation, not two hand-synced copies
- Step 3: RPC plumbing (id correlation, error propagation, fallback wrapper) kept generic and separate from config-specific logic so Job B and future workers can reuse it

**2026-08-13 - claude-fable-5**: Handoff-readiness pass: closed three gaps a fresh agent would hit, all verified against the repo, not inferred.
- Step 1: yarn bench runs under jsdom (vitest.perf.config.ts:34) which has no Worker — spelled out the two valid bench routes (Node worker_threads as proxy, or the browser probe harness) and required the result to say which was used
- Step 1: defined the decision gate numerically — main-thread round-trip share over ~150ms triggers the Transferable contract
- Step 4: the byte-identical test needs a frozen copy of today's inline chain inside the test file, because Step 3 deletes the production reference; and it must run under setup.harness.ts since the unit suite setup mocks crypto and would compare mocks with mocks
