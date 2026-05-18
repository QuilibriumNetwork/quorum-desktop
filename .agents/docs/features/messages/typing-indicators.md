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
  - .agents/tasks/2026-05-18-typing-indicators-design.md
  - .agents/tasks/2026-05-18-typing-indicators-plan.md
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

The MessageDB context maintains a `userConfigRef` polled every 5 seconds from IndexedDB so TypingService's `isEnabledForScope` callback always sees the current toggle state without React re-renders.

## Backwards compatibility

Old clients receiving typing messages: the wire format uses `type: 'typing-start'` / `'typing-stop'` at the top level (same shape as `delivery-ack` / `read-ack`). Old clients without typing-message handling will fall through their decrypt-layer interception to `saveMessage`, which may produce noise but cannot crash. New control types should be added to the existing intercept whitelist if encountered in production.

New clients receiving from old clients: no compatibility surface -- old clients simply do not send typing.

## Deferred features

- Per-conversation typing override (Conversation Settings)
- Per-space typing override (Space Settings)
- Mobile (`quorum-mobile`) implementation -- the `TypingIndicator.native.tsx` stub keeps Metro happy; mobile keystroke wiring is a follow-up task
- Real display-name resolution (currently truncated address)
- Custom status / presence -- see `.agents/tasks/.todo/2025-01-20-user-status.md`

## Implementation notes worth knowing

**Why TypingService doesn't use Action Queue:** Action Queue is for durable, retried actions (delivery acks, message sends). Typing is high-frequency (potentially every 5s during active conversation) and fire-and-forget (no retry value). Routing typing through Action Queue would defeat the design and pollute IndexedDB.

**Why `encryptAndSendDm` was extracted:** It was a private method on `ActionQueueHandlers`. Adding the typing send path required it to be reachable from `MessageService.sendEphemeralDMControl`. Extracted to a public method on `MessageService` (commit `f48941b1`). All existing callers (delivery-ack, read-ack, reactions, deletes, edits) now delegate via `messageService.encryptAndSendDm` instead of the private handler method.

**Why fixed-height indicator row:** A row that shows/hides dynamically would shift the composer position and create CLS, particularly painful on mobile where Virtuoso scroll positions are already fragile (see `.agents/bugs/2026-03-19-message-list-scroll-jank-on-send.md`). The `h-5` (20px) reserves space at all times.

---

*Created: 2026-05-18 -- initial implementation.*
