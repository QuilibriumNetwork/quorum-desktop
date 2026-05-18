---
type: task
title: "Typing Indicators — Design Spec"
status: design
created: 2026-05-18
updated: 2026-05-18
related_docs:
  - .agents/docs/features/messages/dm-receipts.md
  - .agents/docs/cryptographic-architecture.md
  - .agents/docs/quorum-shared-architecture.md
related_tasks:
  - .agents/tasks/.todo/2025-01-20-user-status.md
---

# Typing Indicators — Design Spec

Show who is currently composing a message, similar to Telegram and Discord. Display appears in a fixed-height row above the MessageComposer in DMs, space channels, and threads.

## Goals

- Live "X is typing…" indicator in DMs and space channels (including threads).
- Strictly opt-in per the privacy rule: enabling the feature reveals composing-behavior that would not otherwise leak, so both global toggles default OFF.
- No persistent footprint on the P2P network: typing signals never reach IndexedDB, never enter the sync manifest, never propagate to late-joining peers.
- Reuse existing transport (Double Ratchet for DMs, Triple Ratchet hub broadcast for spaces) — no new keys, no new protocols, no server.

## Non-goals (Phase 1)

- Per-conversation typing override (Conversation Settings stays unchanged).
- Per-space typing override (Space Settings stays unchanged).
- Custom status / "Away" / "Do Not Disturb" — separate Presence feature (see `.agents/tasks/.todo/2025-01-20-user-status.md`).
- Mobile implementation. The TypingService and hooks will be platform-agnostic so `quorum-mobile` can adopt them later, but `MessageComposer.native.tsx` wiring is deferred.

---

## Architecture

### Mechanism

Typing signals are **ephemeral control messages** that ride the existing encrypted transport. They use the same interception pattern as DM delivery and read receipts:

- **DMs**: encrypted with Double Ratchet, sent through the recipient's inbox.
- **Spaces**: encrypted with Triple Ratchet, broadcast through the space hub (same path as normal space messages).

On the receive side, they are intercepted in `MessageService.processDeliveryReceiptData` (or a new sibling method) **before** `saveMessage` is called. This guarantees:

- Never written to IndexedDB.
- Never added to the sync manifest digest, so they are never exchanged via the sync protocol.
- Never propagated to late-joining peers.
- Exist only as an in-memory event, processed once, then garbage-collected.

This is the same guarantee that makes `delivery-ack` and `read-ack` messages safe to broadcast: the wire protocol carries them, but the storage and sync layers never see them.

### Wire format

```typescript
// New control message type — intercepted, never persisted
type TypingMessage = {
  type: 'typing-start' | 'typing-stop';
  senderId: string;          // sender's address
  scope: 'dm' | 'space';     // routing hint for receivers
  spaceId?: string;          // space typings only
  channelId?: string;        // space typings only
  threadId?: string;         // thread within a channel
  timestamp: number;         // monotonic, used for reorder protection
};
```

### Scopes

Receivers organize typing state by **scope key**:

- **DM**: key is the conversation partner's address (`address`).
- **Space channel**: key is `spaceId:channelId`.
- **Thread**: key is `spaceId:channelId:threadId`. Typing in a thread does NOT show in the parent channel; receivers only render if they are currently viewing that thread.

### Throttle rules (sender)

- `typing-start`: at most once per **5 seconds** while user is actively typing (composer has content + recent keystroke).
- `typing-stop`: sent on (a) message sent, (b) composer blur / conversation closed. Not sent on idle pauses — receiver TTL handles that.
- If WebSocket is disconnected: don't send, don't queue. Typing is fire-and-forget.

### TTL (receiver)

- Each received `typing-start` (re)sets an **8-second** expiration for that sender in that scope.
- `typing-stop` expires the entry immediately.
- An in-memory `Map<scopeKey, Map<senderAddress, expiresAt>>` drives the UI.

### Privacy gating

Symmetric on both send and receive sides, matching the receipts model:

1. **Send side** (in `TypingService.notifyTyping` / `notifyStopped`): if the relevant global toggle is OFF, the call is a no-op. Nothing leaves the device.
2. **Receive side** (in `MessageService` interception): if the relevant global toggle is OFF, the typing message is dropped at the decrypt layer — never reaches `TypingService.onTypingReceived`, so no indicator is rendered.

Reciprocity emerges from independent local enforcement. Same trade-off acknowledged in `dm-receipts.md`: a modified client could observe without sending. Acceptable per existing precedent.

---

## Service Layer

### New service: `TypingService`

Lives in `src/services/TypingService.ts`. Sibling to `ReceiptService`. Handles send-side throttling and receive-side state.

```typescript
type TypingScope =
  | { kind: 'dm'; address: string }
  | { kind: 'space-channel'; spaceId: string; channelId: string }
  | { kind: 'thread'; spaceId: string; channelId: string; threadId: string };

class TypingService {
  // SEND SIDE
  notifyTyping(scope: TypingScope): void;       // called on every keystroke; throttled internally
  notifyStopped(scope: TypingScope): void;       // called on send / blur / conversation close

  // RECEIVE SIDE
  onTypingReceived(msg: TypingMessage): void;    // called from MessageService

  // SUBSCRIPTION (for UI)
  subscribe(scope: TypingScope, listener: (typists: string[]) => void): () => void;

  destroy(): void;
}
```

Internal state:

- `Map<scopeKey, Map<senderAddress, { expiresAt: number; timeoutId: ReturnType<typeof setTimeout> }>>` — active typists per scope.
- `Map<scopeKey, number>` — last `typing-start` send time (for sender-side throttle).
- `Map<scopeKey, Set<listener>>` — subscribers per scope.

Constructor takes callbacks for actually sending out via the appropriate transport:

```typescript
interface TypingServiceOptions {
  sendDM: (address: string, msg: TypingMessage) => Promise<void>;
  sendSpace: (spaceId: string, msg: TypingMessage) => Promise<void>;
  isEnabledForScope: (scope: TypingScope) => boolean; // checks the right global toggle
}
```

Wired in `MessageDB.tsx` alongside `ReceiptService`.

### Two new hooks

**`useTypingNotifier(scope: TypingScope | null)`** — used inside `MessageComposer.tsx`. Watches composer input via existing `onChange` and calls `notifyTyping(scope)` / `notifyStopped(scope)` at the right moments. No-op when `scope` is `null` (e.g. before the conversation is loaded). Returns nothing.

**`useTypingIndicator(scope: TypingScope | null)`** — used by `TypingIndicator`. Subscribes to typists for the current scope. Returns `string[]` (typist addresses), empty when scope is null.

### Lifecycle

- On conversation/channel unmount: hook fires `notifyStopped` if user was actively typing.
- On WebSocket disconnect: clear all outgoing throttle state.
- On `visibilitychange` to hidden: send `typing-stop` for all active scopes (same listener pattern as `ReceiptService.setupVisibilityListener`).
- On `TypingService.destroy()`: clear all timers, clear all maps, remove listeners.

---

## UI Components

### New component: `TypingIndicator`

Location: `src/components/message/TypingIndicator.tsx` (with `.native.tsx` sibling stub for future mobile work). Lives in `message/` because the same component renders for DMs, space channels, and threads.

Props:

```typescript
type TypingIndicatorProps = {
  scope: TypingScope | null;
};
```

Calls `useTypingIndicator(scope)` and renders a **fixed-height row** (~20px tall) that always reserves its vertical space. The composer never shifts when typing starts or stops.

```tsx
<div className="h-5 px-3 text-xs text-muted" role="status" aria-live="polite" aria-atomic="true">
  {typists.length > 0 && (
    <span>
      {renderTypingText(typists, displayNameResolver)}
      <DotsAnimation />
    </span>
  )}
</div>
```

**Text rules** (resolved via existing display-name lookup — space members for spaces, DM contact for DMs):

| Typists | Text |
|---------|------|
| 1 | `{name} is typing…` |
| 2 | `{name1} and {name2} are typing…` |
| 3 | `{name1}, {name2} and {name3} are typing…` |
| 4+ | `Several people are typing…` |

**Visual style:** uses existing typography tokens (`text-muted`, `text-xs`), with three CSS-animated dots (keyframe-based, no JS animation). No emoji per the standing UI rule.

**i18n:** all strings via Lingui macros. Plural form uses Lingui's plural helper. Italian accented characters (è, ò, ù) verified in translations.

**Accessibility:** `role="status"` and `aria-live="polite"` so screen readers announce typing without interrupting. `aria-atomic="true"` so the full message re-announces on change.

### Integration points

Three places add `<TypingIndicator scope={...} />` directly above `<MessageComposer>`:

- `src/components/direct/DirectMessage.tsx` — scope: `{ kind: 'dm', address }`
- `src/components/space/Channel.tsx` — scope: `{ kind: 'space-channel', spaceId, channelId }`
- `src/components/thread/ThreadPanel.tsx` — scope: `{ kind: 'thread', spaceId, channelId, threadId }`

In `MessageComposer.tsx`, add `useTypingNotifier(scope)` near the top. The `scope` prop is computed and passed by the parent.

### Settings UI

Location: `src/components/modals/UserSettingsModal/Privacy.tsx`, in a new section below the existing Receipts section.

Two **independent** global toggles (not nested — DM and space toggles are conceptually parallel):

```
Typing indicators
─────────────────────────────────────
[ ] Send typing indicators in DMs
     When ON, your DM contacts see when you're composing a message.
     They can see when you start and stop typing. Default OFF.

[ ] Send typing indicators in spaces
     When ON, everyone subscribed to a space channel sees when you're
     composing a message in that channel — this can be many people in
     large spaces. Default OFF.
```

Two `<Switch>` components, both default OFF, persisted via existing `useUserSettings` + UserConfig sync.

New UserConfig fields:

```typescript
typingIndicatorsDM: boolean;     // default false
typingIndicatorsSpaces: boolean; // default false
```

---

## Edge Cases

| Case | Behavior |
|---|---|
| Multiple devices, same user | Receiver de-duplicates by `senderId`. One indicator per person regardless of device count. |
| Sender goes offline mid-typing | No `typing-stop` reaches recipients. Their indicators expire naturally via the 8s TTL. |
| Mixnet packet reordering | Receiver discards typing messages with `timestamp` older than current entry for that sender. TTL self-corrects within 8s if a stop is dropped. |
| User toggles setting OFF while actively typing | Throttle state cleared. Explicit `typing-stop` sent to all active scopes to clear others' indicators immediately. |
| User toggles setting OFF while watching others type | In-memory typists map cleared. UI updates. Any in-flight typing messages are dropped at the receive gate. |
| Read-only channels | `useTypingNotifier` checks `message:send` permission before calling service. No signal sent. |
| Muted spaces / muted DMs | Typing is still sent and still received/shown. Mute affects notifications, not presence. |
| Composer with restored draft on mount | No `typing-start` on mount. Only real `onChange` events after mount count. |
| Whitespace-only content | Typing is sent based on keystrokes, not content. Matches Telegram/Discord. |
| App backgrounded mid-typing | `visibilitychange` listener fires `notifyStopped` for all active scopes. |

---

## Testing Strategy

### Unit tests (TypingService)

- Throttle: rapid `notifyTyping` calls emit at most one `typing-start` per 5s window per scope.
- TTL: a received `typing-start` expires after 8s without renewal.
- `typing-stop` immediately removes the entry.
- Subscribe/unsubscribe correctly registers and cleans up listeners.
- Send-side privacy gate: with global setting OFF, `notifyTyping` is a no-op.
- Receive-side privacy gate: with global setting OFF, `onTypingReceived` does not update state.
- Reorder protection: a `typing-start` with older `timestamp` than current state is ignored.

### Integration tests

- Typing in MessageComposer triggers exactly one outbound encrypt+send within 5s of first keystroke.
- Incoming `type: 'typing-start'` is intercepted in `processDeliveryReceiptData` and never reaches `saveMessage`.
- Settings toggle OFF clears active outgoing throttles and active received indicators.

### Manual QA scenarios

- DM: two browser windows, two accounts, typing in one shows indicator in the other within ~2s (mixnet latency).
- Space: 3+ accounts, verify rollup at 4 typists ("Several people are typing…").
- Thread: typing in a thread does NOT show in the parent channel for other viewers.
- Toggle OFF mid-conversation: indicators on both sides disappear within ~2s.
- Network drop: pull WiFi mid-typing, verify other side's indicator expires within 8s.
- Read-only channel: typing in a channel where you lack `message:send` sends no signal.
- Cross-platform: desktop sender → mobile receiver (when mobile catches up).

---

## Backwards Compatibility

- **Old clients receiving new typing messages**: they go through `saveMessage`. The existing handling for unrecognized control-message types in `processDeliveryReceiptData` must be verified during implementation. If old clients would store unknown types as junk rows, add a defensive no-op fallback that ignores any message with `type` starting with `typing-`.
- **New clients receiving from old clients**: nothing to handle — old clients simply do not send typing.
- **UserConfig schema**: two new boolean fields, both default `false`. Existing config migration pattern (defaults applied on load when field is absent) handles this without an explicit migration step.

---

## Files Touched

### New files

- `src/services/TypingService.ts` — service class (~250 lines)
- `src/services/TypingService.test.ts` — unit tests
- `src/types/typing.ts` — `TypingMessage` and `TypingScope` types
- `src/hooks/business/messages/useTypingNotifier.ts` — composer-side hook
- `src/hooks/business/messages/useTypingIndicator.ts` — display-side hook
- `src/components/message/TypingIndicator.tsx` — UI component (web)
- `src/components/message/TypingIndicator.native.tsx` — stub for mobile parity
- `src/components/message/TypingIndicator.scss` — dot animation, layout

### Modified files

- `src/services/MessageService.ts` — extend `processDeliveryReceiptData` (or add sibling method) to intercept `type === 'typing-start'` / `'typing-stop'` and call `typingService.onTypingReceived`. Wire `typingService` dependency.
- `src/components/context/MessageDB.tsx` — instantiate `TypingService`, pass to MessageService. Add `typingIndicatorsDM` / `typingIndicatorsSpaces` to user config defaults.
- `src/components/message/MessageComposer.tsx` — accept `scope` prop, call `useTypingNotifier(scope)`.
- `src/components/direct/DirectMessage.tsx` — render `<TypingIndicator scope={dmScope}/>` above composer; pass `dmScope` to composer.
- `src/components/space/Channel.tsx` — render `<TypingIndicator scope={channelScope}/>` above composer; pass `channelScope` to composer.
- `src/components/thread/ThreadPanel.tsx` — render `<TypingIndicator scope={threadScope}/>` above composer; pass `threadScope` to composer.
- `src/components/modals/UserSettingsModal/Privacy.tsx` — add Typing indicators section with two toggles.
- `src/hooks/business/user/useUserSettings.ts` — add `typingIndicatorsDM` and `typingIndicatorsSpaces` state + persistence.
- `src/db/messages.ts` — add the two boolean fields to UserConfig type.
- i18n message catalogs — add typing-indicator strings (one per language file under `src/i18n/`).

---

## Deferred to Follow-up

- Per-conversation typing override (Conversation Settings).
- Per-space typing override (Space Settings).
- Mobile implementation in `quorum-mobile` (the `.native.tsx` stub keeps the cross-platform contract intact, but mobile keystroke wiring is its own task).
- Custom status / presence — see `.agents/tasks/.todo/2025-01-20-user-status.md`.

---

*Last updated: 2026-05-18 — initial design spec.*
