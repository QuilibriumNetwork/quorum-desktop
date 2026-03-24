# DM Read Receipts (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read receipts to DMs — a double checkmark (✓✓) when the recipient has visually seen the message, building on Phase 1's delivery receipts (single ✓).

**Architecture:** Extend existing `DeliveryReceiptService` with read high-water mark tracking. New `useReadReceipt` hook uses IntersectionObserver (50% visible for 1s, tab focused) to detect when messages are read. Read acks piggyback on outgoing DMs or send standalone via Action Queue after 5s debounce. Separate `readReceipts` privacy toggle in settings.

**Tech Stack:** React, TypeScript, IntersectionObserver, Double Ratchet encryption, Action Queue (IndexedDB), WebSocket, Vitest.

**Spec:** `.agents/tasks/2026-03-22-dm-read-receipts-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/deliveryReceipt.ts` | `ReadAckMessage` type, `readAt` + `readAckUpTo` extensions | Modify |
| `src/types/actionQueue.ts` | `'send-read-ack'` in ActionType union | Modify |
| `src/db/messages.ts` | `readReceipts` in UserConfig, `updateMessagesReadAt()` method | Modify |
| `src/services/DeliveryReceiptService.ts` | Read high-water mark buffer, `onMessageRead()`, `flushReadForPiggyback()`, read timers | Modify |
| `src/dev/tests/services/DeliveryReceiptService.unit.test.ts` | Tests for read ack buffer, high-water mark, debounce | Modify |
| `src/services/ActionQueueHandlers.ts` | `send-read-ack` handler | Modify |
| `src/services/MessageService.ts` | Intercept `read-ack`, extract piggybacked `readAckUpTo`, piggyback on sends | Modify |
| `src/hooks/business/messages/useReadReceipt.ts` | IntersectionObserver hook — 1s dwell + visibility check | Create |
| `src/components/context/MessageDB.tsx` | Wire `onReadAckReceived`, extend service init with read flush callback | Modify |
| `src/components/message/Message.tsx` | ✓ → ✓✓ display logic, `readAt` memo, `showReadReceipts` prop | Modify |
| `src/components/message/Message.scss` | `.read` style class (same as `.delivered`) | Modify |
| `src/components/message/MessageList.tsx` | Thread `showReadReceipts` + `reportRead` props | Modify |
| `src/components/direct/DirectMessage.tsx` | Load `readReceipts` config, create `reportRead`, pass props | Modify |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Read receipts toggle | Modify |

---

## Task 1: Types and Data Model

**Files:**
- Modify: `src/types/deliveryReceipt.ts`
- Modify: `src/types/actionQueue.ts`
- Modify: `src/db/messages.ts`

- [ ] **Step 1: Add ReadAckMessage type and extend message fields**

In `src/types/deliveryReceipt.ts`, add the `ReadAckMessage` type after `DeliveryAckMessage`, extend `DeliveryReceiptMessageExtensions` with `readAt` and `readAckUpTo`, and update the doc comment:

```typescript
/**
 * Delivery & Read Receipt Types
 *
 * DeliveryAckMessage and ReadAckMessage are CONTROL messages — NOT part of the
 * MessageContent union. Intercepted at the decrypt layer before
 * saveMessage/addMessage pipeline.
 * Lives here locally; migrates to quorum-shared once stable.
 */

export type DeliveryAckMessage = {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];
};

export type ReadAckMessage = {
  senderId: string;
  type: 'read-ack';
  upToMessageId: string;
  upToTimestamp: number;
};

/**
 * Extended message fields for delivery and read receipts.
 * ackMessageIds: envelope-level piggybacked delivery ack data (stripped before persistence)
 * readAckUpTo: envelope-level piggybacked read ack data (stripped before persistence)
 * deliveredAt: timestamp when sender processed the incoming delivery ack (persisted)
 * readAt: timestamp when sender processed the incoming read ack (persisted)
 */
export type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];
  deliveredAt?: number;
  readAckUpTo?: { messageId: string; timestamp: number };
  readAt?: number;
};

import type { Message } from '@quilibrium/quorum-shared';
export type MessageWithDelivery = Message & DeliveryReceiptMessageExtensions;
```

- [ ] **Step 2: Add `send-read-ack` to ActionType union**

In `src/types/actionQueue.ts`, after the existing `'send-delivery-ack'` line:

```typescript
  // Delivery receipts (Double Ratchet)
  | 'send-delivery-ack'

  // Read receipts (Double Ratchet)
  | 'send-read-ack';
```

- [ ] **Step 3: Add `readReceipts` to UserConfig**

In `src/db/messages.ts`, find the `UserConfig` type and add after `deliveryReceipts`:

```typescript
  deliveryReceipts?: boolean;
  // Read receipts: when ON, sends read acks and displays ✓✓ on own messages
  readReceipts?: boolean;
```

- [ ] **Step 4: Add `updateMessagesReadAt` method to MessageDB**

In `src/db/messages.ts`, after the existing `updateMessageDeliveredAt` method (~line 362), add:

```typescript
  async updateMessagesReadAt(
    conversationId: string,
    ownAddress: string,
    upToTimestamp: number,
    readAt: number
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const index = store.index('by_conversation_time');
      const range = IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, upToTimestamp]
      );
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const msg = cursor.value;
          if (msg.content?.senderId === ownAddress && !msg.readAt) {
            msg.readAt = readAt;
            // Reading implies delivery
            if (!msg.deliveredAt) {
              msg.deliveredAt = readAt;
            }
            cursor.update(msg);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/types/deliveryReceipt.ts src/types/actionQueue.ts src/db/messages.ts
git commit -m "$(cat <<'EOF'
feat: add read receipt types, action type, and DB methods

Add ReadAckMessage control type, readAt/readAckUpTo extensions,
send-read-ack action type, readReceipts UserConfig field, and
updateMessagesReadAt DB method with range cursor.
EOF
)"
```

---

## Task 2: DeliveryReceiptService — Read Ack Buffer Extension

**Files:**
- Modify: `src/dev/tests/services/DeliveryReceiptService.unit.test.ts`
- Modify: `src/services/DeliveryReceiptService.ts`

- [ ] **Step 1: Write failing tests for read ack buffer**

Add to `src/dev/tests/services/DeliveryReceiptService.unit.test.ts`, after the existing test suite:

```typescript
describe('Read receipt buffering', () => {
  let service: DeliveryReceiptService;
  let mockFlushCallback: ReturnType<typeof vi.fn>;
  let mockReadFlushCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFlushCallback = vi.fn();
    mockReadFlushCallback = vi.fn();
    service = new DeliveryReceiptService({
      onFlush: mockFlushCallback,
      onReadFlush: mockReadFlushCallback,
    });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  describe('onMessageRead', () => {
    it('stores high-water mark for an address', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      const result = service.flushReadForPiggyback('alice');
      expect(result).toEqual({ messageId: 'msg-1', timestamp: 1000 });
    });

    it('updates high-water mark when higher timestamp arrives', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      service.onMessageRead('alice', 'msg-2', 2000);
      const result = service.flushReadForPiggyback('alice');
      expect(result).toEqual({ messageId: 'msg-2', timestamp: 2000 });
    });

    it('ignores lower timestamp than current high-water mark', () => {
      service.onMessageRead('alice', 'msg-2', 2000);
      service.onMessageRead('alice', 'msg-1', 1000);
      const result = service.flushReadForPiggyback('alice');
      expect(result).toEqual({ messageId: 'msg-2', timestamp: 2000 });
    });

    it('tracks separately per address', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      service.onMessageRead('bob', 'msg-2', 2000);
      expect(service.flushReadForPiggyback('alice')).toEqual({ messageId: 'msg-1', timestamp: 1000 });
      expect(service.flushReadForPiggyback('bob')).toEqual({ messageId: 'msg-2', timestamp: 2000 });
    });
  });

  describe('flushReadForPiggyback', () => {
    it('clears the high-water mark and cancels timer', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      service.flushReadForPiggyback('alice');
      expect(service.flushReadForPiggyback('alice')).toBeNull();
      vi.advanceTimersByTime(10000);
      expect(mockReadFlushCallback).not.toHaveBeenCalled();
    });

    it('returns null if no pending read ack', () => {
      expect(service.flushReadForPiggyback('alice')).toBeNull();
    });
  });

  describe('read ack timer-based flush', () => {
    it('calls onReadFlush after 5 seconds if no piggyback', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      vi.advanceTimersByTime(5000);
      expect(mockReadFlushCallback).toHaveBeenCalledWith('alice', { messageId: 'msg-1', timestamp: 1000 });
    });

    it('does not call onReadFlush before 5 seconds', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      vi.advanceTimersByTime(4999);
      expect(mockReadFlushCallback).not.toHaveBeenCalled();
    });

    it('resets timer when higher timestamp arrives', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      vi.advanceTimersByTime(3000);
      service.onMessageRead('alice', 'msg-2', 2000);
      vi.advanceTimersByTime(3000);
      expect(mockReadFlushCallback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(mockReadFlushCallback).toHaveBeenCalledWith('alice', { messageId: 'msg-2', timestamp: 2000 });
    });

    it('does NOT reset timer when lower timestamp arrives', () => {
      service.onMessageRead('alice', 'msg-2', 2000);
      vi.advanceTimersByTime(3000);
      service.onMessageRead('alice', 'msg-1', 1000);
      vi.advanceTimersByTime(2000);
      // Should fire at original 5s mark with the higher water mark
      expect(mockReadFlushCallback).toHaveBeenCalledWith('alice', { messageId: 'msg-2', timestamp: 2000 });
    });
  });

  describe('flushAll with read acks', () => {
    it('flushes both delivery and read buffers', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.onMessageRead('alice', 'msg-2', 2000);
      service.onMessageRead('bob', 'msg-3', 3000);
      service.flushAll();
      expect(mockFlushCallback).toHaveBeenCalledWith('alice', ['msg-1']);
      expect(mockReadFlushCallback).toHaveBeenCalledWith('alice', { messageId: 'msg-2', timestamp: 2000 });
      expect(mockReadFlushCallback).toHaveBeenCalledWith('bob', { messageId: 'msg-3', timestamp: 3000 });
    });

    it('clears read timers after flushAll', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      service.flushAll();
      vi.advanceTimersByTime(10000);
      expect(mockReadFlushCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearReadBuffer', () => {
    it('discards pending read buffer without flushing', () => {
      service.onMessageRead('alice', 'msg-1', 1000);
      service.clearReadBuffer();
      expect(service.flushReadForPiggyback('alice')).toBeNull();
      vi.advanceTimersByTime(10000);
      expect(mockReadFlushCallback).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest src/dev/tests/services/DeliveryReceiptService.unit.test.ts --run`
Expected: FAIL — `onReadFlush`, `onMessageRead`, `flushReadForPiggyback`, `clearReadBuffer` not defined

- [ ] **Step 3: Implement read ack buffer in DeliveryReceiptService**

Update `src/services/DeliveryReceiptService.ts`:

```typescript
/**
 * DeliveryReceiptService
 *
 * Manages the ack buffer for delivery receipts and read receipts. Coordinates:
 * - Buffering messageIds when DMs are decrypted (delivery acks)
 * - Tracking read high-water mark per address (read acks)
 * - Piggybacking acks on outgoing DMs
 * - Timer-based standalone ack flush (10s delivery, 5s read)
 * - Flush-all on app backgrounding
 */

const DELIVERY_FLUSH_TIMEOUT_MS = 10_000;
const READ_FLUSH_TIMEOUT_MS = 5_000;

type ReadHighWaterMark = { messageId: string; timestamp: number };

interface DeliveryReceiptServiceOptions {
  /** Called when delivery ack buffer needs to be flushed */
  onFlush: (address: string, messageIds: string[]) => void;
  /** Called when incoming delivery acks are received */
  onAckProcessed?: (messageIds: string[]) => void;
  /** Called when read ack high-water mark needs to be flushed */
  onReadFlush?: (address: string, highWaterMark: ReadHighWaterMark) => void;
  /** Called when incoming read acks are received. conversationAddress is the DM partner's address (from processDeliveryReceiptData's senderAddress). */
  onReadAckProcessed?: (upToMessageId: string, upToTimestamp: number, conversationAddress: string) => void;
}

export class DeliveryReceiptService {
  private buffers = new Map<string, Set<string>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readHighWaterMarks = new Map<string, ReadHighWaterMark>();
  private readTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private options: DeliveryReceiptServiceOptions;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: DeliveryReceiptServiceOptions) {
    this.options = options;
    this.setupVisibilityListener();
  }

  // === Delivery Ack Methods (unchanged) ===

  onMessageReceived(address: string, messageId: string): void {
    let buffer = this.buffers.get(address);
    if (!buffer) {
      buffer = new Set();
      this.buffers.set(address, buffer);
    }
    buffer.add(messageId);
    this.resetDeliveryTimer(address);
  }

  flushForPiggyback(address: string): string[] {
    const buffer = this.buffers.get(address);
    if (!buffer || buffer.size === 0) return [];

    const ids = Array.from(buffer);
    this.clearDeliveryAddress(address);
    return ids;
  }

  onAckReceived(messageIds: string[]): void {
    if (messageIds.length > 0 && this.options.onAckProcessed) {
      this.options.onAckProcessed(messageIds);
    }
  }

  // === Read Ack Methods ===

  /**
   * Record that a message was read. Updates high-water mark if timestamp is higher.
   * Caller must check readReceipts setting BEFORE calling this.
   */
  onMessageRead(address: string, messageId: string, timestamp: number): void {
    const existing = this.readHighWaterMarks.get(address);
    if (existing && existing.timestamp >= timestamp) return; // Ignore lower

    this.readHighWaterMarks.set(address, { messageId, timestamp });
    this.resetReadTimer(address);
  }

  /**
   * Drain and return pending read high-water mark for piggybacking.
   */
  flushReadForPiggyback(address: string): ReadHighWaterMark | null {
    const hwm = this.readHighWaterMarks.get(address);
    if (!hwm) return null;

    this.clearReadAddress(address);
    return hwm;
  }

  /**
   * Process incoming read ack data (standalone or piggybacked).
   */
  onReadAckReceived(upToMessageId: string, upToTimestamp: number, conversationAddress: string): void {
    if (this.options.onReadAckProcessed) {
      this.options.onReadAckProcessed(upToMessageId, upToTimestamp, conversationAddress);
    }
  }

  /**
   * Discard all pending read buffers without flushing.
   * Called when user toggles readReceipts OFF.
   */
  clearReadBuffer(): void {
    for (const timer of this.readTimers.values()) {
      clearTimeout(timer);
    }
    this.readHighWaterMarks.clear();
    this.readTimers.clear();
  }

  // === Shared Methods ===

  flushAll(): void {
    // Flush delivery acks
    for (const [address, buffer] of this.buffers) {
      if (buffer.size > 0) {
        this.options.onFlush(address, Array.from(buffer));
      }
    }
    // Flush read acks
    if (this.options.onReadFlush) {
      for (const [address, hwm] of this.readHighWaterMarks) {
        this.options.onReadFlush(address, hwm);
      }
    }
    this.clearAll();
  }

  destroy(): void {
    this.clearAll();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('beforeunload', this.visibilityHandler);
    }
  }

  // === Private ===

  private resetDeliveryTimer(address: string): void {
    const existing = this.timers.get(address);
    if (existing) clearTimeout(existing);

    this.timers.set(
      address,
      setTimeout(() => {
        const buffer = this.buffers.get(address);
        if (buffer && buffer.size > 0) {
          this.options.onFlush(address, Array.from(buffer));
          this.clearDeliveryAddress(address);
        }
      }, DELIVERY_FLUSH_TIMEOUT_MS),
    );
  }

  private resetReadTimer(address: string): void {
    const existing = this.readTimers.get(address);
    if (existing) clearTimeout(existing);

    this.readTimers.set(
      address,
      setTimeout(() => {
        const hwm = this.readHighWaterMarks.get(address);
        if (hwm && this.options.onReadFlush) {
          this.options.onReadFlush(address, hwm);
          this.clearReadAddress(address);
        }
      }, READ_FLUSH_TIMEOUT_MS),
    );
  }

  private clearDeliveryAddress(address: string): void {
    this.buffers.delete(address);
    const timer = this.timers.get(address);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(address);
    }
  }

  private clearReadAddress(address: string): void {
    this.readHighWaterMarks.delete(address);
    const timer = this.readTimers.get(address);
    if (timer) {
      clearTimeout(timer);
      this.readTimers.delete(address);
    }
  }

  private clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.buffers.clear();
    this.timers.clear();
    for (const timer of this.readTimers.values()) {
      clearTimeout(timer);
    }
    this.readHighWaterMarks.clear();
    this.readTimers.clear();
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.flushAll();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('beforeunload', this.visibilityHandler);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest src/dev/tests/services/DeliveryReceiptService.unit.test.ts --run`
Expected: All PASS (existing delivery ack tests + new read ack tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/DeliveryReceiptService.ts src/dev/tests/services/DeliveryReceiptService.unit.test.ts
git commit -m "$(cat <<'EOF'
feat: extend DeliveryReceiptService with read ack high-water mark buffer

Adds onMessageRead(), flushReadForPiggyback(), clearReadBuffer(), and
onReadAckReceived(). 5s debounce timer, flushAll includes read acks.
Full test coverage for read buffer, high-water mark, and timer logic.
EOF
)"
```

---

## Task 3: Action Queue Handler for Read Acks

**Files:**
- Modify: `src/services/ActionQueueHandlers.ts`

- [ ] **Step 1: Add send-read-ack handler**

In `src/services/ActionQueueHandlers.ts`, after the `sendDeliveryAck` handler (~line 1090), add:

```typescript
  /**
   * send-read-ack: Send read receipt ack via Double Ratchet.
   * Best-effort — no onFailure callback (we don't update UI on ack failure).
   *
   * Context expected:
   * - address: string (DM conversation address)
   * - upToMessageId: string (high-water mark message ID)
   * - upToTimestamp: number (high-water mark timestamp)
   * - selfUserAddress: string (user's address for identity in envelope)
   */
  private sendReadAck: TaskHandler = {
    execute: async (context) => {
      const keyset = this.deps.getUserKeyset();
      if (!keyset) {
        logger.error('[ActionQueue:sendReadAck] Keyset not available');
        throw new Error('Keyset not available');
      }

      const address = context.address as string;
      const upToMessageId = context.upToMessageId as string;
      const upToTimestamp = context.upToTimestamp as number;
      const selfUserAddress = context.selfUserAddress as string;

      if (!upToMessageId) {
        logger.log('[ActionQueue:sendReadAck] No upToMessageId, skipping');
        return;
      }

      logger.log('[ActionQueue:sendReadAck] Sending standalone read ack', {
        address: address?.slice(0, 16),
        upToMessageId,
        upToTimestamp,
      });

      const ackMessage = {
        senderId: selfUserAddress,
        type: 'read-ack' as const,
        upToMessageId,
        upToTimestamp,
      };

      try {
        await this.encryptAndSendDm(address, ackMessage, selfUserAddress, keyset);
        logger.log('[ActionQueue:sendReadAck] Read ack sent successfully');
      } catch (err: any) {
        logger.error('[ActionQueue:sendReadAck] Failed to send read ack', err.message);
        throw err;
      }
    },
    isPermanentError: (error: Error) => {
      const message = error.message || '';
      return message.includes('400') || message.includes('403');
    },
    // No onFailure — read acks are best-effort
    successMessage: undefined,
    failureMessage: undefined,
  };
```

- [ ] **Step 2: Register in getHandler()**

In the `getHandler()` method (~line 1132), add after `'send-delivery-ack'`:

```typescript
      // Delivery receipts (Double Ratchet)
      'send-delivery-ack': this.sendDeliveryAck,
      // Read receipts (Double Ratchet)
      'send-read-ack': this.sendReadAck,
```

- [ ] **Step 3: Commit**

```bash
git add src/services/ActionQueueHandlers.ts
git commit -m "$(cat <<'EOF'
feat: add send-read-ack Action Queue handler

Uses encryptAndSendDm to send read acks via Double Ratchet.
Best-effort with no onFailure callback. Classifies 400/403 as permanent.
EOF
)"
```

---

## Task 4: MessageService — Intercept Read Acks + Piggyback

**Files:**
- Modify: `src/services/MessageService.ts`

- [ ] **Step 1: Extend processDeliveryReceiptData to handle read-ack**

In `src/services/MessageService.ts`, update `processDeliveryReceiptData()` (~line 207):

After the `isDeliveryAck` block (~line 226), add a `read-ack` intercept block:

```typescript
    // 1b. Intercept read-ack control messages — never save, never display
    // NOTE: Unlike delivery acks, read acks are processed unconditionally (no readReceiptsEnabled check).
    // Per spec: "Read acks are always persisted; display is gated on setting."
    // This allows toggling readReceipts ON later to reveal historical read status.
    const isReadAck = raw.type === 'read-ack' || raw.content?.type === 'read-ack';
    if (isReadAck) {
      if (this.deliveryReceiptService) {
        const upToMessageId = raw.upToMessageId ?? raw.content?.upToMessageId;
        const upToTimestamp = raw.upToTimestamp ?? raw.content?.upToTimestamp;
        if (upToMessageId && upToTimestamp) {
          logger.log('[ReadReceipt] Processing incoming read ack', { upToMessageId, upToTimestamp, from: senderAddress });
          this.deliveryReceiptService.onReadAckReceived(upToMessageId, upToTimestamp, senderAddress);
        }
      }
      return true; // Signal: intercept this message
    }
```

After the existing piggybacked `ackMessageIds` extraction (~line 234), add piggybacked `readAckUpTo` extraction:

```typescript
    // 2b. Extract piggybacked readAckUpTo, process, then strip
    const readAckUpTo = raw.readAckUpTo;
    if (readAckUpTo && this.deliveryReceiptService) {
      logger.log('[ReadReceipt] Processing piggybacked read ack', { readAckUpTo, from: senderAddress });
      this.deliveryReceiptService.onReadAckReceived(readAckUpTo.messageId, readAckUpTo.timestamp, senderAddress);
    }
    delete raw.readAckUpTo;
```

- [ ] **Step 2: Add explicit `read-ack` exclusion to defense-in-depth check**

In the existing defense-in-depth check (~line 241), the `type === 'post'` guard already prevents `read-ack` from being buffered for delivery acking. For explicit clarity as required by the spec, add a comment:

```typescript
    // 3. Buffer this message's ID for acking (only for post messages from others)
    // DEFENSE IN DEPTH: explicitly exclude delivery-ack and read-ack to prevent infinite ack loops
    if (
      this.deliveryReceiptService &&
      deliveryReceiptsEnabled &&
      decryptedContent.content?.type === 'post' &&
      decryptedContent.content?.senderId !== selfAddress
    ) {
```

- [ ] **Step 3: Add read ack piggyback to DM send paths**

In `MessageService.ts`, find the two piggyback sites (~line 1858 and ~line 2193) where `flushForPiggyback` is called. where `flushForPiggyback` is called. After each `ackMessageIds` piggyback block, add:

```typescript
        // Piggyback pending read receipt ack on outgoing DM
        if (this.deliveryReceiptService) {
          const pendingReadAck = this.deliveryReceiptService.flushReadForPiggyback(address);
          if (pendingReadAck) {
            (message as any).readAckUpTo = pendingReadAck;
          }
        }
```

- [ ] **Step 4: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "$(cat <<'EOF'
feat: intercept read-ack control messages and piggyback on DM sends

Extends processDeliveryReceiptData to handle read-ack type at both
decrypt paths. Extracts piggybacked readAckUpTo from envelopes.
Attaches pending read acks when sending outgoing DMs.
EOF
)"
```

---

## Task 5: useReadReceipt Hook — Visibility Tracking

**Files:**
- Create: `src/hooks/business/messages/useReadReceipt.ts`

- [ ] **Step 1: Create the useReadReceipt hook**

Create `src/hooks/business/messages/useReadReceipt.ts`:

```typescript
import { useEffect, useRef } from 'react';

/**
 * Hook to detect when a message becomes visually read (50%+ visible for 1 second,
 * tab focused). Reports the read event via callback. Once triggered, disconnects.
 *
 * Follows the same IntersectionObserver pattern as useViewportMentionHighlight.
 *
 * Duplicate reportRead calls are harmless — the high-water mark in
 * DeliveryReceiptService makes them no-ops if the timestamp is <= current mark.
 *
 * @param messageId - Unique identifier for the message
 * @param messageTimestamp - Creation timestamp of the message
 * @param isEnabled - Whether read receipts are enabled (setting + message eligibility)
 * @param reportRead - Callback to report the read event
 * @returns Ref to attach to the message element
 */
export function useReadReceipt(
  messageId: string,
  messageTimestamp: number,
  isEnabled: boolean,
  reportRead: ((messageId: string, timestamp: number) => void) | undefined
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isEnabled || !reportRead || hasTriggeredRef.current || !elementRef.current) {
      return;
    }

    const cleanup = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (visibilityListenerRef.current) {
        document.removeEventListener('visibilitychange', visibilityListenerRef.current);
        visibilityListenerRef.current = null;
      }
    };

    const startDwellTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible' && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          reportRead(messageId, messageTimestamp);
          cleanup();
        }
      }, 1000);
    };

    // Track whether the element is currently intersecting for visibility restart
    let isCurrentlyIntersecting = false;

    // Listen for tab visibility changes to cancel/restart timer
    visibilityListenerRef.current = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else if (document.visibilityState === 'visible' && isCurrentlyIntersecting) {
        // Tab regained focus while element is still visible — restart dwell timer
        startDwellTimer();
      }
    };
    document.addEventListener('visibilitychange', visibilityListenerRef.current);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (hasTriggeredRef.current) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            isCurrentlyIntersecting = true;
            // Message is visible — start dwell timer if tab is focused
            if (document.visibilityState === 'visible') {
              startDwellTimer();
            }
          } else {
            isCurrentlyIntersecting = false;
            // Message left viewport — cancel timer
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px',
      }
    );

    observerRef.current.observe(elementRef.current);

    return cleanup;
  }, [messageId, messageTimestamp, isEnabled, reportRead]);

  // Reset if messageId changes
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [messageId]);

  return elementRef;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/business/messages/useReadReceipt.ts
git commit -m "$(cat <<'EOF'
feat: add useReadReceipt hook for viewport-based read detection

IntersectionObserver with 50% threshold and 1s dwell timer.
Checks tab visibility before reporting. Auto-disconnects after
triggering. Follows useViewportMentionHighlight pattern.
EOF
)"
```

---

## Task 6: Service Wiring — MessageDB Context

**Files:**
- Modify: `src/components/context/MessageDB.tsx`

- [ ] **Step 1: Add onReadFlush and onReadAckProcessed callbacks**

In `src/components/context/MessageDB.tsx`, update the `DeliveryReceiptService` creation (~line 972). Add the new callbacks to the constructor options:

```typescript
    const service = new DeliveryReceiptService({
      onFlush: (address: string, messageIds: string[]) => {
        // (existing delivery ack flush — unchanged)
        actionQueueService.enqueue(
          'send-delivery-ack',
          { address, messageIds, selfUserAddress: selfAddress },
          `delivery-ack:${address}`
        );
      },
      onAckProcessed: (messageIds: string[]) => {
        // (existing delivery ack processing — unchanged)
        // ...
      },
      onReadFlush: (address: string, highWaterMark: { messageId: string; timestamp: number }) => {
        // Queue standalone read ack via Action Queue
        actionQueueService.enqueue(
          'send-read-ack',
          {
            address,
            upToMessageId: highWaterMark.messageId,
            upToTimestamp: highWaterMark.timestamp,
            selfUserAddress: selfAddress,
          },
          `read-ack:${address}` // dedup key: one pending read ack per address
        );
      },
      onReadAckProcessed: (upToMessageId: string, upToTimestamp: number, conversationAddress: string) => {
        // Update readAt (and deliveredAt if missing) on own messages up to timestamp
        const now = Date.now();
        // DM conversationId is "address/address"
        const conversationId = `${conversationAddress}/${conversationAddress}`;

        // Update React Query cache — scope to this conversation only (not all conversations)
        const conversationKey = buildMessagesKeyPrefix({ spaceId: conversationAddress, channelId: conversationAddress });
        queryClient.setQueriesData(
          { queryKey: conversationKey },
          (oldData: InfiniteData<{ messages: Message[]; nextCursor?: number; prevCursor?: number }> | undefined) => {
            if (!oldData?.pages) return oldData;

            let changed = false;
            const newPages = oldData.pages.map((page) => {
              const newMessages = page.messages.map((msg) => {
                if (
                  msg.content?.senderId === selfAddress &&
                  msg.timestamp <= upToTimestamp &&
                  !(msg as any).readAt
                ) {
                  changed = true;
                  return {
                    ...msg,
                    readAt: now,
                    deliveredAt: (msg as any).deliveredAt || now,
                  } as Message;
                }
                return msg;
              });
              return changed ? { ...page, messages: newMessages } : page;
            });

            return changed ? { ...oldData, pages: newPages } : oldData;
          }
        );

        // Persist to IndexedDB
        messageDB.updateMessagesReadAt(conversationId, selfAddress, upToTimestamp, now).catch(() => {
          // Best effort — React Query cache is already updated
        });
      },
    });
```

**Important**: The `deliveryReceiptService` is currently a local `useMemo` variable inside `MessageDB.tsx` and NOT exposed through context. Task 8 needs access to it from `DirectMessage.tsx`. Add it to the MessageDB context value:

1. In the context type definition, add: `deliveryReceiptService: DeliveryReceiptService | null;`
2. In the context value object, add: `deliveryReceiptService,`

This follows the same pattern as `messageService`, `actionQueueService`, etc. already exposed through the context.

- [ ] **Step 2: Commit**

```bash
git add src/components/context/MessageDB.tsx
git commit -m "$(cat <<'EOF'
feat: wire read receipt callbacks into DeliveryReceiptService initialization

Adds onReadFlush (queues send-read-ack via Action Queue) and
onReadAckProcessed (updates readAt in React Query cache + IndexedDB)
to the service initialization in MessageDB context.
EOF
)"
```

---

## Task 7: UI — Double Checkmark Indicator

**Files:**
- Modify: `src/components/message/Message.tsx`
- Modify: `src/components/message/Message.scss`

- [ ] **Step 1: Update delivered indicator to support read state**

In `src/components/message/Message.tsx`, replace the `deliveredIndicator` block (~line 919-924):

```typescript
                  // Message receipt indicator: ✓ (delivered) or ✓✓ (read)
                  // Display logic:
                  // - readReceipts ON and readAt set → ✓✓
                  // - deliveredAt set and (deliveryReceipts ON or readReceipts ON) → ✓
                  // - otherwise → nothing
                  const isOwnMessage = message.content?.senderId === user.currentPasskeyInfo?.address;
                  const msgAny = message as any;
                  let receiptIndicator: React.ReactNode = null;
                  if (!message.sendStatus && isOwnMessage) {
                    if (showReadReceipts && msgAny.readAt) {
                      receiptIndicator = (
                        <span className="message-status read">
                          <Icon name="check" size="xs" />
                          <Icon name="check" size="xs" />
                        </span>
                      );
                    } else if (msgAny.deliveredAt && (showDeliveryReceipts || showReadReceipts)) {
                      receiptIndicator = (
                        <span className="message-status delivered">
                          <Icon name="check" size="xs" />
                        </span>
                      );
                    }
                  }
```

Then replace all references to `deliveredIndicator` with `receiptIndicator` in the JSX below (the `suffix` prop of `MessageMarkdownRenderer` and the plain text fallback).

- [ ] **Step 2: Add `showReadReceipts` prop to MessageProps**

In the `MessageProps` type (~line 119), add after `showDeliveryReceipts`:

```typescript
  showDeliveryReceipts?: boolean;
  showReadReceipts?: boolean;
  reportRead?: (messageId: string, timestamp: number) => void;
  lastReadTimestamp?: number;
```

Destructure in the component function (~line 162):

```typescript
    showDeliveryReceipts,
    showReadReceipts,
    reportRead,
    lastReadTimestamp,
```

- [ ] **Step 3: Add `readAt` to React.memo comparison**

In the memo comparison (~line 1353), after the `deliveredAt` check, add:

```typescript
      (prevProps.message as any).deliveredAt !== (nextProps.message as any).deliveredAt ||
      (prevProps.message as any).readAt !== (nextProps.message as any).readAt ||
```

- [ ] **Step 4: Wire useReadReceipt hook in Message component**

Inside the Message component, after the props destructuring, add the hook:

```typescript
    // Read receipt visibility tracking — only for unread incoming messages from others
    const isOtherPersonMessage = message.content?.senderId !== user.currentPasskeyInfo?.address;
    const isUnreadMessage = !lastReadTimestamp || message.timestamp > lastReadTimestamp;
    const readReceiptRef = useReadReceipt(
      message.messageId,
      message.timestamp,
      !!(showReadReceipts && isOtherPersonMessage && isUnreadMessage && reportRead),
      reportRead
    );
```

Then merge this ref with the existing message element ref. If the message outer `<div>` doesn't use a ref, attach `readReceiptRef` to it. If it does, use a callback ref that assigns to both.

- [ ] **Step 5: Add `.read` style to Message.scss**

In `src/components/message/Message.scss`, update the `.delivered` block (~line 279) to also cover `.read` with the same styling but using two adjacent check icons:

```scss
  &.delivered,
  &.read {
    display: inline-flex;
    align-items: center;
    vertical-align: text-bottom;
    margin-left: 4px;
    color: var(--color-text-muted);

    svg {
      width: 12px;
      height: 12px;
    }
  }

  &.read {
    gap: 0;
    svg + svg {
      margin-left: -4px;
    }
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/message/Message.tsx src/components/message/Message.scss
git commit -m "$(cat <<'EOF'
feat: add read receipt double-check indicator and useReadReceipt wiring

Shows ✓ for delivered, ✓✓ for read on own messages. Uses two adjacent
check icons with negative margin for the double-check appearance.
Wires useReadReceipt hook for incoming message visibility tracking.
EOF
)"
```

---

## Task 8: MessageList + DirectMessage Prop Threading

**Files:**
- Modify: `src/components/message/MessageList.tsx`
- Modify: `src/components/direct/DirectMessage.tsx`

- [ ] **Step 1: Add `showReadReceipts`, `reportRead`, and `lastReadTimestamp` to MessageList props**

In `src/components/message/MessageList.tsx`, add to the props interface (~line 98):

```typescript
  showDeliveryReceipts?: boolean;
  showReadReceipts?: boolean;
  reportRead?: (messageId: string, timestamp: number) => void;
  lastReadTimestamp?: number;
```

Destructure in the component (~line 164) and pass to `<Message>` (~line 335):

```typescript
              showDeliveryReceipts={showDeliveryReceipts}
              showReadReceipts={showReadReceipts}
              reportRead={reportRead}
              lastReadTimestamp={lastReadTimestamp}
```

Add `showReadReceipts`, `reportRead`, and `lastReadTimestamp` to the `useMemo` dependency array (~line 384).

- [ ] **Step 2: Add readReceipts state and reportRead callback to DirectMessage**

In `src/components/direct/DirectMessage.tsx`, add state (~line 77):

```typescript
  const [readReceipts, setReadReceipts] = useState<boolean>(false);
```

Load from config (~line 139), after `setDeliveryReceipts`:

```typescript
        setReadReceipts(cfg?.readReceipts ?? false);
```

Create the `reportRead` callback and handle toggle-off buffer discard:

```typescript
  const { deliveryReceiptService } = useMessageDB();

  // Discard pending read buffer when readReceipts is toggled OFF
  const prevReadReceipts = useRef(readReceipts);
  useEffect(() => {
    if (prevReadReceipts.current && !readReceipts && deliveryReceiptService) {
      deliveryReceiptService.clearReadBuffer();
    }
    prevReadReceipts.current = readReceipts;
  }, [readReceipts, deliveryReceiptService]);

  const reportRead = useCallback((messageId: string, timestamp: number) => {
    if (!readReceipts || !deliveryReceiptService) return;
    deliveryReceiptService.onMessageRead(address, messageId, timestamp);
  }, [readReceipts, deliveryReceiptService, address]);

Pass to MessageList (~line 890):

```typescript
                showDeliveryReceipts={deliveryReceipts}
                showReadReceipts={readReceipts}
                reportRead={reportRead}
                lastReadTimestamp={lastReadTimestamp}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/message/MessageList.tsx src/components/direct/DirectMessage.tsx
git commit -m "$(cat <<'EOF'
feat: thread showReadReceipts and reportRead through message components

Passes readReceipts setting and reportRead callback from
DirectMessage → MessageList → Message → useReadReceipt hook.
EOF
)"
```

---

## Task 9: Privacy Settings — Read Receipts Toggle

**Files:**
- Modify: `src/components/modals/UserSettingsModal/Privacy.tsx`

- [ ] **Step 1: Add readReceipts props to PrivacyProps**

In `src/components/modals/UserSettingsModal/Privacy.tsx`, add to the interface (~line 23):

```typescript
  deliveryReceipts: boolean;
  setDeliveryReceipts: (value: boolean) => void;
  readReceipts: boolean;
  setReadReceipts: (value: boolean) => void;
```

Destructure in the component (~line 44):

```typescript
  readReceipts,
  setReadReceipts,
```

- [ ] **Step 2: Add the toggle after delivery receipts**

After the delivery receipts toggle block (~line 229), add:

```tsx
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch value={readReceipts} onChange={setReadReceipts} disabled={!isConfigLoaded} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Read receipts`}
              </div>
              <Tooltip
                id="settings-read-receipts-tooltip"
                content={t`When on, senders see when you've read their messages, and you see when yours are read.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
```

- [ ] **Step 3: Wire props from parent component**

Find where `<Privacy>` is rendered (likely in `UserSettingsModal.tsx`) and add the `readReceipts`/`setReadReceipts` props, following the same pattern as `deliveryReceipts`. The value comes from UserConfig and is saved via the `save-user-config` Action Queue task.

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/UserSettingsModal/Privacy.tsx
git commit -m "$(cat <<'EOF'
feat: add read receipts toggle to privacy settings

Separate toggle below delivery receipts. OFF by default.
Tooltip explains reciprocal behavior. Follows existing pattern.
EOF
)"
```

---

## Task 10: Integration Testing

**Files:**
- No new files — testing checklist

- [ ] **Step 1: Run all existing tests**

Run: `yarn vitest --run`
Expected: All existing tests pass + new read receipt tests pass

- [ ] **Step 2: TypeScript type check**

Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`
Expected: No errors

- [ ] **Step 3: Manual testing checklist**

Test with `yarn dev`:

1. **Setting OFF (default)**: Open DM — no ✓✓ appears on any messages
2. **Setting ON, recipient OFF**: Read messages — no ✓✓ appears for sender (recipient doesn't send read ack)
3. **Both ON**: Read messages — sender sees ✓ upgrade to ✓✓ after read
4. **Scroll past many messages**: Only one read ack sent (high-water mark batching)
5. **Tab loses focus while reading**: Timer cancels, no premature read ack
6. **Piggyback**: Reply after reading — read ack rides on the reply DM
7. **Standalone**: Read but don't reply — ✓✓ appears after ~5s
8. **Toggle OFF mid-conversation**: Pending read buffer discarded
9. **App restart**: Close and reopen — ✓✓ still shows (persisted `readAt`)
10. **Read receipts ON, delivery OFF**: Read ack sets both `deliveredAt` and `readAt` — shows ✓✓ directly

- [ ] **Step 4: Commit any fixes from testing**

---

## Task 11: Documentation

**Files:**
- Modify: `.agents/docs/features/messages/message-sending-indicator.md`

- [ ] **Step 1: Update docs with read receipts section**

Add a "Read Receipts (Phase 2)" section covering:
- `readAt` field and ✓✓ indicator
- High-water mark approach
- Privacy toggle behavior
- Link to design spec

- [ ] **Step 2: Commit**

```bash
git add .agents/docs/features/messages/message-sending-indicator.md
git commit -m "$(cat <<'EOF'
doc: add read receipts section to message indicator docs
EOF
)"
```

---

*Created: 2026-03-22*
