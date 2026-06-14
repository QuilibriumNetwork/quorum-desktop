---
type: bug
title: "Sync-received non-post messages (embed/sticker) lose their signature: messageId recompute hardcodes 'post'"
status: open
priority: high
ai_generated: true
created: 2026-06-14
updated: 2026-06-14
related_files:
  - "src/services/MessageService.ts"
related_docs:
  - ".agents/bugs/2026-06-13-space-members-missing-no-join-row.md"
---

# Sync path hardcodes `'post'` in the signature messageId recompute → non-post signatures nulled

## Symptom

In a non-repudiable space, signed **image / sticker** messages (and any non-`post` content type)
received via the **sync** path arrive with their signature stripped — `publicKey` and `signature`
are set to `undefined`, so the message renders with the "message does not have a valid signature"
warning (or is dropped, depending on downstream handling). Plain **text** (`post`) messages on the
same path verify correctly. This was surfaced while debugging desktop ↔ mobile space messaging,
where the live observation is "text comes through, images/GIFs don't."

## Root cause (confirmed by code read)

When verifying a message's signature, the recipient recomputes the `messageId` as
`SHA-256(nonce + content.type + senderId + canonicalize(content))` and checks it against the
transmitted `messageId` before running the Ed448 verify.

The **sync-received** path hardcodes the literal string `'post'` instead of the message's actual
content type:

`src/services/MessageService.ts:4185-4194`
```ts
const messageId = await crypto.subtle.digest(
  'SHA-256',
  Buffer.from(
    message.nonce +
      'post' +                       // <-- BUG: should be message.content.type
      message.content.senderId +
      canonicalize(message.content as any),
    'utf-8'
  )
);
```

This recompute is then compared against the transmitted id, and on mismatch the signature is nulled:

`src/services/MessageService.ts:4196-4203`
```ts
if (
  (participant?.inbox_address !== inboxAddress && participant?.inbox_address) ||
  message.messageId !== Buffer.from(messageId).toString('hex')
) {
  message.publicKey = undefined;
  message.signature = undefined;
}
```

The enclosing block (`:4169-4176`) loops over **every** message in the synced batch
(`for (const message of envelope.message.messages)`) and is gated only by
`space && !space.isRepudiable && message.publicKey && message.signature` — **not** by content type.
So a synced `embed`/`sticker`/etc. reaches `:4189` with the wrong type string baked into the hash.

- For a **`post`**: `'post'` happens to equal `content.type`, so the recompute matches and verify
  proceeds normally. ✅
- For an **`embed` / `sticker` / any non-post**: the recompute differs from the sender's
  `messageId` (which used the real type) → `messageId` mismatch → `publicKey`/`signature` nulled →
  message rejected as unsigned. ❌

The sender computes the id with the real type (e.g. `canonicalize` send paths use the actual
content type), and the **live (non-sync) receive path is already correct** — it uses the dynamic
type at `src/services/MessageService.ts:3181-3182`:
```ts
decryptedContent.nonce +
  decryptedContent.content.type +   // correct
  ...
```
So the defect is **sync-path-only**. The other `'post'` literals in this file (`:2219`, `:2536`,
`:4656`) are **send-side** paths guarded by `isPostMessage` / only ever building post messages, so
they are correct — `:4189` is the only receive/verify site that hardcodes the type while handling
arbitrary content.

## Fix

`src/services/MessageService.ts:4189` — replace the literal `'post'` with `message.content.type`:
```ts
message.nonce +
  message.content.type +
  message.content.senderId +
  canonicalize(message.content as any),
```
This mirrors the already-correct live receive path at `:3182`.

## Verification

- **Static:** confirm the sync recompute now uses `message.content.type`; diff it against the live
  path at `:3178-3187` — they should be identical except for the variable name
  (`message` vs `decryptedContent`).
- **Round-trip (offline, no app):** the underlying signature primitive is confirmed sound — a full
  sender-sign → recipient-verify simulation with a real Ed448 key passes, and the
  `nonce + type + senderId + canonicalize(content)` messageId is byte-identical across the two client
  implementations for `post` and `embed`. So once the type is dynamic, a synced `embed` should
  recompute the same id the sender signed and verify cleanly.
- **Runtime:** send a signed image into a non-repudiable space such that it arrives via the sync path
  (e.g. recipient offline at send time, then reconnects and replays); confirm the image now shows
  with a valid signature.

## Scope / caveats

- **Affects non-repudiable spaces only** (the verify block is gated by `!space.isRepudiable`).
- **Not proven that every real failing image takes the sync path.** This is a confirmed, reachable
  defect that matches the "text works, images don't" symptom, but a captured failing message (which
  receive path it took, the recomputed vs transmitted id) would confirm it is THE cause vs a
  contributor. The fix is correct regardless — the sync path should never have hardcoded the type.
- Cross-platform context (desktop ↔ mobile space messaging) is tracked on the mobile side; this
  report covers the desktop defect in isolation.
