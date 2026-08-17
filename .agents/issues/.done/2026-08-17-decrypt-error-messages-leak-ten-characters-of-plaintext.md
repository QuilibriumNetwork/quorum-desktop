---
type: bug
title: "A failing decrypt leaks the first 10 characters of the plaintext into the error message, which is then logged"
status: done
priority: medium
created: 2026-08-17
updated: 2026-08-17
severity: narrow but real — 10 characters of decrypted message content, and they are the OPENING characters
area: crypto / error handling / logging
repos: quilibrium-js-sdk-channels (cause), quorum-desktop (logs it)
related_docs:
  - ".agents/issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md"
  - ".agents/docs/cryptographic-architecture.md"
---

# A failing decrypt leaks 10 characters of plaintext into the error message

## Status

**2026-08-17 — shipped in PR #349** (`feat: make the logger's production escape
hatch reachable`), with the redaction itself in quorum-shared PR #82.

What landed: redaction moved to `createLogMethod` in quorum-shared, the one
choke point every log call in every client passes through. Fixing the call
sites instead would have been a 32-file diff here (89 sites forward an error
object) that still would not have covered site 90, nor quorum-mobile, which
consumes the same SDK and has the same leak. `redact` defaults to false, so
local development keeps full-fidelity errors; only a production route turns it
on.

Review found the first version still leaked, and all three reviewers reproduced
it independently: a lazy `/"[^"]*"/` pairs delimiters wrongly when the echoed
excerpt contains its own quote, so `He "LEAKME" and more` came out as
`<redacted>LEAKME<redacted>`. Dialogue and scare-quotes are ordinary in real
messages. The `'leaks nothing regardless of what the plaintext starts with'`
test varied four openings and used a quote in none of them. Also fixed: the
walk stopped at depth 1 and bailed **before** walking a container found there,
so `{ errors: [err] }` leaked in full; `instanceof Error` missed cross-realm
errors and `DOMException`; stack traces were dropped; and a throwing getter
propagated out of `logger.error` into the caller's `catch`.

§5's requirement is met: 17 tests on the logger, each fix mutation-verified
separately, with a control arm asserting single-quoted identifiers survive so
redaction cannot quietly destroy the diagnostics it exists to protect.

## §1. The finding

`DoubleRatchetInboxDecrypt` (linked sibling SDK `quilibrium-js-sdk-channels`,
`src/channel/channel.ts:1175`) runs `JSON.parse()` **on already-decrypted
content**:

```ts
const maybe_initialization_info_and_message = JSON.parse(unsealed_envelope);
```

When the decrypted payload is not valid JSON, V8's `SyntaxError` echoes the
first 10 characters of its input into `error.message`. That error object is
caught in `MessageService.ts:4653` and handed straight to the logger at
`MessageService.ts:4661`:

```ts
logger.error('[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) — skipping frame, keeping session', decryptError);
```

So the log line carries the opening of somebody's message.

## §2. Measured, with a control arm

MEASURED 2026-08-17 against the real WASM binary
(`quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm`, 954,665 bytes),
driven from Node via the SDK's exported `initSync`.

**Control arm — the instrument works.** A real Double Ratchet session was built
with `js_generate_x448()` keypairs, a canary encrypted, and a clean decrypt
performed. It recovered the canary byte-for-byte. A null result from the tamper
arm therefore means something.

**The crypto layer itself is clean.** Corrupting the ciphertext produced exactly
this, and nothing else:

```
Decryption failed: aead::Error
```

30 characters. `aead::Error` is RustCrypto's deliberately opaque error type and
carries no data by construction. Extracting every printable string from the WASM
binary found the same pattern throughout: `invalid signature`,
`MalformedHeader`, `SkipLimitExceeded`, `could not perform key agreement`,
`Malformed point`. No error string in the crypto layer interpolates payload data.

**The leak is in the JS layer, not the crypto.** Quantified directly:

```js
JSON.parse("Hey, my bank password is hunter2 and I will meet you at 5pm...")
// SyntaxError: Unexpected token 'H', "Hey, my ba"... is not valid JSON
//                                     ^^^^^^^^^^ 10 characters of plaintext
```

**Bounds of the leak**, both measured:

- Exactly **10 characters**, V8's fixed truncation.
- Only fires when the decrypted payload's **first token** is invalid JSON. A
  payload starting with `{` produces a positional error
  (`Expected property name or '}' at position 1`) which leaks nothing.

## §3. Current exposure

**Today: developer machines only.** Production builds discard every `logger`
call, so this never reaches a real user's console — see
`2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md`. The leak is
live in `yarn dev` and in any local build.

**This is a prerequisite, not an independent emergency.** It becomes real the
moment any production logging route exists: the `window.quorumLogger` escape
hatch under discussion in the logger issue, a diagnostics export, or a future
telemetry integration. All three would carry it. Note that `minLevel: 'warn'`
does **not** help here, because the leak travels on `logger.error`, which is
exactly the tier those proposals intend to open.

Worth stating plainly: the intended workflow for that escape hatch is "reproduce
the bug, copy the console, paste it into a report". This repo's issue tracker is
public.

## §4. The fix

Sanitise error objects at the logging site rather than passing them raw. V8 puts
echoed input inside double quotes, which makes it cheap to strip:

```ts
const safeError = (e: unknown) =>
  e instanceof Error
    ? { name: e.name, message: e.message.replace(/"[^"]*"/g, '"<redacted>"') }
    : { name: 'Unknown' };
```

Applied at `MessageService.ts:4661` and at any other site that forwards a caught
error from a decrypt path. 71 of 180 `logger.warn` / `logger.error` call sites
forward an error object (MEASURED), so the sweep is worth doing rather than
patching the single known site.

**Alternative, further upstream:** guard the `JSON.parse` in the SDK itself so a
non-JSON payload throws a constructed error instead of a V8 one. Better in
principle (fixes it for every consumer including mobile), but it lives in a
different repo and needs a release, so it should not block the local fix.

## §5. The test must be able to fail

Feed a canary string through a decrypt that fails at the `JSON.parse` step,
assert the canary does not appear anywhere in what reaches the logger. Then
**revert the sanitiser and confirm the test goes red** — an assertion that passes
either way is worse than no test.

## §6. How it was found

While auditing whether `logger.warn` / `logger.error` are safe to enable in
production (the Option 1 audit recorded in §1b of the logger issue). That audit
checked what *we* interpolate into log messages and found zero leaks, which was
correct but incomplete: it did not check what third-party code puts inside the
error objects we forward. An adversarial security review of the same proposal
also did not catch this.

The generalisable lesson: auditing the strings you write is not the same as
auditing the objects you pass.

---
*Last updated: 2026-08-17*
