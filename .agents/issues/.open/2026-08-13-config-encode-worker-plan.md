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

- [ ] Bench `postMessage` round-trip cost for an 8MB string and a 10.7MB string
      (`src/dev/tests/perf/`, run with `yarn bench`).
- [ ] Compare against transferring an `ArrayBuffer` with a **Transferable**, which is
      zero-copy and may be dramatically cheaper.
- [ ] **Decision gate:** if string cloning is expensive, change the contract so the worker
      returns `ArrayBuffer`s (transferred) and the main thread does the final cheap
      conversion, or move signing into the worker too so only a small signature comes back.

Do not write the worker until this number exists.

## STEP 2 — Build the worker

- [ ] `src/workers/configEncode.worker.ts` (new folder — production worker code, distinct
      from `src/dev/`).
- [ ] Input: `{ configJson: string | ArrayBuffer, key: CryptoKey, iv: Uint8Array, ts: number }`
- [ ] Work: AES-GCM encrypt → hex → append iv hex → utf-8 → append 8 timestamp bytes → base64
- [ ] Output: `{ ciphertext, signedPayload }` in whatever representation Step 1 chose
- [ ] Use `self.crypto.subtle`, never `window.crypto` — `window` does not exist in a worker.
- [ ] Avoid `Buffer` inside the worker. It is a polyfill and is a prime suspect for why
      the browser figure sits at the top of the measured range; use `TextEncoder` and a
      chunked base64 instead.

## STEP 3 — Wire it into ConfigService

- [ ] Replace the inline chain at `ConfigService.ts:832-857` with an `await` on the worker.
- [ ] **Keep a main-thread fallback.** If the worker fails to construct (Electron quirk,
      CSP, bundling problem), fall back to the existing inline path. Saving the user's
      config must never depend on the worker starting. This is a correctness requirement,
      not a nicety.
- [ ] One worker instance, created lazily on first save and reused. Do not spawn per save.

## STEP 4 — Verification

The first item is the one that matters; the rest support it.

- [ ] **Byte-identical output test.** Worker output must equal the current implementation's
      output *exactly*, for the same input. The server verifies a signature over these
      exact bytes, so a one-byte difference is a silent auth failure, not a visible bug.
      Assert equality of both `ciphertext` and `signedPayload` against the existing code
      path across several sizes including an empty config.
- [ ] Falsification check: deliberately corrupt one byte in the worker output and confirm
      the test goes red. An equality test that cannot fail is worse than none.
- [ ] `yarn test:run` green; `tsc --noEmit` exit 0.
- [ ] **Electron.** Build and run the Electron app, save a config, confirm the worker
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
| Electron worker behaviour untested | Step 4; fallback path means worst case is today's performance, not breakage |
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
