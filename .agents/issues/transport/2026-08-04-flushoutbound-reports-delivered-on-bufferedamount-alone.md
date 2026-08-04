---
type: bug
title: "flushOutbound reports success on bufferedAmount alone, so a revoke-device broadcast can be reported delivered and then wiped"
status: open
priority: medium
created: 2026-08-04
severity: medium (a false \"delivered\" on the revoke-device path, immediately followed by a local wipe that destroys the evidence and the ability to retry. Narrow trigger on desktop today — it needs the relay blind window, which Chromium's fast pong makes rare — but there is no recovery when it does fire)
area: WebSocket transport / send durability / device deregistration
repos: quorum-desktop
source: split out of .agents/issues/transport/2026-08-01-desktop-send-retention-gap.md on 2026-08-04, after an independent review pass found it while scoping that fix
related:
  - ".agents/issues/transport/2026-08-01-desktop-send-retention-gap.md (the sibling fix. Adding SendRetention does NOT close this; its H2 records the interaction to decide)"
  - ".agents/issues/transport/2026-07-30-mobile-frames-lost-into-a-dying-websocket.md (the blind window this rides on)"
  - ".agents/issues/.done/2026-07-21-device-registration-ghost-accumulation-cross-platform.md (already flagged this as an open desktop follow-up — see its intro)"
---

# `flushOutbound` claims more than `bufferedAmount` can prove

## Status

found 2026-08-04 by code reading during the Option-B scoping of the send-retention gap. Not runtime-reproduced, and on desktop it is hard to reproduce naturally for the same reason the sibling gap is latent. Previously noted in passing in the device-registration task; this is the first time it has been written up on its own.

## 1. Claim

`flushOutbound` exists specifically so the reset-app-data path can prove its goodbye frames
left the machine before the page reloads and destroys local state. Its success signal is
`ws.bufferedAmount === 0`, which proves the bytes reached the OS socket buffer. It does not
prove they reached the relay.

That is the **same illusion** the whole send-retention effort exists to correct: `ws.send()`
returning without throwing means the local buffer accepted the bytes, in any WebSocket
implementation. `bufferedAmount` draining to zero is a slightly later measurement of the same
thing.

So in the relay blind window — connection killed with no close frame, `readyState` still
reporting `OPEN` for 3.5-5 s — `flushOutbound` returns `true`, the caller proceeds, and the
frames are gone.

## 2. The code

`src/components/context/WebsocketProvider.tsx:252-284`. Two barriers, both local:

```ts
const bufferDrained = async (): Promise<boolean> => {
  while (Date.now() < deadline) {
    const ws = wsRef.current;
    if (!ws || ws !== sendingOn || ws.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount === 0) return true;          // <-- the success signal
    await new Promise((r) => setTimeout(r, FLUSH_POLL_MS));
  }
  return false;
};
```

The function is **already self-aware about the weaker half** of this. Its own doc comment
(`:234-250`) says `ws.send()` "only copies into the browser's socket buffer" and that neither
barrier "tells a caller its frames left the machine". The sentinel and the `sendingOn`
identity check are careful work — they close the queue-drain race and the reconnect-swap race.
What neither can close is a socket that is dead while still reporting `OPEN`, because every
signal it consults is local to this machine.

## 3. Why this path in particular

`src/hooks/business/user/useDeregisterThisDevice.ts:142`:

```ts
const flushed = await flushOutbound(SPACES_TIMEOUT_MS);
```

This is the revoke-device-before-wipe flow. The ordering makes the failure unrecoverable in a
way an ordinary lost message is not:

1. revoke-device frames are queued and written
2. `flushOutbound` returns `true` on a dead socket
3. the caller treats deregistration as broadcast and continues
4. local state is wiped and the page reloads

After step 4 there is no queue, no retention buffer, and no record the frames existed. Nothing
retries, and nothing can: the keys needed to re-sign them are gone. The peers keep a device
entry that its owner believes is revoked.

This is also the exact shape recorded as ghost-device accumulation: registration merges device
entries and never removes them, so every silently-failed deregistration is permanent.

## 4. Severity, stated honestly

**On desktop today the trigger is rare.** Chromium pongs in milliseconds, so the blind window
essentially never opens; desktop connections have been observed holding 20+ minutes. That is
why this has not visibly bitten, and it is the same reason the sibling retention gap is latent.

**It is worse than the sibling gap when it does fire**, for two reasons:

- The sibling gap loses a chat message, which redelivery, the receive-side gap detection, or a
  resend can recover. This loses a security-relevant broadcast and then destroys the means of
  retrying it.
- The caller is told it succeeded. A silent failure that reports success is worse than one that
  reports nothing, because it suppresses the fallback the caller would otherwise take.

⚠️ **Do not conclude "retention fixes this".** Retention replays frames on the **next**
connection. This caller reloads the page, so there is no next connection for it. The sibling
fix makes ordinary message loss survivable and leaves this path exactly as it is.

## 5. Fix directions, not yet chosen

Listed in increasing order of honesty, and none of them are free:

| # | approach | what it buys | what it costs |
|---|---|---|---|
| 1 | **Gate on retention state** — do not resolve `true` while the just-sent frames are still live or sealed in `SendRetention` | Turns a false success into a false *failure*, which is the safe direction. Composes with the sibling fix | Requires the sibling fix first, and needs a way to ask retention "are these specific frames still outstanding" |
| 2 | **Report honestly and let the caller decide** — return a tri-state (`confirmed` / `unconfirmed` / `offline`) instead of a boolean, and have the deregister flow surface "could not confirm, keep this device registered" | Removes the lie without needing delivery proof, which the protocol cannot give | UI/UX work on a rarely-hit path; the caller has to have a sensible fallback |
| 3 | **Do not wipe until confirmed** — hold the revoke frames in durable storage across the reload and retry on next launch | Actually delivers, rather than failing safely | Needs signed frames to outlive the wipe, which is a wipe-semantics question, not a transport one |
| 4 | **Protocol write-ack** (upstream, `#183` item 3) | Settles it completely and settles the sibling gap too | Not ours. Standing ask on the lead dev |

Option 2 is the cheapest honest change and does not depend on the sibling fix. Option 1 is the
natural pairing if the sibling fix lands first. **Decide when picking this up; do not default
to 1 just because it sounds most complete.**

## 6. Acceptance

1. With a fake socket forced dead-but-`OPEN`, `flushOutbound` must **not** report the
   optimistic result that today's `bufferedAmount === 0` path returns.
2. `useDeregisterThisDevice` must not proceed to the wipe on an unconfirmed flush, or must
   record what it could not confirm somewhere that survives the reload.
3. **Revert-check:** with the fix reverted, row 1 must go red. `src/dev/tests/components/websocketFlushOutbound.unit.test.tsx:16-49` already has a `FakeWebSocket` with
   controllable `readyState` and `sent[]` to build the harness on.
4. The existing `flushOutbound` tests must still pass — the sentinel and `sendingOn` identity
   checks are correct work and this must not regress them.

## 7. Not in scope

The relay pong deadline (`#183` item 1) and the send-retention integration itself. This issue
is only about `flushOutbound` telling its caller something it cannot know.

---
*Created: 2026-08-04*
