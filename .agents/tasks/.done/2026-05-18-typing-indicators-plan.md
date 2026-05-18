---
type: task
title: "Typing Indicators — Implementation Plan"
status: ready
created: 2026-05-18
updated: 2026-05-18
related_docs:
  - .agents/tasks/2026-05-18-typing-indicators-design.md
  - .agents/docs/features/messages/dm-receipts.md
---

# Typing Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build live "X is typing…" indicators for DMs, space channels, and threads, using ephemeral control messages on the existing encrypted transport — opt-in per the Quorum privacy rule.

**Architecture:** New `TypingService` (sibling to `ReceiptService`) handles send-side throttling and receive-side state. Wire-level `TypingMessage` control type is intercepted in `MessageService` before `saveMessage`, mirroring the receipts pattern. Two new hooks (`useTypingNotifier`, `useTypingIndicator`) drive composer wiring and UI subscription. `TypingIndicator` component renders in a fixed-height row above the composer. Two independent global toggles in Settings > Privacy, both default OFF.

**Tech Stack:** TypeScript, React, vitest + fake timers, Lingui (i18n via `t\`\``), Tailwind utility classes, existing shared primitives. Path alias `@/` resolves to `src/`.

**Reference spec:** [.agents/tasks/2026-05-18-typing-indicators-design.md](2026-05-18-typing-indicators-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/types/typing.ts` | `TypingMessage` wire type + `TypingScope` discriminated union + `scopeKey()` helper |
| `src/services/TypingService.ts` | Send throttling, receive-side state map, subscription bus, privacy gate |
| `src/dev/tests/services/TypingService.unit.test.ts` | Unit tests for TypingService |
| `src/hooks/business/messages/useTypingNotifier.ts` | Composer-side hook — fires notifyTyping on keystroke |
| `src/hooks/business/messages/useTypingIndicator.ts` | Display-side hook — subscribes for current scope |
| `src/components/message/TypingIndicator.tsx` | Fixed-height row component (web) |
| `src/components/message/TypingIndicator.native.tsx` | Stub for cross-platform parity |
| `src/components/message/TypingIndicator.scss` | Dot animation keyframes |

### Modified files

| Path | Change |
|---|---|
| `src/db/messages.ts` | Add `typingIndicatorsDM?` and `typingIndicatorsSpaces?` to `UserConfig` interface |
| `src/hooks/business/user/useUserSettings.ts` | New state + load/save for two typing toggles |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | New "Typing indicators" section with two `<Switch>` controls |
| `src/components/modals/UserSettingsModal/UserSettingsModal.tsx` | Pass new props through to Privacy tab |
| `src/services/MessageService.ts` | Inject `TypingService`, intercept `typing-start`/`typing-stop` in `processDeliveryReceiptData` (extend or sibling method) |
| `src/components/context/MessageDB.tsx` | Instantiate `TypingService`, wire send callbacks, expose via context |
| `src/components/message/MessageComposer.tsx` | Accept `typingScope?` prop, call `useTypingNotifier(scope)` |
| `src/components/direct/DirectMessage.tsx` | Render `<TypingIndicator scope={dmScope}/>` above composer; pass scope to composer |
| `src/components/space/Channel.tsx` | Render `<TypingIndicator scope={channelScope}/>` above composer; pass scope to composer |
| `src/components/thread/ThreadPanel.tsx` | Render `<TypingIndicator scope={threadScope}/>` above composer; pass scope to composer |

### Convention reminders

- **Test command:** `yarn test` (vitest). Run with `-t "name"` filter to scope.
- **Type-check:** `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
- **Lint:** `yarn lint`
- **Tests live at:** `src/dev/tests/services/*.unit.test.ts` (NOT adjacent to source)
- **Path alias:** `@/services/X` resolves to `src/services/X`
- **i18n:** `import { t } from '@lingui/macro'` and use `t\`string\``
- **Primitives:** import from `'../../primitives'` (or relative path appropriate to file location)
- **No emoji in production UI** per standing rule
- **No em-dashes in user-facing copy** per standing rule (settings copy must use commas/periods)

---

## Task 1: Define wire types and scope helper

**Files:**
- Create: `src/types/typing.ts`

- [ ] **Step 1: Write the type definitions**

Create `src/types/typing.ts`:

```typescript
/**
 * Typing indicator wire types and scope helpers.
 *
 * TypingMessage is an ephemeral control message that rides the existing
 * encrypted transport (Double Ratchet for DMs, Triple Ratchet hub broadcast
 * for spaces). Intercepted in MessageService before saveMessage — never
 * written to IndexedDB, never added to the sync manifest.
 */

export type TypingMessageType = 'typing-start' | 'typing-stop';

/** Wire format. Mirrors the flat shape of delivery-ack / read-ack control messages. */
export interface TypingMessage {
  type: TypingMessageType;
  senderId: string;
  scope: 'dm' | 'space';
  spaceId?: string;
  channelId?: string;
  threadId?: string;
  timestamp: number;
}

/** Discriminated union for callers. Keeps the rendering side honest about which fields apply. */
export type TypingScope =
  | { kind: 'dm'; address: string }
  | { kind: 'space-channel'; spaceId: string; channelId: string }
  | { kind: 'thread'; spaceId: string; channelId: string; threadId: string };

/** Stable string key per scope, used as a Map key. */
export function scopeKey(scope: TypingScope): string {
  switch (scope.kind) {
    case 'dm':
      return `dm:${scope.address}`;
    case 'space-channel':
      return `sc:${scope.spaceId}:${scope.channelId}`;
    case 'thread':
      return `th:${scope.spaceId}:${scope.channelId}:${scope.threadId}`;
  }
}

/** Convenience: derive a TypingScope from an incoming TypingMessage's fields. */
export function scopeFromMessage(msg: TypingMessage): TypingScope | null {
  if (msg.scope === 'dm') {
    return { kind: 'dm', address: msg.senderId };
  }
  if (msg.scope === 'space' && msg.spaceId && msg.channelId) {
    if (msg.threadId) {
      return { kind: 'thread', spaceId: msg.spaceId, channelId: msg.channelId, threadId: msg.threadId };
    }
    return { kind: 'space-channel', spaceId: msg.spaceId, channelId: msg.channelId };
  }
  return null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/typing.ts
git commit -m "feat(typing): add wire types and scope helpers"
```

---

## Task 2: TypingService — skeleton + send-side throttle

**Files:**
- Create: `src/services/TypingService.ts`
- Create: `src/dev/tests/services/TypingService.unit.test.ts`

- [ ] **Step 1: Write failing tests for send-side throttle**

Create `src/dev/tests/services/TypingService.unit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TypingService } from '@/services/TypingService';
import type { TypingScope } from '@/types/typing';

describe('TypingService — send-side throttle', () => {
  let service: TypingService;
  let sendDM: ReturnType<typeof vi.fn>;
  let sendSpace: ReturnType<typeof vi.fn>;
  let isEnabledForScope: ReturnType<typeof vi.fn>;

  const dmScope: TypingScope = { kind: 'dm', address: 'alice' };
  const channelScope: TypingScope = { kind: 'space-channel', spaceId: 'sp1', channelId: 'ch1' };

  beforeEach(() => {
    vi.useFakeTimers();
    sendDM = vi.fn().mockResolvedValue(undefined);
    sendSpace = vi.fn().mockResolvedValue(undefined);
    isEnabledForScope = vi.fn().mockReturnValue(true);
    service = new TypingService({
      selfAddress: 'self',
      sendDM,
      sendSpace,
      isEnabledForScope,
    });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('sends typing-start immediately on first notifyTyping', () => {
    service.notifyTyping(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(1);
    expect(sendDM).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ type: 'typing-start', scope: 'dm', senderId: 'self' }),
    );
  });

  it('throttles further notifyTyping calls within 5 seconds', () => {
    service.notifyTyping(dmScope);
    vi.advanceTimersByTime(1000);
    service.notifyTyping(dmScope);
    vi.advanceTimersByTime(3000);
    service.notifyTyping(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(1);
  });

  it('allows a new typing-start after 5 seconds', () => {
    service.notifyTyping(dmScope);
    vi.advanceTimersByTime(5001);
    service.notifyTyping(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(2);
  });

  it('throttles independently per scope', () => {
    service.notifyTyping(dmScope);
    service.notifyTyping(channelScope);
    expect(sendDM).toHaveBeenCalledTimes(1);
    expect(sendSpace).toHaveBeenCalledTimes(1);
  });

  it('routes space-channel scope through sendSpace', () => {
    service.notifyTyping(channelScope);
    expect(sendSpace).toHaveBeenCalledWith(
      'sp1',
      expect.objectContaining({ type: 'typing-start', scope: 'space', spaceId: 'sp1', channelId: 'ch1' }),
    );
  });

  it('includes threadId for thread scope', () => {
    const threadScope: TypingScope = { kind: 'thread', spaceId: 'sp1', channelId: 'ch1', threadId: 'th1' };
    service.notifyTyping(threadScope);
    expect(sendSpace).toHaveBeenCalledWith(
      'sp1',
      expect.objectContaining({ scope: 'space', spaceId: 'sp1', channelId: 'ch1', threadId: 'th1' }),
    );
  });

  it('does nothing when isEnabledForScope returns false (privacy gate)', () => {
    isEnabledForScope.mockReturnValue(false);
    service.notifyTyping(dmScope);
    expect(sendDM).not.toHaveBeenCalled();
  });

  it('notifyStopped sends typing-stop and resets throttle', () => {
    service.notifyTyping(dmScope);
    service.notifyStopped(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(2);
    expect(sendDM).toHaveBeenNthCalledWith(2, 'alice', expect.objectContaining({ type: 'typing-stop' }));
    service.notifyTyping(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(3);
  });

  it('notifyStopped is a no-op if no typing-start was sent for this scope', () => {
    service.notifyStopped(dmScope);
    expect(sendDM).not.toHaveBeenCalled();
  });

  it('notifyStopped respects privacy gate', () => {
    service.notifyTyping(dmScope);
    isEnabledForScope.mockReturnValue(false);
    service.notifyStopped(dmScope);
    expect(sendDM).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test TypingService.unit -t "send-side throttle"`
Expected: FAIL with "Cannot find module '@/services/TypingService'".

- [ ] **Step 3: Implement the skeleton + send-side logic**

Create `src/services/TypingService.ts`:

```typescript
/**
 * TypingService
 *
 * Manages typing-indicator signaling for DMs, space channels, and threads.
 *
 * Send side: throttled to one typing-start per 5 seconds per scope.
 * Explicit typing-stop sent on send/blur/conversation-close. Privacy
 * gated — if the relevant user setting is OFF, all sends are no-ops.
 *
 * Receive side: maintains an in-memory map of who is currently typing
 * per scope, with an 8-second TTL per typist. Subscribers are notified
 * when the typist set changes. Privacy gated — incoming messages are
 * dropped when the relevant setting is OFF.
 *
 * No persistence. Nothing ever touches IndexedDB or the sync manifest.
 */

import { logger } from '@quilibrium/quorum-shared';
import {
  type TypingMessage,
  type TypingScope,
  scopeKey,
  scopeFromMessage,
} from '@/types/typing';

const TYPING_THROTTLE_MS = 5_000;
const TYPING_TTL_MS = 8_000;

export interface TypingServiceOptions {
  /** Caller's own address, stamped onto outgoing TypingMessage.senderId */
  selfAddress: string;
  /** Sender callback for DM scope. Implements actual encryption + transport. */
  sendDM: (address: string, msg: TypingMessage) => Promise<void>;
  /** Sender callback for space scope (both space-channel and thread). */
  sendSpace: (spaceId: string, msg: TypingMessage) => Promise<void>;
  /** Privacy gate. Returns true if typing is enabled for this scope. */
  isEnabledForScope: (scope: TypingScope) => boolean;
}

type TypistEntry = {
  expiresAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

type Listener = (typists: string[]) => void;

export class TypingService {
  private options: TypingServiceOptions;

  // Send-side state: last typing-start emit time per scope (for throttle)
  private lastSentAt = new Map<string, number>();
  // Send-side: which scopes have an active outbound typing session (used for notifyStopped)
  private activeOutbound = new Set<string>();

  // Receive-side state: typists per scope
  private typists = new Map<string, Map<string, TypistEntry>>();
  // Receive-side state: subscribers per scope
  private listeners = new Map<string, Set<Listener>>();

  constructor(options: TypingServiceOptions) {
    this.options = options;
  }

  // ============================================================
  // SEND SIDE
  // ============================================================

  notifyTyping(scope: TypingScope): void {
    if (!this.options.isEnabledForScope(scope)) return;

    const key = scopeKey(scope);
    const now = Date.now();
    const last = this.lastSentAt.get(key) ?? 0;
    if (now - last < TYPING_THROTTLE_MS) return;

    this.lastSentAt.set(key, now);
    this.activeOutbound.add(key);
    this.emit(scope, 'typing-start');
  }

  notifyStopped(scope: TypingScope): void {
    const key = scopeKey(scope);
    if (!this.activeOutbound.has(key)) return;
    this.activeOutbound.delete(key);
    this.lastSentAt.delete(key);
    if (!this.options.isEnabledForScope(scope)) return;
    this.emit(scope, 'typing-stop');
  }

  private emit(scope: TypingScope, type: 'typing-start' | 'typing-stop'): void {
    const msg: TypingMessage = {
      type,
      senderId: this.options.selfAddress,
      scope: scope.kind === 'dm' ? 'dm' : 'space',
      timestamp: Date.now(),
    };
    if (scope.kind === 'space-channel' || scope.kind === 'thread') {
      msg.spaceId = scope.spaceId;
      msg.channelId = scope.channelId;
    }
    if (scope.kind === 'thread') {
      msg.threadId = scope.threadId;
    }

    if (scope.kind === 'dm') {
      this.options.sendDM(scope.address, msg).catch((err) => {
        logger.warn('[Typing] sendDM failed', err);
      });
    } else {
      this.options.sendSpace(scope.spaceId, msg).catch((err) => {
        logger.warn('[Typing] sendSpace failed', err);
      });
    }
  }

  // ============================================================
  // RECEIVE SIDE (stubs — filled in Task 3)
  // ============================================================

  onTypingReceived(_msg: TypingMessage): void {
    // Implemented in Task 3
  }

  subscribe(_scope: TypingScope, _listener: Listener): () => void {
    // Implemented in Task 3
    return () => {};
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  destroy(): void {
    for (const entries of this.typists.values()) {
      for (const entry of entries.values()) {
        clearTimeout(entry.timeoutId);
      }
    }
    this.typists.clear();
    this.listeners.clear();
    this.lastSentAt.clear();
    this.activeOutbound.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test TypingService.unit -t "send-side throttle"`
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/TypingService.ts src/dev/tests/services/TypingService.unit.test.ts
git commit -m "feat(typing): add TypingService send-side throttle"
```

---

## Task 3: TypingService — receive-side state + subscriptions

**Files:**
- Modify: `src/services/TypingService.ts`
- Modify: `src/dev/tests/services/TypingService.unit.test.ts`

- [ ] **Step 1: Write failing tests for receive-side state**

Append to `src/dev/tests/services/TypingService.unit.test.ts`:

```typescript
describe('TypingService — receive-side state', () => {
  let service: TypingService;
  let isEnabledForScope: ReturnType<typeof vi.fn>;
  const dmScope: TypingScope = { kind: 'dm', address: 'alice' };

  beforeEach(() => {
    vi.useFakeTimers();
    isEnabledForScope = vi.fn().mockReturnValue(true);
    service = new TypingService({
      selfAddress: 'self',
      sendDM: vi.fn().mockResolvedValue(undefined),
      sendSpace: vi.fn().mockResolvedValue(undefined),
      isEnabledForScope,
    });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  it('records a typist on typing-start and notifies subscribers', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    expect(listener).toHaveBeenLastCalledWith(['alice']);
  });

  it('expires a typist after 8 seconds', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    vi.advanceTimersByTime(8001);
    expect(listener).toHaveBeenLastCalledWith([]);
  });

  it('renewing typing-start extends the TTL', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    vi.advanceTimersByTime(5000);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 2000,
    });
    vi.advanceTimersByTime(5000);
    expect(listener).toHaveBeenLastCalledWith(['alice']);
    vi.advanceTimersByTime(4000);
    expect(listener).toHaveBeenLastCalledWith([]);
  });

  it('typing-stop removes the typist immediately', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    service.onTypingReceived({
      type: 'typing-stop',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1500,
    });
    expect(listener).toHaveBeenLastCalledWith([]);
  });

  it('ignores a typing-start with timestamp older than the current entry (reorder protection)', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 2000,
    });
    service.onTypingReceived({
      type: 'typing-stop',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000, // older
    });
    expect(listener).toHaveBeenLastCalledWith(['alice']);
  });

  it('ignores typing messages from self (defense in depth)', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'self',
      scope: 'dm',
      timestamp: 1000,
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('drops incoming typing when privacy gate is OFF', () => {
    isEnabledForScope.mockReturnValue(false);
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsub = service.subscribe(dmScope, listener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'dm',
      timestamp: 1000,
    });
    listener.mockClear();
    unsub();
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'bob',
      scope: 'dm',
      timestamp: 2000,
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple typists in same scope', () => {
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    service.onTypingReceived({ type: 'typing-start', senderId: 'alice', scope: 'dm', timestamp: 1000 });
    service.onTypingReceived({ type: 'typing-start', senderId: 'bob', scope: 'dm', timestamp: 1100 });
    expect(listener).toHaveBeenLastCalledWith(expect.arrayContaining(['alice', 'bob']));
    expect(listener.mock.lastCall![0]).toHaveLength(2);
  });

  it('scopes are isolated', () => {
    const channelScope: TypingScope = { kind: 'space-channel', spaceId: 'sp1', channelId: 'ch1' };
    const dmListener = vi.fn();
    const channelListener = vi.fn();
    service.subscribe(dmScope, dmListener);
    service.subscribe(channelScope, channelListener);
    service.onTypingReceived({
      type: 'typing-start',
      senderId: 'alice',
      scope: 'space',
      spaceId: 'sp1',
      channelId: 'ch1',
      timestamp: 1000,
    });
    expect(dmListener).not.toHaveBeenCalled();
    expect(channelListener).toHaveBeenLastCalledWith(['alice']);
  });

  it('subscribe immediately emits current typists if any', () => {
    service.onTypingReceived({ type: 'typing-start', senderId: 'alice', scope: 'dm', timestamp: 1000 });
    const listener = vi.fn();
    service.subscribe(dmScope, listener);
    expect(listener).toHaveBeenCalledWith(['alice']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test TypingService.unit -t "receive-side state"`
Expected: FAIL (the stubbed methods don't do anything yet).

- [ ] **Step 3: Implement the receive-side logic**

Replace the two stub methods in `src/services/TypingService.ts` (the section labeled `RECEIVE SIDE`) with:

```typescript
  // ============================================================
  // RECEIVE SIDE
  // ============================================================

  /**
   * Process an incoming TypingMessage from the decrypt layer.
   * MessageService MUST gate this call by the user's typing setting AND
   * call back here so this method does the routing. We additionally
   * re-check the gate here as defense in depth.
   */
  onTypingReceived(msg: TypingMessage): void {
    // Defense in depth: drop self-originated messages
    if (msg.senderId === this.options.selfAddress) return;

    const scope = scopeFromMessage(msg);
    if (!scope) return;

    if (!this.options.isEnabledForScope(scope)) return;

    const key = scopeKey(scope);
    let entries = this.typists.get(key);
    if (!entries) {
      entries = new Map();
      this.typists.set(key, entries);
    }

    const existing = entries.get(msg.senderId);

    // Reorder protection: ignore messages older than what we already have
    if (existing && msg.timestamp <= existing.expiresAt - TYPING_TTL_MS) return;

    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    if (msg.type === 'typing-stop') {
      entries.delete(msg.senderId);
      this.notifyListeners(key);
      return;
    }

    const expiresAt = Date.now() + TYPING_TTL_MS;
    const timeoutId = setTimeout(() => {
      const fresh = this.typists.get(key);
      if (fresh) {
        fresh.delete(msg.senderId);
        this.notifyListeners(key);
      }
    }, TYPING_TTL_MS);

    entries.set(msg.senderId, { expiresAt, timeoutId });
    this.notifyListeners(key);
  }

  subscribe(scope: TypingScope, listener: Listener): () => void {
    const key = scopeKey(scope);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);

    // Emit current state immediately if any typists exist
    const entries = this.typists.get(key);
    if (entries && entries.size > 0) {
      listener(Array.from(entries.keys()));
    }

    return () => {
      const s = this.listeners.get(key);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) this.listeners.delete(key);
    };
  }

  private notifyListeners(key: string): void {
    const listeners = this.listeners.get(key);
    if (!listeners || listeners.size === 0) return;
    const entries = this.typists.get(key);
    const typists = entries ? Array.from(entries.keys()) : [];
    for (const listener of listeners) {
      listener(typists);
    }
  }
```

Note: the reorder-protection comparison uses `expiresAt - TYPING_TTL_MS` as the equivalent of the stored "creation timestamp" — adequate for our use. If a `typing-stop` arrives with `msg.timestamp` strictly less than the existing entry's creation time, we drop it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test TypingService.unit`
Expected: all tests PASS (send-side + receive-side).

- [ ] **Step 5: Commit**

```bash
git add src/services/TypingService.ts src/dev/tests/services/TypingService.unit.test.ts
git commit -m "feat(typing): add TypingService receive-side state and subscriptions"
```

---

## Task 4: Add typing settings to UserConfig + hook

**Files:**
- Modify: `src/db/messages.ts`
- Modify: `src/hooks/business/user/useUserSettings.ts`

- [ ] **Step 1: Add fields to UserConfig**

Find the `UserConfig` interface in `src/db/messages.ts` (around line 92, where `deliveryReceipts?: boolean` is defined). Add two new optional fields directly below `readReceipts?`:

```typescript
  deliveryReceipts?: boolean;
  readReceipts?: boolean;
  typingIndicatorsDM?: boolean;
  typingIndicatorsSpaces?: boolean;
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Extend useUserSettings hook**

In `src/hooks/business/user/useUserSettings.ts`:

(a) In the props interface (around line 27 where `deliveryReceipts: boolean` is declared), add:

```typescript
  typingIndicatorsDM: boolean;
  setTypingIndicatorsDM: (value: boolean) => void;
  typingIndicatorsSpaces: boolean;
  setTypingIndicatorsSpaces: (value: boolean) => void;
```

(b) In the state declarations (around line 61 where `useState(false)` is called for receipts), add:

```typescript
  const [typingIndicatorsDM, setTypingIndicatorsDM] = useState(false);
  const [typingIndicatorsSpaces, setTypingIndicatorsSpaces] = useState(false);
```

(c) In the config-loading effect (around line 99-100 where `setDeliveryReceipts(config?.deliveryReceipts ?? false)` is called), add:

```typescript
  setTypingIndicatorsDM(config?.typingIndicatorsDM ?? false);
  setTypingIndicatorsSpaces(config?.typingIndicatorsSpaces ?? false);
```

(d) In the save-config payload (around line 296-297 where `deliveryReceipts,` and `readReceipts,` appear inside the config object), add:

```typescript
  typingIndicatorsDM,
  typingIndicatorsSpaces,
```

(e) In the return object (around line 354-356), add:

```typescript
  typingIndicatorsDM,
  setTypingIndicatorsDM,
  typingIndicatorsSpaces,
  setTypingIndicatorsSpaces,
```

- [ ] **Step 4: Run type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/messages.ts src/hooks/business/user/useUserSettings.ts
git commit -m "feat(typing): add typing toggles to UserConfig and useUserSettings"
```

---

## Task 5: Add typing settings UI to Privacy modal

**Files:**
- Modify: `src/components/modals/UserSettingsModal/Privacy.tsx`
- Modify: `src/components/modals/UserSettingsModal/UserSettingsModal.tsx`

- [ ] **Step 1: Extend Privacy.tsx props**

Open `src/components/modals/UserSettingsModal/Privacy.tsx`. Find the props interface (around line 28 where `deliveryReceipts: boolean` is declared). Add:

```typescript
  typingIndicatorsDM: boolean;
  setTypingIndicatorsDM: (value: boolean) => void;
  typingIndicatorsSpaces: boolean;
  setTypingIndicatorsSpaces: (value: boolean) => void;
```

In the destructured props (around line 52-54 where `deliveryReceipts,` and `readReceipts,` are extracted), add:

```typescript
  typingIndicatorsDM,
  setTypingIndicatorsDM,
  typingIndicatorsSpaces,
  setTypingIndicatorsSpaces,
```

- [ ] **Step 2: Add the Typing Indicators section**

Find the existing read receipts section (the block ending around line 290 with `<Switch value={readReceipts} ...>`). Directly after that section's closing `</div>` (and after its enclosing conditional `{deliveryReceipts && ( ... )}`), insert this new section. Match the spacing and structure of the surrounding receipt sections:

```tsx
        <Spacer size="md" />

        <div className="text-subtitle">{t`Typing indicators`}</div>
        <div className="text-paragraph">
          {t`Share when you're composing a message. Both toggles are independent and default OFF.`}
        </div>

        <div className="flex flex-row items-center gap-3 mt-3">
          <Switch
            value={typingIndicatorsDM}
            onChange={setTypingIndicatorsDM}
            disabled={!isConfigLoaded}
          />
          <div>
            <div className="text-base">{t`Send typing indicators in DMs`}</div>
            <div className="text-paragraph text-muted">
              {t`When ON, your DM contacts see when you're composing a message. They can see when you start and stop typing. Default OFF.`}
            </div>
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 mt-3">
          <Switch
            value={typingIndicatorsSpaces}
            onChange={setTypingIndicatorsSpaces}
            disabled={!isConfigLoaded}
          />
          <div>
            <div className="text-base">{t`Send typing indicators in spaces`}</div>
            <div className="text-paragraph text-muted">
              {t`When ON, everyone subscribed to a space channel sees when you're composing a message in that channel. This can be many people in large spaces. Default OFF.`}
            </div>
          </div>
        </div>
```

Note: classnames (`text-subtitle`, `text-paragraph`, `text-muted`, `text-base`, `flex flex-row items-center gap-3 mt-3`) match the existing receipt section. Do not invent new classes. The exact classes used in the surrounding sections should be your reference — if the file uses slightly different ones (e.g. `text-sm` instead of `text-base`), match those.

Also: NO em-dashes in the copy. Verify by scanning the four `t\`\`` strings — they should contain only periods, commas, and apostrophes.

- [ ] **Step 3: Pass new props from UserSettingsModal.tsx**

In `src/components/modals/UserSettingsModal/UserSettingsModal.tsx`, find where `<Privacy ... />` is rendered and where `deliveryReceipts={deliveryReceipts}` is passed. Add immediately below it:

```tsx
typingIndicatorsDM={typingIndicatorsDM}
setTypingIndicatorsDM={setTypingIndicatorsDM}
typingIndicatorsSpaces={typingIndicatorsSpaces}
setTypingIndicatorsSpaces={setTypingIndicatorsSpaces}
```

Also pull these four values from the `useUserSettings()` destructure higher in the file — find where `deliveryReceipts, setDeliveryReceipts` is destructured and add the four typing fields next to it.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Expected: no errors. (Lingui macro extraction warnings about new strings are acceptable — those will be picked up by the i18n pipeline.)

- [ ] **Step 5: Manual smoke test**

Run: `yarn dev`
Open Settings > Privacy. Verify:
- Two new toggles appear, both OFF by default
- Toggling them does not error
- Closing and reopening Settings preserves the toggle state

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/UserSettingsModal/Privacy.tsx src/components/modals/UserSettingsModal/UserSettingsModal.tsx
git commit -m "feat(typing): add Typing indicators section to Privacy settings"
```

---

## Task 6: Wire TypingService in MessageDB context

**Files:**
- Modify: `src/components/context/MessageDB.tsx`

This task instantiates `TypingService`, wires its send callbacks to the existing DM and space transports, and exposes the service via the MessageDB context for hooks to consume.

- [ ] **Step 1: Identify the existing wiring pattern for ReceiptService**

Open `src/components/context/MessageDB.tsx` and search for `new ReceiptService(`. Note:
- where the service is instantiated
- what callbacks are passed (`onFlush`, `onAckProcessed`, etc.)
- where those callbacks invoke encryption + send paths
- where `messageService.setReceiptService(...)` is called

Your wiring will mirror this exactly, except simpler (no piggyback, no IndexedDB updates).

- [ ] **Step 2: Add the TypingService import**

Near the existing imports of `ReceiptService`, add:

```typescript
import { TypingService } from '@/services/TypingService';
import type { TypingMessage } from '@/types/typing';
```

- [ ] **Step 3: Instantiate TypingService**

Below the existing `new ReceiptService(...)` call inside the MessageDB provider, add:

```typescript
const typingService = useMemo(() => {
  return new TypingService({
    selfAddress: ownAddress ?? '',
    sendDM: async (address, msg) => {
      // Send a DM control message through the existing Double Ratchet path.
      // The wire shape mirrors delivery-ack: flat object with `type` at top level.
      // MessageService exposes a helper for ephemeral DM control messages — if no such
      // helper exists yet, route through the same call site that `sendDeliveryAck`
      // in ActionQueueHandlers uses, bypassing the action queue (fire-and-forget).
      await messageServiceRef.current?.sendEphemeralDMControl(address, msg);
    },
    sendSpace: async (spaceId, msg) => {
      // Encrypt + broadcast through the space hub. Same path as a normal post,
      // except we never call saveMessage on the sender side and the receiver
      // intercepts before saveMessage too.
      await messageServiceRef.current?.sendEphemeralSpaceControl(spaceId, msg);
    },
    isEnabledForScope: (scope) => {
      const cfg = userConfigRef.current;
      if (!cfg) return false;
      if (scope.kind === 'dm') return !!cfg.typingIndicatorsDM;
      return !!cfg.typingIndicatorsSpaces;
    },
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // singleton across mount lifetime; reads dynamic state via refs
```

Notes:
- `messageServiceRef` and `userConfigRef` should reuse existing refs in the file. If they don't exist, create simple `useRef` wrappers that mirror state for the relevant values (`messageService`, `userConfig`). The pattern is already used elsewhere in MessageDB.tsx for similar reasons (avoiding stale closures in long-lived callbacks).
- The `sendEphemeralDMControl` and `sendEphemeralSpaceControl` helpers don't exist yet — Task 7 adds them to MessageService. This task only sets up the wiring; if a TS error appears here it will be fixed in Task 7.

- [ ] **Step 4: Inject TypingService into MessageService**

Below the existing `messageService.setReceiptService(receiptService)` call, add:

```typescript
messageService.setTypingService(typingService);
```

The `setTypingService` method will be added in Task 7. This line may produce a TS error temporarily.

- [ ] **Step 5: Expose typingService via context**

Find the `MessageDBContext.Provider` value object. Add `typingService` to the value alongside other exposed services:

```typescript
typingService,
```

Also add `typingService: TypingService;` to the `MessageDBContextValue` interface (or whatever the local context value type is named — match the pattern for `receiptService`).

- [ ] **Step 6: Add destroy cleanup**

Find the existing cleanup `useEffect` (or `return () => {...}` from the memo) where `receiptService.destroy()` is called. Add:

```typescript
typingService.destroy();
```

If no such cleanup exists for ReceiptService, do not add one for TypingService either — match the existing pattern.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: errors about `sendEphemeralDMControl`, `sendEphemeralSpaceControl`, and `setTypingService` not existing on MessageService. These are EXPECTED and will be resolved in Task 7. No other errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/context/MessageDB.tsx
git commit -m "feat(typing): wire TypingService in MessageDB context (pending MessageService methods)"
```

---

## Task 7: MessageService — send + intercept hooks

**Files:**
- Modify: `src/services/MessageService.ts`

This task adds three things to MessageService:
1. `setTypingService(service)` setter (mirrors `setReceiptService`)
2. `sendEphemeralDMControl(address, msg)` — encrypts and sends an ephemeral DM control message via Double Ratchet, bypassing the action queue and never persisting locally
3. `sendEphemeralSpaceControl(spaceId, msg)` — encrypts and broadcasts via the space hub, never persisting locally
4. Extends `processDeliveryReceiptData` to intercept `typing-start` / `typing-stop` BEFORE `saveMessage`

- [ ] **Step 1: Add imports + field**

Near the top of `src/services/MessageService.ts`, add:

```typescript
import { TypingService } from './TypingService';
import type { TypingMessage } from '@/types/typing';
```

In the class fields section, near the existing `private receiptService: ReceiptService | null = null;`, add:

```typescript
private typingService: TypingService | null = null;
```

- [ ] **Step 2: Add the setter**

Below the existing `setReceiptService` method, add:

```typescript
/**
 * Set the TypingService for ephemeral typing-indicator signaling.
 * Call this after MessageService is created to avoid circular dependencies.
 */
setTypingService(service: TypingService): void {
  this.typingService = service;
}
```

- [ ] **Step 3: Add the DM ephemeral send method**

This must mirror the existing path used by `ActionQueueHandlers.sendDeliveryAck` but invoked synchronously rather than via the action queue. Look at how `send-delivery-ack` is implemented in `src/services/ActionQueueHandlers.ts` — it ultimately calls the same Double Ratchet encrypt + post path used for normal DMs, but does not call `saveMessage`.

Add a method to MessageService:

```typescript
/**
 * Send an ephemeral control message to a DM partner.
 * Encrypts via Double Ratchet and posts to the partner's inbox, but never
 * calls saveMessage — the message has no local persistence. Fire-and-forget:
 * errors are logged but not thrown.
 *
 * Used by: TypingService for typing-start/stop signaling.
 */
async sendEphemeralDMControl(address: string, msg: TypingMessage): Promise<void> {
  try {
    // Reuse the same encrypt + post path as the standalone delivery-ack handler.
    // The wire format is a flat object with `type` at top level (NOT nested under .content),
    // matching how delivery-ack and read-ack control messages are sent.
    await this.encryptAndSendStandaloneDMControl(address, msg);
  } catch (err) {
    logger.warn('[Typing] sendEphemeralDMControl failed', { err, address });
  }
}
```

If a method named `encryptAndSendStandaloneDMControl` doesn't exist yet, factor it out from the existing delivery-ack send code:

(a) Locate the delivery-ack send code path (search the file for `'delivery-ack'` or look at how ActionQueueHandlers' `sendDeliveryAck` calls into MessageService).
(b) Extract the encrypt-and-post portion (everything after the `{ type: 'delivery-ack', ... }` payload is built) into a private method:

```typescript
/**
 * Shared encrypt + post path for ephemeral DM control messages.
 * Used by delivery-ack, read-ack, and typing control messages.
 */
private async encryptAndSendStandaloneDMControl(
  address: string,
  payload: object,
): Promise<void> {
  // (Move existing encrypt-and-post-to-inbox logic from delivery-ack handler here.
  // The payload should be JSON-stringified, encrypted with Double Ratchet for the
  // partner's inbox, and posted via apiClient. NO saveMessage call.)
}
```

Update the delivery-ack and read-ack call sites to use this helper instead. Do NOT change their externally observable behavior — same encrypt, same post, same error handling. Just deduplicated.

- [ ] **Step 4: Add the space ephemeral send method**

Add:

```typescript
/**
 * Broadcast an ephemeral control message to a space.
 * Encrypts via Triple Ratchet and broadcasts via the space hub, but never
 * calls saveMessage. Fire-and-forget.
 *
 * Used by: TypingService for typing-start/stop signaling in space channels and threads.
 */
async sendEphemeralSpaceControl(spaceId: string, msg: TypingMessage): Promise<void> {
  try {
    // Use the same encrypt-and-broadcast path as encryptAndSendToSpace, but
    // with stripEphemeralFields=true and saveStateAfterSend=false equivalent
    // — we never save the message locally.
    await this.encryptAndSendToSpace(spaceId, msg as any, {
      stripEphemeralFields: true,
      saveStateAfterSend: false,
    });
  } catch (err) {
    logger.warn('[Typing] sendEphemeralSpaceControl failed', { err, spaceId });
  }
}
```

If `encryptAndSendToSpace` already includes `saveMessage` as part of its flow, factor that out: the `{ saveStateAfterSend: false }` option should also suppress the local-save step. If it doesn't already, add an additional option `skipLocalSave` and gate the `saveMessage` call on `!options?.skipLocalSave`. Pass `skipLocalSave: true` from `sendEphemeralSpaceControl`.

- [ ] **Step 5: Intercept typing messages in processDeliveryReceiptData**

In `src/services/MessageService.ts`, find `processDeliveryReceiptData` (around line 232). After the existing `isReadAck` block (which currently ends with `return true; // Signal: intercept this message`), insert a new interception block:

```typescript
// 1c. Intercept typing-start / typing-stop control messages — never save, never display.
// Privacy gate runs inside TypingService.onTypingReceived, but we still need to
// know whether to call it: only consume typing when the corresponding setting is ON.
const isTyping = raw.type === 'typing-start' || raw.type === 'typing-stop';
if (isTyping) {
  if (this.typingService) {
    // Determine which setting gates this: DM scope vs space scope.
    // Note: the typingService's isEnabledForScope check will also see the user's
    // setting, but checking here too means we don't even instantiate the route
    // when the user has the relevant toggle OFF.
    const scope = raw.scope as 'dm' | 'space';
    const enabled = scope === 'dm'
      ? !!(this.messageDB as any)?.userConfig?.typingIndicatorsDM
      : !!(this.messageDB as any)?.userConfig?.typingIndicatorsSpaces;
    if (enabled) {
      this.typingService.onTypingReceived(raw as TypingMessage);
    }
  }
  return true; // Signal: intercept this message — never reaches saveMessage
}
```

If `this.messageDB.userConfig` is not directly accessible from MessageService, follow the same pattern used to access `deliveryReceiptsEnabled` and `readReceiptsEnabled` (passed as parameters to `processDeliveryReceiptData`). In that case, extend the method signature:

```typescript
private processDeliveryReceiptData(
  decryptedContent: Message,
  senderAddress: string,
  selfAddress: string,
  deliveryReceiptsEnabled: boolean,
  readReceiptsEnabled: boolean,
  typingIndicatorsDMEnabled: boolean,
  typingIndicatorsSpacesEnabled: boolean,
): boolean {
```

And update all call sites of `processDeliveryReceiptData` in this file to pass the two new flags (read from the same user config source as the existing two).

- [ ] **Step 6: Type-check + run all unit tests**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors (the Task 6 errors should now be resolved).

Run: `yarn test`
Expected: all existing tests still pass. The TypingService tests from Task 2/3 still pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "feat(typing): intercept typing messages and add ephemeral send paths"
```

---

## Task 8: useTypingNotifier hook

**Files:**
- Create: `src/hooks/business/messages/useTypingNotifier.ts`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/business/messages/useTypingNotifier.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { useMessageDB } from '@/components/context/MessageDB';
import type { TypingScope } from '@/types/typing';

/**
 * Hook used inside MessageComposer to broadcast typing signals.
 *
 * - Call `notifyKeystroke()` on every onChange/input event. The hook handles
 *   throttling internally (TypingService caps to one typing-start per 5s).
 * - The hook auto-sends typing-stop on scope change, unmount, and visibility
 *   change to hidden.
 * - Pass `enabled=false` (or `scope=null`) to make the hook a no-op (e.g.
 *   for read-only channels where the user lacks message:send permission).
 */
export function useTypingNotifier(
  scope: TypingScope | null,
  enabled: boolean = true,
): { notifyKeystroke: () => void; notifyMessageSent: () => void } {
  const { typingService } = useMessageDB();
  const activeScopeRef = useRef<TypingScope | null>(null);

  const notifyKeystroke = useCallback(() => {
    if (!enabled || !scope) return;
    typingService.notifyTyping(scope);
    activeScopeRef.current = scope;
  }, [enabled, scope, typingService]);

  const notifyMessageSent = useCallback(() => {
    if (!activeScopeRef.current) return;
    typingService.notifyStopped(activeScopeRef.current);
    activeScopeRef.current = null;
  }, [typingService]);

  // Auto-stop on scope change or unmount
  useEffect(() => {
    const previous = activeScopeRef.current;
    return () => {
      if (previous) {
        typingService.notifyStopped(previous);
      }
    };
  }, [scope, typingService]);

  // Auto-stop on visibility change to hidden
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (document.visibilityState === 'hidden' && activeScopeRef.current) {
        typingService.notifyStopped(activeScopeRef.current);
        activeScopeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [typingService]);

  return { notifyKeystroke, notifyMessageSent };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/messages/useTypingNotifier.ts
git commit -m "feat(typing): add useTypingNotifier hook for composer wiring"
```

---

## Task 9: useTypingIndicator hook

**Files:**
- Create: `src/hooks/business/messages/useTypingIndicator.ts`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/business/messages/useTypingIndicator.ts`:

```typescript
import { useEffect, useState } from 'react';
import { useMessageDB } from '@/components/context/MessageDB';
import type { TypingScope } from '@/types/typing';

/**
 * Hook used by TypingIndicator to subscribe to typists for a given scope.
 * Returns the list of typist addresses currently active in that scope.
 *
 * Returns empty array when scope is null (no active conversation).
 */
export function useTypingIndicator(scope: TypingScope | null): string[] {
  const { typingService } = useMessageDB();
  const [typists, setTypists] = useState<string[]>([]);

  useEffect(() => {
    if (!scope) {
      setTypists([]);
      return;
    }
    const unsubscribe = typingService.subscribe(scope, (next) => {
      setTypists(next);
    });
    return () => {
      unsubscribe();
      setTypists([]);
    };
  }, [scope?.kind, scope && 'address' in scope ? scope.address : undefined,
      scope && 'spaceId' in scope ? scope.spaceId : undefined,
      scope && 'channelId' in scope ? scope.channelId : undefined,
      scope && 'threadId' in scope ? scope.threadId : undefined,
      typingService]);

  return typists;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/business/messages/useTypingIndicator.ts
git commit -m "feat(typing): add useTypingIndicator hook for UI subscription"
```

---

## Task 10: TypingIndicator component + styles

**Files:**
- Create: `src/components/message/TypingIndicator.tsx`
- Create: `src/components/message/TypingIndicator.native.tsx`
- Create: `src/components/message/TypingIndicator.scss`

- [ ] **Step 1: Implement the SCSS animation**

Create `src/components/message/TypingIndicator.scss`:

```scss
.typing-indicator-dots {
  display: inline-block;
  margin-left: 0.25rem;

  span {
    display: inline-block;
    width: 0.25rem;
    height: 0.25rem;
    margin: 0 0.0625rem;
    border-radius: 50%;
    background-color: currentColor;
    opacity: 0.4;
    animation: typing-indicator-blink 1.4s infinite both;
  }

  span:nth-child(2) {
    animation-delay: 0.2s;
  }
  span:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes typing-indicator-blink {
  0%, 80%, 100% {
    opacity: 0.4;
  }
  40% {
    opacity: 1;
  }
}
```

- [ ] **Step 2: Implement the component**

Create `src/components/message/TypingIndicator.tsx`:

```tsx
import { t } from '@lingui/macro';
import { useMemo } from 'react';
import { useTypingIndicator } from '@/hooks/business/messages/useTypingIndicator';
import { useDisplayNameResolver } from '@/hooks/business/user/useDisplayNameResolver';
import type { TypingScope } from '@/types/typing';
import './TypingIndicator.scss';

export interface TypingIndicatorProps {
  scope: TypingScope | null;
}

export function TypingIndicator({ scope }: TypingIndicatorProps) {
  const typists = useTypingIndicator(scope);
  const resolveName = useDisplayNameResolver(scope);

  const label = useMemo(() => {
    if (typists.length === 0) return null;
    const names = typists.map(resolveName);
    if (names.length === 1) {
      return t`${names[0]} is typing`;
    }
    if (names.length === 2) {
      return t`${names[0]} and ${names[1]} are typing`;
    }
    if (names.length === 3) {
      return t`${names[0]}, ${names[1]} and ${names[2]} are typing`;
    }
    return t`Several people are typing`;
  }, [typists, resolveName]);

  return (
    <div
      className="h-5 px-3 text-xs text-muted overflow-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label && (
        <span>
          {label}
          <span className="typing-indicator-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the display name resolver hook (if missing)**

The component above uses `useDisplayNameResolver`. Check whether it already exists:

```bash
ls /d/GitHub/Quilibrium/quorum-desktop/src/hooks/business/user/ | grep -i displayname
```

If it doesn't exist, create `src/hooks/business/user/useDisplayNameResolver.ts`:

```typescript
import { useCallback } from 'react';
import { useMessageDB } from '@/components/context/MessageDB';
import type { TypingScope } from '@/types/typing';

/**
 * Returns a function that resolves a user address to its display name in the
 * context of the given scope (space members for spaces, DM contact for DMs).
 * Falls back to a truncated address if no name is found.
 */
export function useDisplayNameResolver(scope: TypingScope | null) {
  const messageDB = useMessageDB();

  return useCallback(
    (address: string): string => {
      if (!scope) return truncateAddress(address);
      if (scope.kind === 'dm') {
        // DM: pull profile from the conversation record
        const conversation = messageDB.getConversationSync?.(scope.address);
        return conversation?.profile?.name || truncateAddress(address);
      }
      // Space: pull from space members
      const member = messageDB.getSpaceMemberSync?.(scope.spaceId, address);
      return member?.profile?.name || truncateAddress(address);
    },
    [scope, messageDB],
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
```

If the existing codebase uses different synchronous accessors than `getConversationSync` / `getSpaceMemberSync`, adapt to match. Search for `displayName` or `profile.name` resolution patterns in `src/components/direct/DirectMessage.tsx` and `src/components/space/SpaceMembers.tsx` to find the canonical pattern, and use that pattern here.

- [ ] **Step 4: Native stub**

Create `src/components/message/TypingIndicator.native.tsx`:

```tsx
import type { TypingIndicatorProps } from './TypingIndicator';

/**
 * Native stub. Mobile implementation comes in a follow-up task in quorum-mobile.
 * Keeping this file ensures Metro doesn't fail to resolve the import on iOS/Android.
 */
export function TypingIndicator(_: TypingIndicatorProps) {
  return null;
}

export type { TypingIndicatorProps };
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/message/TypingIndicator.tsx src/components/message/TypingIndicator.native.tsx src/components/message/TypingIndicator.scss src/hooks/business/user/useDisplayNameResolver.ts
git commit -m "feat(typing): add TypingIndicator component with display-name resolution"
```

(Adjust `git add` to omit `useDisplayNameResolver.ts` if it already existed.)

---

## Task 11: Wire MessageComposer to useTypingNotifier

**Files:**
- Modify: `src/components/message/MessageComposer.tsx`

- [ ] **Step 1: Add the typingScope prop and hook call**

Open `src/components/message/MessageComposer.tsx`. Add to the component props interface:

```typescript
  /** Scope for typing indicators. Null disables typing notifications. */
  typingScope?: TypingScope | null;
  /** Permission gate. When false, typing notifications are suppressed (e.g. read-only channels). */
  canSendMessage?: boolean;
```

Import:

```typescript
import { useTypingNotifier } from '@/hooks/business/messages/useTypingNotifier';
import type { TypingScope } from '@/types/typing';
```

Near the top of the component body, add:

```typescript
const { notifyKeystroke, notifyMessageSent } = useTypingNotifier(
  typingScope ?? null,
  canSendMessage ?? true,
);
```

- [ ] **Step 2: Trigger notifyKeystroke on input change**

Find the existing `onChange` handler for the composer's text input/textarea. At the top of that handler (before any other logic), add:

```typescript
notifyKeystroke();
```

Find where the message is actually sent (likely a function named `handleSend`, `onSend`, `submitMessage`, or similar — search for the call site that posts the message to the network). At the START of that function (before the network call), add:

```typescript
notifyMessageSent();
```

Rationale for placement: calling `notifyMessageSent` BEFORE the network call ensures `typing-stop` races with the actual message rather than arriving after it. The receiver's typing-stop and the receiver's incoming message both clear the indicator (the indicator should not be visible while reading the message that was just sent).

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck && yarn lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/message/MessageComposer.tsx
git commit -m "feat(typing): wire MessageComposer to typing notifier"
```

---

## Task 12: Render TypingIndicator in DirectMessage

**Files:**
- Modify: `src/components/direct/DirectMessage.tsx`

- [ ] **Step 1: Add the indicator + pass scope**

Open `src/components/direct/DirectMessage.tsx`. Add imports near the top:

```typescript
import { TypingIndicator } from '@/components/message/TypingIndicator';
import type { TypingScope } from '@/types/typing';
```

Near the top of the component body (after the existing hooks like `useConversation` or wherever the DM partner address becomes available), compute the scope:

```typescript
const typingScope: TypingScope = useMemo(
  () => ({ kind: 'dm', address: dmAddress }),
  [dmAddress],
);
```

Substitute `dmAddress` with whatever variable name the component already uses for the DM partner's address.

Find the JSX where `<MessageComposer ... />` is rendered. Directly above it, add:

```tsx
<TypingIndicator scope={typingScope} />
```

Update the `<MessageComposer>` props to pass:

```tsx
<MessageComposer
  // ...existing props
  typingScope={typingScope}
  canSendMessage={true}
/>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `yarn dev`
With typing settings still OFF (default), open a DM. Verify:
- The 20px-tall row appears above the composer but is empty
- The composer position is identical to before the change (no layout shift)

- [ ] **Step 4: Commit**

```bash
git add src/components/direct/DirectMessage.tsx
git commit -m "feat(typing): render TypingIndicator in DirectMessage"
```

---

## Task 13: Render TypingIndicator in Channel

**Files:**
- Modify: `src/components/space/Channel.tsx`

- [ ] **Step 1: Add the indicator + pass scope**

Open `src/components/space/Channel.tsx`. Add imports:

```typescript
import { TypingIndicator } from '@/components/message/TypingIndicator';
import type { TypingScope } from '@/types/typing';
```

Near the top of the component body (after the spaceId and channelId are known), compute the scope and the permission check:

```typescript
const typingScope: TypingScope = useMemo(
  () => ({ kind: 'space-channel', spaceId, channelId }),
  [spaceId, channelId],
);

// Suppress typing-start in read-only channels — the user can't send messages
// so a typing signal carries no value and might leak intent.
const canSendMessage = !isReadOnlyChannel; // substitute the actual permission check used in this file
```

Find where the existing read-only check happens (search for `read-only`, `readOnly`, `canSend`, or `permission`). Use the existing variable; do not invent a new one.

Find the JSX where `<MessageComposer ... />` is rendered. Directly above it, add:

```tsx
<TypingIndicator scope={typingScope} />
```

Pass props:

```tsx
<MessageComposer
  // ...existing props
  typingScope={typingScope}
  canSendMessage={canSendMessage}
/>
```

- [ ] **Step 2: Type-check + smoke test**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

Run: `yarn dev`. Open a space channel — verify same as DM: 20px row, no layout shift.

- [ ] **Step 3: Commit**

```bash
git add src/components/space/Channel.tsx
git commit -m "feat(typing): render TypingIndicator in Channel"
```

---

## Task 14: Render TypingIndicator in ThreadPanel

**Files:**
- Modify: `src/components/thread/ThreadPanel.tsx`

- [ ] **Step 1: Add the indicator + pass scope**

Open `src/components/thread/ThreadPanel.tsx`. Add imports:

```typescript
import { TypingIndicator } from '@/components/message/TypingIndicator';
import type { TypingScope } from '@/types/typing';
```

Compute the scope:

```typescript
const typingScope: TypingScope = useMemo(
  () => ({ kind: 'thread', spaceId, channelId, threadId }),
  [spaceId, channelId, threadId],
);
const canSendMessage = !isReadOnlyChannel; // use the same check Channel.tsx uses
```

Place `<TypingIndicator scope={typingScope} />` above the thread's `<MessageComposer>` and pass `typingScope` and `canSendMessage` props through.

- [ ] **Step 2: Type-check + smoke test**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: no errors.

Run: `yarn dev`. Open a channel with threads, open a thread. Verify the indicator row is present.

- [ ] **Step 3: Commit**

```bash
git add src/components/thread/ThreadPanel.tsx
git commit -m "feat(typing): render TypingIndicator in ThreadPanel"
```

---

## Task 15: End-to-end manual QA

**Files:** (none — this is verification, no commits unless bugs are found)

- [ ] **Step 1: Set up two-window QA**

Run `yarn dev`. Open the app in two different browser windows / two different accounts (browser profiles or incognito).

- [ ] **Step 2: Verify default-OFF behavior**

In both accounts: confirm both typing toggles in Settings > Privacy are OFF by default.

In account A, type in a DM to account B. In account B's window, observe:
- No typing indicator appears (default OFF on receiver side AND sender side)

Also verify no errors in browser console.

- [ ] **Step 3: Enable DM typing on both accounts**

In both accounts, turn ON "Send typing indicators in DMs". Both must be ON.

Type in account A's DM to account B. Verify:
- Within ~2 seconds, account B's window shows "Alice is typing…" above the composer
- The indicator persists while account A continues typing
- The indicator disappears within 8 seconds of account A stopping typing
- When account A sends the message, the indicator disappears immediately on account B's side

- [ ] **Step 4: Verify symmetric gating**

Turn OFF DM typing on account B only. Account A's setting is still ON.

Account A types. Verify:
- Account B does NOT see the indicator (receive gate blocks)

Now reverse: turn account B's setting back ON, and account A's OFF. Account A types. Verify:
- Account B does NOT see the indicator (send gate blocks)

- [ ] **Step 5: Space channel typing**

Both accounts turn ON "Send typing indicators in spaces". Open the same space channel in both.

Account A types in the channel. Verify:
- Account B sees "Alice is typing…" in that channel within ~2s
- Account B navigates to a different channel: account A's typing indicator does NOT appear there

- [ ] **Step 6: Thread typing scoping**

Open a thread in the same channel. Account A types IN THE THREAD. Verify:
- Account B viewing that thread sees the indicator
- Account B navigating back to the channel (out of the thread) does NOT see the indicator

- [ ] **Step 7: Multiple typists rollup**

If a third account is available, have 4+ accounts type simultaneously in a space channel. Verify the text rolls up to "Several people are typing…".

If only two accounts are available, test the 2-typist case ("Alice and Bob are typing…").

- [ ] **Step 8: Network drop**

In account A, start typing. Disconnect WiFi mid-typing. Verify:
- Account B's indicator expires within 8 seconds (TTL kicks in even without explicit typing-stop)

- [ ] **Step 9: Read-only channel suppression**

If a read-only channel exists in test data: in account A, click into the read-only channel composer (if accessible). Type. Verify:
- No outbound typing-start packet is sent (verify via network tab or by observing account B sees nothing)

- [ ] **Step 10: IndexedDB persistence check**

In account B, with typing visible, open browser DevTools → Application → IndexedDB → quorum_db → messages store. Verify:
- No message rows with `type === 'typing-start'` or `'typing-stop'` exist (control messages must never persist)

This is the most important verification: it proves the interception in MessageService is working.

- [ ] **Step 11: Document any bugs found**

For each bug: create a file at `.agents/bugs/YYYY-MM-DD-typing-<short-name>.md` and fix before declaring the feature complete.

---

## Task 16: Documentation

**Files:**
- Create: `.agents/docs/features/messages/typing-indicators.md`
- Modify: `.agents/INDEX.md`

- [ ] **Step 1: Write the feature doc**

Create `.agents/docs/features/messages/typing-indicators.md`:

```markdown
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

Live "X is typing…" indicators in DMs, space channels, and threads. Built on the same ephemeral-control-message pattern as DM receipts.

## Overview

When a user enables typing indicators in Settings > Privacy, their composer sends `typing-start` and `typing-stop` control messages to other clients. Recipients render an indicator above the MessageComposer when the relevant scope has active typists.

Two independent global toggles, both default OFF:
- "Send typing indicators in DMs" → `UserConfig.typingIndicatorsDM`
- "Send typing indicators in spaces" → `UserConfig.typingIndicatorsSpaces`

## Mechanism

Typing signals are ephemeral control messages. They ride the existing encrypted transport (Double Ratchet for DMs, Triple Ratchet hub broadcast for spaces) but are intercepted in `MessageService.processDeliveryReceiptData` before `saveMessage`. This means:

- Never written to IndexedDB
- Never added to the sync manifest digest
- Never propagated to late-joining peers
- Exist only as an in-memory event

This is the same mechanism that makes `delivery-ack` and `read-ack` safe to broadcast.

## Key files

| File | Responsibility |
|---|---|
| `src/types/typing.ts` | `TypingMessage` wire type, `TypingScope` discriminated union |
| `src/services/TypingService.ts` | Send throttling, receive state, subscription bus, privacy gate |
| `src/hooks/business/messages/useTypingNotifier.ts` | Composer-side hook |
| `src/hooks/business/messages/useTypingIndicator.ts` | Display-side hook |
| `src/components/message/TypingIndicator.tsx` | UI component (fixed-height row above composer) |
| `src/services/MessageService.ts` | Send paths + intercept in `processDeliveryReceiptData` |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Settings UI |

## Throttling

- Sender: at most one `typing-start` per 5 seconds per scope
- Sender: explicit `typing-stop` on message send, composer blur, conversation close, visibility hidden
- Receiver: 8-second TTL per typist; renewals reset; explicit stops clear immediately

## Privacy model

Symmetric gate (matches receipts):
- Send side: if the toggle is OFF, no outbound typing signals are sent
- Receive side: if the toggle is OFF, incoming typing signals are dropped before reaching state

Reciprocity emerges from independent local enforcement. Known limitation: a modified client could observe without sending. Accepted per the receipts precedent — same trade-off applies.

## Display rules

| Typists | Text |
|---|---|
| 1 | `{name} is typing…` |
| 2 | `{name1} and {name2} are typing…` |
| 3 | `{name1}, {name2} and {name3} are typing…` |
| 4+ | `Several people are typing…` |

## Deferred features

- Per-conversation typing override (Conversation Settings)
- Per-space typing override (Space Settings)
- Mobile (`quorum-mobile`) implementation — the cross-platform contract is preserved via `TypingIndicator.native.tsx` stub

---

*Updated: 2026-05-18 — initial implementation.*
```

- [ ] **Step 2: Update the INDEX**

Open `.agents/INDEX.md`. In the `### Features / Messages` section, insert (alphabetically by title — between the existing "Thread Visibility…" and "YouTube Facade…" entries, or wherever it sorts):

```markdown
- [Typing Indicators](docs/features/messages/typing-indicators.md)
```

Also update the bottom timestamp:

```markdown
**Last Updated**: 2026-05-18 ...
```

- [ ] **Step 3: Commit**

```bash
git add .agents/docs/features/messages/typing-indicators.md .agents/INDEX.md
git commit -m "docs(typing): add feature documentation"
```

---

## Done criteria

- [ ] All unit tests pass (`yarn test`)
- [ ] Type-check passes (`npx tsc --noEmit --jsx react-jsx --skipLibCheck`)
- [ ] Lint passes (`yarn lint`)
- [ ] Default-OFF behavior verified manually (Task 15, Step 2)
- [ ] Two-account DM typing works end-to-end with both toggles ON (Task 15, Step 3)
- [ ] Symmetric gating verified (Task 15, Step 4)
- [ ] Space + thread scoping verified (Task 15, Steps 5-6)
- [ ] No `typing-start`/`typing-stop` rows in IndexedDB (Task 15, Step 10)
- [ ] Documentation written (Task 16)

---

*Last updated: 2026-05-18 — initial implementation plan.*
