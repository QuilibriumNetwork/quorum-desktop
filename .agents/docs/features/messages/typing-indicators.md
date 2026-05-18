---
type: doc
title: "Typing Indicators"
status: done
ai_generated: true
created: 2026-05-18
updated: 2026-05-18
related_docs:
  - .agents/docs/features/messages/dm-receipts.md
related_tasks:
  - .agents/tasks/.done/2026-05-18-typing-indicators-design.md
  - .agents/tasks/.done/2026-05-18-typing-indicators-plan.md
---

# Typing Indicators

> AI-generated. May contain errors. Verify before use.

Live "X is typing..." indicators in DMs, space channels, and threads. Built on the same ephemeral-control-message pattern as DM receipts. Strictly opt-in per the Quorum privacy rule (enabling reveals composing-behaviour that would not otherwise leak).

## Overview

When a user enables typing indicators in Settings > Privacy, their composer broadcasts `typing-start` and `typing-stop` control messages to other clients. Recipients render an indicator above the MessageComposer when the relevant scope has active typists.

Two independent global toggles, both default OFF:
- "Send typing indicators in DMs" -> `UserConfig.typingIndicatorsDM`
- "Send typing indicators in spaces" -> `UserConfig.typingIndicatorsSpaces`

## Mechanism

Typing signals are ephemeral control messages. They ride the existing encrypted transport (Double Ratchet for DMs, Triple Ratchet hub broadcast for spaces) but are intercepted in `MessageService.processDeliveryReceiptData` before `saveMessage`. This means:

- Never written to IndexedDB
- Never added to the sync manifest digest
- Never propagated to late-joining peers
- Exist only as an in-memory event

This is the same mechanism that makes `delivery-ack` and `read-ack` safe to broadcast. The packet transits the network but does not live on the network.

## Cost profile (DM path)

Although typing messages never touch `messages` storage, each DM typing event **does** advance the Double Ratchet on both sides. Per `typing-start` (Alice → Bob):

| What | Where | Cost |
|---|---|---|
| DR encrypt + new sender state | `MessageService.encryptAndSendDm` | 1 IndexedDB `put` on `encryption_states` + 1 on `latest_states` (Alice) |
| Network frames | WebSocket | one `listen` + one `direct` envelope |
| DR decrypt + new receiver state | DM decrypt path | 1 `put` on `encryption_states` + 1 on `latest_states` (Bob) |

`encryption_states` is keyed by `(conversationId, inboxId)` and the counterparty inbox address is stable across ratchet advances, so writes **overwrite in place** — no row count growth, no append-on-each-keystroke bloat. Worst-case write frequency per active opted-in DM is ~12 events/min, bounded by the 5 s sender throttle. In typical bursty composing the multiplier is ~2–4× ratchet operations per drafted message (a couple of typing-starts + one typing-stop + the real message).

The one plausible slow-leak vector is `skipped_keys_map` growth on a single DR row if typing ciphertexts are lost or arrive out of order (the receiver holds skipped keys waiting for ciphertext that for typing will never come). Whether the SDK bounds this map (by entry count or age) is a pending question for the SDK team — applies to any out-of-order DM, not just typing.

Space typing rides Triple Ratchet hub broadcast and does NOT advance any per-conversation ratchet — see [`cryptographic-architecture.md`](.agents/docs/cryptographic-architecture.md) for the broadcast model.

Full analysis: [`.agents/tasks/.done/2026-05-18-typing-dm-ratchet-investigation.md`](.agents/tasks/.done/2026-05-18-typing-dm-ratchet-investigation.md).

## Key files

| File | Responsibility |
|---|---|
| `src/types/typing.ts` | `TypingMessage` wire type, `TypingScope` discriminated union, scope key helpers |
| `src/services/TypingService.ts` | Send throttling, receive-side state, subscription bus, privacy gate |
| `src/services/MessageService.ts` | `sendEphemeralDMControl`, `sendEphemeralSpaceControl`, interception in `processDeliveryReceiptData` |
| `src/components/context/MessageDB.tsx` | TypingService instantiation, transport-callback wiring, polled UserConfig ref |
| `src/hooks/business/messages/useTypingNotifier.ts` | Composer-side hook (called inside MessageComposer) |
| `src/hooks/business/messages/useTypingIndicator.ts` | Display-side hook (subscribes for current scope) |
| `src/components/message/TypingIndicator.tsx` | UI component (fixed-height row above composer) |
| `src/components/message/TypingIndicator.scss` | Three-dot animation keyframes |
| `src/components/message/MessageComposer.tsx` | Calls `useTypingNotifier`, wires `notifyKeystroke` to textarea onChange and `notifyMessageSent` to submit |
| `src/components/direct/DirectMessage.tsx` | Renders TypingIndicator above composer with DM scope |
| `src/components/space/Channel.tsx` | Renders TypingIndicator above composer with space-channel scope, gated by `canPost` |
| `src/components/thread/ThreadPanel.tsx` | Renders TypingIndicator above composer with thread scope, gated by `!isClosed` |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Settings UI with two independent toggles |
| `src/db/messages.ts` | `typingIndicatorsDM` / `typingIndicatorsSpaces` fields on UserConfig |

## Throttling and TTL

| Concern | Value |
|---|---|
| Sender throttle | At most one `typing-start` per 5 seconds per scope |
| Explicit `typing-stop` triggers | Message sent, composer blur (via tab visibility-hidden), conversation/thread close |
| Receiver TTL | 8 seconds per typist; renewals reset the timer |
| `typing-stop` behaviour | Removes the typist immediately; ignored if no prior entry |
| Reorder protection | Receiver tracks `msg.timestamp` per typist; older messages are dropped |
| Freshness filter | Receiver drops any typing message whose wire timestamp is older than 30 seconds before any further processing. Defends against hub-replay on subscribe-join, which would otherwise flood the receive path with ancient typing-starts the TTL expired long ago. |

## Privacy gate (symmetric)

Both send and receive are gated by the user's setting:

- **Send**: `TypingService.notifyTyping` / `notifyStopped` no-op when `isEnabledForScope` returns false
- **Receive**: `TypingService.onTypingReceived` no-ops when the gate is closed (even though `MessageService` hands the message off, the service drops it before updating any state)

This produces reciprocity: if either side has the toggle OFF, neither sees indicators. The pattern matches DM receipts.

Known limitation (documented for transparency): the privacy model is a social contract between cooperating clients. A modified client could observe incoming typing without sending its own. Accepted trade-off -- the same applies to receipts, and to Signal/WhatsApp typing indicators.

## Display rules

| Active typists | Text |
|---|---|
| 1 | `{name} is typing...` |
| 2 | `{name1} and {name2} are typing...` |
| 3 | `{name1}, {name2} and {name3} are typing...` |
| 4+ | `Several people are typing...` |

v1 display uses truncated address (`alice7...x4y2`) as the name fallback. A follow-up can wire in proper display-name lookup based on scope (space members for spaces, DM contact for DMs).

## Scoping rules

| Scope | Typing signals reach | Receiver sees indicator if |
|---|---|---|
| DM | Conversation partner's inbox via Double Ratchet | Subscribed to that DM's address scope |
| Space channel | All space hub subscribers via Triple Ratchet broadcast | Subscribed to that channel's scope key |
| Thread | All space hub subscribers via Triple Ratchet broadcast | Subscribed specifically to that thread (NOT the parent channel) |

Thread typing does not appear in the parent channel -- the indicator's subscription scope is `th:spaceId:channelId:threadId`, distinct from the channel scope `sc:spaceId:channelId`.

## Permission gating

- DMs: always allowed (no permission system for 1:1 conversations)
- Channels: suppressed when `canPost` is false (read-only channel or muted user)
- Threads: suppressed when `isClosed` is true

The suppression happens in the composer-side hook (`useTypingNotifier`), which receives `canSendMessage={false}` from the parent component when the user can't post. No outbound typing signals are emitted in those contexts.

## UserConfig schema

Two new optional booleans added to `UserConfig` in `src/db/messages.ts`:

```typescript
typingIndicatorsDM?: boolean;     // default false
typingIndicatorsSpaces?: boolean; // default false
```

`useUserSettings` hook exposes both with corresponding setters, persisted via the existing config sync.

The MessageDB context maintains a `typingConfigRef` loaded once on mount from IndexedDB. Updates to the privacy toggles are pushed imperatively from `useUserSettings.saveChanges` via `setTypingConfig(dm, spaces)`, so the gate reflects new state immediately with no polling delay. On ON→OFF transitions, the setter also calls `TypingService.onSettingDisabled(kind)` which sends explicit `typing-stop` signals for all active outbound scopes of that kind and clears received typists so the indicator disappears on both ends instantly.

## DM session bootstrap caveat

For DMs, the typing send path uses `MessageService.encryptAndSendDm`, which **requires existing Double Ratchet sessions** in the local `encryption_states` table for the conversation. The method reuses cached sessions and does NOT create new ones on the fly (unlike the legacy DM send path which can hydrate sessions from `self`/`counterparty` registration data).

Consequence: in a brand-new DM, or one where local session state is missing (e.g., right after a fresh login on a device that hasn't yet sent or received any DM with that contact this session), typing signals silently no-op until the user sends a real message that bootstraps a session. After that one real message, typing works normally for the rest of the conversation.

This is an accepted trade-off: typing is fire-and-forget and shouldn't do expensive session establishment for every keystroke. The user-visible impact is that the "Alice is typing" indicator is absent on the first round-trip of a fresh DM, then works for everything after.

Space-channel typing is not affected — it broadcasts via the hub envelope, which doesn't depend on per-conversation ratchet state.

## Deferred features

- Per-conversation typing override (Conversation Settings)
- Per-space typing override (Space Settings)
- Mobile (`quorum-mobile`) implementation -- the `TypingIndicator.native.tsx` stub keeps Metro happy; mobile keystroke wiring is a follow-up task
- Custom status / presence -- see `.agents/tasks/.todo/2025-01-20-user-status.md`

## Known limitations

- **First-send DM bootstrap (see "DM session bootstrap caveat" above):** typing doesn't show in a fresh DM until one real message has been exchanged.
- **Display name fallback:** if the resolver can't find a display name, the indicator shows a truncated address. A proper per-context resolver could be added later (see the deferred display-name resolver hook discussion in the implementation plan).
- **DM ratchet advance per typing event:** opted-in DM typing costs a ~2–4× multiplier on Double Ratchet operations per drafted message (writes overwrite in place, no row growth). One open question: whether the SDK bounds `skipped_keys_map` for out-of-order DR receives. See the "Cost profile" section above and `.agents/tasks/.done/2026-05-18-typing-dm-ratchet-investigation.md`.

## Implementation notes worth knowing

**Why TypingService doesn't use Action Queue:** Action Queue is for durable, retried actions (delivery acks, message sends). Typing is high-frequency (potentially every 5s during active conversation) and fire-and-forget (no retry value). Routing typing through Action Queue would defeat the design and pollute IndexedDB.

**Why `encryptAndSendDm` was extracted:** It was a private method on `ActionQueueHandlers`. Adding the typing send path required it to be reachable from `MessageService.sendEphemeralDMControl`. Extracted to a public method on `MessageService` (commit `f48941b1`). All existing callers (delivery-ack, read-ack, reactions, deletes, edits) now delegate via `messageService.encryptAndSendDm` instead of the private handler method.

**Why fixed-height indicator row:** A row that shows/hides dynamically would shift the composer position and create CLS, particularly painful on mobile where Virtuoso scroll positions are already fragile (see `.agents/bugs/2026-03-19-message-list-scroll-jank-on-send.md`). The `h-5` (20px) reserves space at all times.

**Why the TypingService instance is stable across MessageService re-memoizations:** In `MessageDB.tsx`, `messageService` and `actionQueueService` have large dependency lists in their own `useMemo`s, so they get re-memoized on many navigations (e.g., when the `navigate` callback changes identity). An earlier version of the typing wiring depended on these directly in the TypingService `useMemo`, which caused the service to be destroyed and recreated on every such re-memo. Hook subscribers in the indicator component held closures pointing at the destroyed instance while incoming messages were dispatched to the new instance with an empty listeners map — manifesting as "after navigating Space → DM → Space, typing indicator stops showing until hard refresh." Fix (commit `7654dc0a`): TypingService is built once per `selfAddress` (the only dep that genuinely warrants a new instance). The callbacks read the latest `messageService` / `actionQueueService` via refs so they always call the current versions. The wiring `useEffect` re-runs `setTypingService(typingService)` when either side changes (no-op when nothing changed); the destroy `useEffect` only fires when `typingService` itself invalidates (sign-out / provider unmount).

---

*Created: 2026-05-18 -- initial implementation.*

*Updated: 2026-05-18 -- resolved the "DM ratchet advance per keystroke" known-limitation entry with the investigation outcome (in-place overwrite, ~2–4× ratchet-op multiplier accepted, skipped_keys_map bound pending SDK confirmation).*

*Updated: 2026-05-18 -- added "Cost profile (DM path)" section with concrete per-event accounting; trimmed the limitations bullet to a one-line summary now that the detail lives in its own section.*

*Updated: 2026-05-18 -- added "freshness filter" row to the Throttling and TTL table (drops typing messages > 30s old at receiver) and an implementation note explaining why TypingService is built once per `selfAddress` instead of per-messageService rebuild (fixed the Space → DM → Space stale-listener bug).*

*Updated: 2026-05-18 -- removed the "Backwards compatibility" section. It described federated mixed-version scenarios (Alice on v1.5 with typing, Bob on v1.4 without) that don't apply pre-production. If we later need to handle clients on different versions, mitigations can be designed against the actual situation.*
