# DM Delivery Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delivery receipts to DMs — a single checkmark (✓) confirming the recipient's device received and decrypted the message, with batched acks and piggyback optimization.

**Architecture:** New `DeliveryAckMessage` control type intercepted at decrypt layer (not in `MessageContent` union). Ack buffer batches messageIds and piggybacks on outgoing DMs when possible, falling back to standalone ack messages via Action Queue after 10s timeout. Privacy setting (OFF by default) controls both sending and displaying acks — hard boundary, not cosmetic.

**Tech Stack:** React, TypeScript, Double Ratchet encryption (via `@quilibrium/quilibrium-js-sdk-channels`), Action Queue (IndexedDB persistence), WebSocket transport, Vitest.

**Spec:** `.agents/tasks/2026-03-18-dm-delivery-receipts-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/deliveryReceipt.ts` | `DeliveryAckMessage` type, `MessageWithDelivery` intersection type, local extensions | Create |
| `src/types/actionQueue.ts` | Add `'send-delivery-ack'` to `ActionType` union | Modify |
| `src/services/DeliveryReceiptService.ts` | Ack buffer, flush timers, piggyback coordination, ack processing | Create |
| `src/services/ActionQueueHandlers.ts` | New `sendDeliveryAck` handler + register in `getHandler()` | Modify |
| `src/services/MessageService.ts` | Hook into DM decrypt flow, piggyback on DM sends, strip ack fields | Modify |
| `src/db/messages.ts` | Add `deliveryReceipts` to UserConfig, persist `deliveredAt` on messages | Modify |
| `src/components/message/Message.tsx` | Render ✓ indicator, add `deliveredAt` to memo comparison | Modify |
| `src/components/message/Message.scss` | `.message-status.delivered` styles | Modify |
| `src/components/modals/UserSettingsModal/Privacy.tsx` | Delivery receipts toggle + tooltip | Modify |
| `src/dev/tests/services/DeliveryReceiptService.unit.test.ts` | Unit tests for buffer, flush, piggyback logic | Create |
| `src/dev/tests/services/ActionQueueHandlers.unit.test.ts` | Add tests for `send-delivery-ack` handler | Modify |

---

## Task 1: Types and Data Model

**Files:**
- Create: `src/types/deliveryReceipt.ts`
- Modify: `src/types/actionQueue.ts`
- Modify: `src/db/messages.ts`

- [x] **Step 1: Create delivery receipt types file**

```typescript
// src/types/deliveryReceipt.ts

/**
 * Delivery Receipt Types
 *
 * DeliveryAckMessage is a CONTROL message — NOT part of the MessageContent union.
 * Intercepted at the decrypt layer before saveMessage/addMessage pipeline.
 * Lives here locally; migrates to quorum-shared once stable.
 */

export type DeliveryAckMessage = {
  senderId: string;
  type: 'delivery-ack';
  messageIds: string[];
};

/**
 * Extended message fields for delivery receipts.
 * ackMessageIds: envelope-level piggybacked ack data (stripped before persistence)
 * deliveredAt: timestamp when sender processed the incoming ack (persisted to IndexedDB)
 */
export type DeliveryReceiptMessageExtensions = {
  ackMessageIds?: string[];
  deliveredAt?: number;
};

/**
 * Local extended Message type with delivery receipt fields.
 * quorum-shared's Message is a `type` alias (not an interface), so declaration
 * merging won't work. Instead, we create a local intersection type and use it
 * wherever delivery receipt fields are accessed (DB method, UI component, ack
 * processing). Once stable, these fields migrate into quorum-shared's Message.
 */
import type { Message } from '@quilibrium/quorum-shared';
export type MessageWithDelivery = Message & DeliveryReceiptMessageExtensions;
```

- [x] **Step 2: Add `send-delivery-ack` to ActionType union**

In `src/types/actionQueue.ts`, add to the `ActionType` union after the existing DM actions:

```typescript
  // DM actions (Double Ratchet)
  | 'reaction-dm'
  | 'delete-dm'
  | 'edit-dm'

  // Delivery receipts (Double Ratchet)
  | 'send-delivery-ack';
```

- [x] **Step 3: Add `deliveryReceipts` to UserConfig**

In `src/db/messages.ts`, add to the `UserConfig` type (after `mutedConversations`):

```typescript
  mutedConversations?: string[];
  // Delivery receipts: when ON, sends acks to senders and displays ✓ on own messages
  deliveryReceipts?: boolean;
```

- [x] **Step 4: Commit**

```bash
git add src/types/deliveryReceipt.ts src/types/actionQueue.ts src/db/messages.ts
git commit -m "$(cat <<'EOF'
feat: add delivery receipt types and UserConfig field

Add DeliveryAckMessage control type, envelope-level extensions
(ackMessageIds, deliveredAt), send-delivery-ack action type, and
deliveryReceipts boolean in UserConfig (default: false/off).
EOF
)"
```

---

## Task 2: DeliveryReceiptService — Core Logic

**Files:**
- Create: `src/services/DeliveryReceiptService.ts`
- Create: `src/dev/tests/services/DeliveryReceiptService.unit.test.ts`

- [x] **Step 1: Write failing tests for DeliveryReceiptService**

Create `src/dev/tests/services/DeliveryReceiptService.unit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeliveryReceiptService } from '@/services/DeliveryReceiptService';

describe('DeliveryReceiptService', () => {
  let service: DeliveryReceiptService;
  let mockFlushCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFlushCallback = vi.fn();
    service = new DeliveryReceiptService({ onFlush: mockFlushCallback });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  describe('onMessageReceived', () => {
    it('buffers messageId for the given address', () => {
      service.onMessageReceived('alice', 'msg-1');
      const ids = service.flushForPiggyback('alice');
      expect(ids).toEqual(['msg-1']);
    });

    it('buffers multiple messageIds for same address', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.onMessageReceived('alice', 'msg-2');
      const ids = service.flushForPiggyback('alice');
      expect(ids).toEqual(['msg-1', 'msg-2']);
    });

    it('deduplicates messageIds', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.onMessageReceived('alice', 'msg-1');
      const ids = service.flushForPiggyback('alice');
      expect(ids).toEqual(['msg-1']);
    });

    it('buffers separately per address', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.onMessageReceived('bob', 'msg-2');
      expect(service.flushForPiggyback('alice')).toEqual(['msg-1']);
      expect(service.flushForPiggyback('bob')).toEqual(['msg-2']);
    });
  });

  describe('flushForPiggyback', () => {
    it('clears buffer and cancels timer for that address', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.flushForPiggyback('alice');
      // Buffer should be empty now
      expect(service.flushForPiggyback('alice')).toEqual([]);
      // Timer should not fire
      vi.advanceTimersByTime(15000);
      expect(mockFlushCallback).not.toHaveBeenCalled();
    });

    it('returns empty array if no pending acks', () => {
      expect(service.flushForPiggyback('alice')).toEqual([]);
    });
  });

  describe('timer-based flush', () => {
    it('calls onFlush after 10 seconds if no piggyback', () => {
      service.onMessageReceived('alice', 'msg-1');
      vi.advanceTimersByTime(10000);
      expect(mockFlushCallback).toHaveBeenCalledWith('alice', ['msg-1']);
    });

    it('does not call onFlush before 10 seconds', () => {
      service.onMessageReceived('alice', 'msg-1');
      vi.advanceTimersByTime(9999);
      expect(mockFlushCallback).not.toHaveBeenCalled();
    });

    it('resets timer when new message arrives for same address', () => {
      service.onMessageReceived('alice', 'msg-1');
      vi.advanceTimersByTime(8000);
      service.onMessageReceived('alice', 'msg-2');
      vi.advanceTimersByTime(8000);
      // Should not have fired at original 10s mark
      expect(mockFlushCallback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      // Should fire at 10s after msg-2
      expect(mockFlushCallback).toHaveBeenCalledWith('alice', ['msg-1', 'msg-2']);
    });
  });

  describe('flushAll', () => {
    it('flushes all addresses and calls onFlush for each', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.onMessageReceived('bob', 'msg-2');
      service.flushAll();
      expect(mockFlushCallback).toHaveBeenCalledWith('alice', ['msg-1']);
      expect(mockFlushCallback).toHaveBeenCalledWith('bob', ['msg-2']);
    });

    it('clears all buffers and timers', () => {
      service.onMessageReceived('alice', 'msg-1');
      service.flushAll();
      vi.advanceTimersByTime(15000);
      // Should only have been called once (from flushAll, not timer)
      expect(mockFlushCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAckReceived', () => {
    it('calls onAckProcessed for each messageId', () => {
      const mockAckProcessed = vi.fn();
      service = new DeliveryReceiptService({
        onFlush: mockFlushCallback,
        onAckProcessed: mockAckProcessed,
      });
      service.onAckReceived(['msg-1', 'msg-2']);
      expect(mockAckProcessed).toHaveBeenCalledWith(['msg-1', 'msg-2']);
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `yarn vitest src/dev/tests/services/DeliveryReceiptService.unit.test.ts --run`
Expected: FAIL — module not found

- [x] **Step 3: Implement DeliveryReceiptService**

Create `src/services/DeliveryReceiptService.ts`:

```typescript
/**
 * DeliveryReceiptService
 *
 * Manages the ack buffer for delivery receipts. Coordinates:
 * - Buffering messageIds when DMs are decrypted
 * - Piggybacking acks on outgoing DMs
 * - Timer-based standalone ack flush (10s)
 * - Flush-all on app backgrounding
 */

const FLUSH_TIMEOUT_MS = 10_000;

interface DeliveryReceiptServiceOptions {
  /** Called when buffer needs to be flushed (standalone ack or flushAll) */
  onFlush: (address: string, messageIds: string[]) => void;
  /** Called when incoming acks are received */
  onAckProcessed?: (messageIds: string[]) => void;
}

export class DeliveryReceiptService {
  private buffers = new Map<string, Set<string>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private options: DeliveryReceiptServiceOptions;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: DeliveryReceiptServiceOptions) {
    this.options = options;
    this.setupVisibilityListener();
  }

  /**
   * Buffer a messageId for acking. Called when a DM is decrypted.
   * Caller must check deliveryReceipts setting BEFORE calling this.
   */
  onMessageReceived(address: string, messageId: string): void {
    let buffer = this.buffers.get(address);
    if (!buffer) {
      buffer = new Set();
      this.buffers.set(address, buffer);
    }
    buffer.add(messageId);
    this.resetTimer(address);
  }

  /**
   * Drain and return pending ackIds for an address. Called before sending any DM.
   * Clears the buffer and cancels the timer — acks will piggyback on the outgoing message.
   */
  flushForPiggyback(address: string): string[] {
    const buffer = this.buffers.get(address);
    if (!buffer || buffer.size === 0) return [];

    const ids = Array.from(buffer);
    this.clearAddress(address);
    return ids;
  }

  /**
   * Flush all buffers immediately (app backgrounding, beforeunload).
   */
  flushAll(): void {
    for (const [address, buffer] of this.buffers) {
      if (buffer.size > 0) {
        this.options.onFlush(address, Array.from(buffer));
      }
    }
    this.clearAll();
  }

  /**
   * Process incoming ack data (standalone delivery-ack or piggybacked ackMessageIds).
   */
  onAckReceived(messageIds: string[]): void {
    if (messageIds.length > 0 && this.options.onAckProcessed) {
      this.options.onAckProcessed(messageIds);
    }
  }

  /**
   * Clean up timers and listeners.
   */
  destroy(): void {
    this.clearAll();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('beforeunload', this.visibilityHandler);
    }
  }

  // --- Private ---

  private resetTimer(address: string): void {
    const existing = this.timers.get(address);
    if (existing) clearTimeout(existing);

    this.timers.set(
      address,
      setTimeout(() => {
        const buffer = this.buffers.get(address);
        if (buffer && buffer.size > 0) {
          this.options.onFlush(address, Array.from(buffer));
          this.clearAddress(address);
        }
      }, FLUSH_TIMEOUT_MS)
    );
  }

  private clearAddress(address: string): void {
    this.buffers.delete(address);
    const timer = this.timers.get(address);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(address);
    }
  }

  private clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.buffers.clear();
    this.timers.clear();
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

- [x] **Step 4: Run tests to verify they pass**

Run: `yarn vitest src/dev/tests/services/DeliveryReceiptService.unit.test.ts --run`
Expected: All PASS

- [x] **Step 5: Commit**

```bash
git add src/services/DeliveryReceiptService.ts src/dev/tests/services/DeliveryReceiptService.unit.test.ts
git commit -m "$(cat <<'EOF'
feat: add DeliveryReceiptService with ack buffer and flush logic

Implements batched ack buffering with 10s timeout, piggyback support
for outgoing DMs, and flushAll for app backgrounding. Includes full
unit test coverage.
EOF
)"
```

---

## Task 3: Action Queue Handler for Standalone Acks

**Files:**
- Modify: `src/services/ActionQueueHandlers.ts`
- Modify: `src/dev/tests/services/ActionQueueHandlers.unit.test.ts`

- [x] **Step 1: Write failing tests for send-delivery-ack handler**

Add to `src/dev/tests/services/ActionQueueHandlers.unit.test.ts`, in a new `describe` block:

```typescript
describe('send-delivery-ack handler', () => {
  it('should be registered in getHandler', () => {
    const handler = handlers.getHandler('send-delivery-ack');
    expect(handler).toBeDefined();
  });

  it('should encrypt and send ack via encryptAndSendDm pattern', async () => {
    const handler = handlers.getHandler('send-delivery-ack')!;
    const context = {
      address: 'recipient-address',
      messageIds: ['msg-1', 'msg-2'],
      selfUserAddress: 'self-address',
    };

    // Setup mocks for encryption state
    mockDeps.messageDB.getEncryptionStates.mockResolvedValue([
      { state: JSON.stringify({ ratchet_state: {}, tag: 'tag-1', receiving_inbox: {}, sending_inbox: { inbox_public_key: 'key-1' } }), timestamp: Date.now(), inboxId: 'inbox-1', conversationId: 'recipient-address/recipient-address' },
    ]);

    await handler.execute(context);

    expect(mockDeps.messageService.sendDirectMessages).toHaveBeenCalled();
  });

  it('should classify 400/403 as permanent errors', () => {
    const handler = handlers.getHandler('send-delivery-ack')!;
    expect(handler.isPermanentError?.(new Error('400'))).toBe(true);
    expect(handler.isPermanentError?.(new Error('403'))).toBe(true);
    expect(handler.isPermanentError?.(new Error('500'))).toBe(false);
  });

  it('should NOT have onFailure callback (best effort)', () => {
    const handler = handlers.getHandler('send-delivery-ack')!;
    expect(handler.onFailure).toBeUndefined();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `yarn vitest src/dev/tests/services/ActionQueueHandlers.unit.test.ts --run`
Expected: FAIL — handler not found

- [x] **Step 3: Implement send-delivery-ack handler**

In `src/services/ActionQueueHandlers.ts`, add the handler (near the other DM handlers, after `editDm`):

```typescript
/**
 * send-delivery-ack: Send batched delivery receipt ack via Double Ratchet.
 * Best-effort — no onFailure callback (we don't update UI on ack failure).
 */
private sendDeliveryAck: TaskHandler = {
  execute: async (context) => {
    const keyset = this.deps.getUserKeyset();
    if (!keyset) throw new Error('Keyset not available');

    const address = context.address as string;
    const messageIds = context.messageIds as string[];
    const selfUserAddress = context.selfUserAddress as string;

    if (!messageIds || messageIds.length === 0) return;

    const ackMessage = {
      senderId: selfUserAddress,
      type: 'delivery-ack' as const,
      messageIds,
    };

    // 4th arg: keyset — same pattern as reactionDm, deleteDm, editDm handlers
    await this.encryptAndSendDm(address, ackMessage, selfUserAddress, keyset);
  },
  isPermanentError: (error: Error) => {
    const message = error.message || '';
    return message.includes('400') || message.includes('403');
  },
  // No onFailure — delivery acks are best-effort
};
```

Then register in `getHandler()`:

```typescript
const handlers: Record<string, TaskHandler> = {
  // ... existing handlers ...
  'send-delivery-ack': this.sendDeliveryAck,
};
```

- [x] **Step 4: Run tests to verify they pass**

Run: `yarn vitest src/dev/tests/services/ActionQueueHandlers.unit.test.ts --run`
Expected: All PASS (existing + new tests)

- [x] **Step 5: Commit**

```bash
git add src/services/ActionQueueHandlers.ts src/dev/tests/services/ActionQueueHandlers.unit.test.ts
git commit -m "$(cat <<'EOF'
feat: add send-delivery-ack Action Queue handler

Uses encryptAndSendDm to send batched delivery acks via Double Ratchet.
Best-effort with no onFailure callback. Classifies 400/403 as permanent.
EOF
)"
```

---

## Task 4: Integration — Recipient Side (Sending Acks)

**Files:**
- Modify: `src/services/MessageService.ts`

This task wires DeliveryReceiptService into the DM receive flow.

- [x] **Step 1: Add DeliveryReceiptService dependency to MessageService**

In the MessageService constructor/initialization, accept and store a `DeliveryReceiptService` instance. The service will be instantiated by the context provider (same pattern as ActionQueueService).

Add a field:

```typescript
private deliveryReceiptService: DeliveryReceiptService | null = null;

setDeliveryReceiptService(service: DeliveryReceiptService): void {
  this.deliveryReceiptService = service;
}
```

- [x] **Step 2: Hook into handleNewMessage() to buffer acks**

In `MessageService.ts`, in the `handleNewMessage()` method (around line 2313 where `saveMessage` is called), after successful decryption and before/after saving the message, add:

```typescript
// After successful decryption of a DM message:
// Check if it's a delivery-ack control message — intercept before saveMessage
const decryptedContent = JSON.parse(decryptedJson);

if (decryptedContent.content?.type === 'delivery-ack') {
  // Control message — process acks and return (don't save, don't display)
  if (this.deliveryReceiptService && userConfig?.deliveryReceipts) {
    this.deliveryReceiptService.onAckReceived(decryptedContent.content.messageIds);
  }
  return;
}

// Extract piggybacked ackMessageIds from envelope, process, then strip
if (decryptedContent.ackMessageIds && this.deliveryReceiptService && userConfig?.deliveryReceipts) {
  this.deliveryReceiptService.onAckReceived(decryptedContent.ackMessageIds);
}
delete decryptedContent.ackMessageIds;

// Buffer ack for this message if setting is ON
// DEFENSE IN DEPTH: explicitly exclude delivery-ack to prevent infinite ack loops
// even if the early-return above is accidentally moved during refactoring
if (this.deliveryReceiptService && userConfig?.deliveryReceipts
    && decryptedContent.content?.type === 'post'
    && decryptedContent.content?.type !== 'delivery-ack') {
  this.deliveryReceiptService.onMessageReceived(senderAddress, decryptedContent.messageId);
}

// Continue with existing saveMessage flow...
```

**CRITICAL**: `handleNewMessage()` has TWO distinct DM decrypt paths that both call `saveMessage()`:
1. **New session initialization path** (~line 2313): Uses `UnsealInitializationEnvelope` + `NewDoubleRatchetRecipientSession` — handles the very first message in a new conversation.
2. **Established session path** (~line 3852): Uses `ConfirmDoubleRatchetSenderSession` / `DoubleRatchetInboxDecrypt` — handles ALL subsequent messages in ongoing conversations. **This is the primary path.**

The delivery receipt interception MUST be implemented at BOTH sites. The same three-step logic applies at each:
1. Intercept `delivery-ack` type BEFORE `saveMessage()` — return early
2. Extract + process `ackMessageIds` from any message — then strip before `saveMessage()`
3. Buffer the received message's ID for acking — after decryption succeeds

Consider extracting a shared helper function (e.g., `processDeliveryReceiptData(decryptedContent, senderAddress)`) to avoid duplicating this logic at both call sites.

- [x] **Step 3: Commit**

```bash
git add src/services/MessageService.ts
git commit -m "$(cat <<'EOF'
feat: hook delivery receipt service into DM receive flow

Intercepts delivery-ack control messages before saveMessage pipeline.
Extracts piggybacked ackMessageIds from regular DMs. Buffers received
message IDs for acking when deliveryReceipts setting is on.
EOF
)"
```

---

## Task 5: Integration — Sender Side (Piggyback + Ack Processing)

**Files:**
- Modify: `src/services/MessageService.ts`
- Modify: `src/db/messages.ts`

- [x] **Step 1: Add piggyback hook to DM send flow**

In `MessageService.ts`, in the `submitMessage()` method (around lines 1778-1812 where the DM is about to be sent), before the message is encrypted, call `flushForPiggyback`:

```typescript
// Before sending any DM, check for pending acks to piggyback
if (this.deliveryReceiptService) {
  const pendingAcks = this.deliveryReceiptService.flushForPiggyback(address);
  if (pendingAcks.length > 0) {
    messageToSend.ackMessageIds = pendingAcks;
  }
}
```

**Note**: This must also be done in the legacy (online) send path, not just the Action Queue path. The implementer should find all DM send paths (submitMessage for posts, and the reaction/edit/delete flows in `useMessageActions.ts` and `MessageEditTextarea.tsx`) and add piggyback at each. Alternatively, add it in a single place that all DM sends pass through — consult the codebase at implementation time for the cleanest integration point.

- [x] **Step 2: Implement ack processing — update deliveredAt on messages**

The `onAckProcessed` callback (passed to DeliveryReceiptService) should update messages in both React Query cache and IndexedDB:

```typescript
// This callback is wired when creating DeliveryReceiptService
const handleAckProcessed = (messageIds: string[]) => {
  const now = Date.now();
  for (const messageId of messageIds) {
    // Update React Query cache
    // Use setQueriesData pattern similar to updateMessageStatus()
    // Find the message, skip if already has deliveredAt, set deliveredAt = now

    // Persist to IndexedDB
    // messageDB.updateMessageDeliveredAt(messageId, now)
  }
};
```

- [x] **Step 3: Add updateMessageDeliveredAt to message DB**

In `src/db/messages.ts`, add a method to update `deliveredAt` on a persisted message:

```typescript
async updateMessageDeliveredAt(messageId: string, deliveredAt: number): Promise<void> {
  const tx = this.db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  // messageId is the primary keyPath — use store.get() directly (no index needed)
  const request = store.get(messageId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const msg = request.result;
      if (msg && !msg.deliveredAt) {
        msg.deliveredAt = deliveredAt;
        store.put(msg);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
```

- [x] **Step 4: Commit**

```bash
git add src/services/MessageService.ts src/db/messages.ts
git commit -m "$(cat <<'EOF'
feat: add piggyback support and ack processing for delivery receipts

Piggybacks pending acks on outgoing DMs. Processes received acks by
updating deliveredAt in React Query cache and IndexedDB.
EOF
)"
```

---

## Task 6: Service Wiring and Initialization

**Files:**
- Modify: `src/components/context/MessageDB.tsx` (or wherever services are initialized)

- [x] **Step 1: Instantiate DeliveryReceiptService and wire to MessageService + ActionQueue**

Follow the existing service initialization pattern (see `.agents/docs/features/action-queue.md`, "Service Initialization" section). The DeliveryReceiptService is created after MessageService and ActionQueueService:

```typescript
// After messageService and actionQueueService are created:
const deliveryReceiptService = new DeliveryReceiptService({
  onFlush: (address: string, messageIds: string[]) => {
    // Queue standalone ack via Action Queue
    actionQueueService.enqueue(
      'send-delivery-ack',
      {
        address,
        messageIds,
        selfUserAddress: currentUserAddress,
      },
      `delivery-ack:${address}`  // dedup key: one pending ack per address
    );
  },
  onAckProcessed: (messageIds: string[]) => {
    // Update deliveredAt on sender's messages
    const now = Date.now();
    for (const messageId of messageIds) {
      // Update React Query cache + IndexedDB
      // (implementation details from Task 5)
    }
  },
});

messageService.setDeliveryReceiptService(deliveryReceiptService);
```

**Note**: The implementer should read the existing initialization flow in `MessageDB.tsx` (or its equivalent context provider) carefully. The exact wiring depends on what's available in scope (queryClient, userAddress, messageDB, etc.).

- [x] **Step 2: Commit**

```bash
git add src/components/context/MessageDB.tsx
git commit -m "$(cat <<'EOF'
feat: wire DeliveryReceiptService into service initialization

Creates and connects DeliveryReceiptService with MessageService and
ActionQueueService following existing initialization pattern.
EOF
)"
```

---

## Task 7: UI — Checkmark Indicator

**Files:**
- Modify: `src/components/message/Message.tsx`
- Modify: `src/components/message/Message.scss`

- [x] **Step 1: Add delivered indicator to Message.tsx**

In `src/components/message/Message.tsx`, after the existing "Sending..." indicator block (line ~1231, between the `sending` and `failed` blocks), add:

```tsx
{/* Delivered indicator — only on own messages when deliveredAt is set and setting is ON */}
{!message.sendStatus && message.deliveredAt && isOwnMessage && showDeliveryReceipts && (
  <Flex align="center" gap="xs" className="message-status delivered pt-1">
    <Icon name="check" size="xs" />
  </Flex>
)}
```

**Note**: `isOwnMessage` — the implementer needs to check how the current message determines ownership. Look for existing ownership checks in Message.tsx (likely comparing `message.content.senderId` with the current user address). The delivered indicator should ONLY show on the current user's own sent messages.

**Important**: The ✓ should only render if the user's `deliveryReceipts` setting is ON. Add a `showDeliveryReceipts?: boolean` prop to `MessageProps`, threaded from the parent component (Channel.tsx / DirectMessage.tsx → MessageList.tsx → Message.tsx). The parent already has access to UserConfig via `useUserSettings` or the messageDB context. This follows the existing prop-threading pattern used for `onRetryMessage` and `dmContext`.

- [x] **Step 2: Add `deliveredAt` to React.memo comparison**

In the memo comparison function (line ~1324-1344), add:

```typescript
prevProps.message.deliveredAt !== nextProps.message.deliveredAt ||
```

After the existing `sendStatus` check (line 1340).

- [x] **Step 3: Add delivered styles to Message.scss**

In `src/components/message/Message.scss`, add to the `.message-status` block (after the `&.failed` rule, around line 282):

```scss
&.delivered {
  color: rgb(var(--text-subtle));
}
```

- [x] **Step 4: Commit**

```bash
git add src/components/message/Message.tsx src/components/message/Message.scss
git commit -m "$(cat <<'EOF'
feat: add delivery receipt checkmark indicator to messages

Shows ✓ on own sent messages when deliveredAt is set and user has
delivery receipts enabled. Subtle styling matching timestamp color.
EOF
)"
```

---

## Task 8: UI — Privacy Settings Toggle

**Files:**
- Modify: `src/components/modals/UserSettingsModal/Privacy.tsx`

- [x] **Step 1: Add deliveryReceipts prop to PrivacyProps interface**

```typescript
interface PrivacyProps {
  // ... existing props ...
  deliveryReceipts: boolean;
  setDeliveryReceipts: (value: boolean) => void;
}
```

- [x] **Step 2: Add the toggle in the Security section**

In the Privacy component JSX, after the "Show Online Status" toggle (line ~206), add:

```tsx
<div className="flex flex-row items-center gap-3 mt-3">
  <Switch value={deliveryReceipts} onChange={setDeliveryReceipts} />
  <div className="flex flex-row items-center">
    <div className="text-label-strong">
      {t`Delivery receipts`}
    </div>
    <Tooltip
      id="settings-delivery-receipts-tooltip"
      content={t`When on, senders see when their messages reach your device, and you see when yours reach theirs.`}
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

- [x] **Step 3: Wire the prop from the parent component**

The implementer should find where `Privacy` is rendered (likely in `UserSettingsModal.tsx` or similar parent) and wire the `deliveryReceipts`/`setDeliveryReceipts` props using the same pattern as `allowSync`/`setAllowSync` and `nonRepudiable`/`setNonRepudiable`. The value comes from UserConfig and is saved via the `save-user-config` Action Queue task.

- [x] **Step 4: Commit**

```bash
git add src/components/modals/UserSettingsModal/Privacy.tsx
git commit -m "$(cat <<'EOF'
feat: add delivery receipts toggle to privacy settings

OFF by default. Tooltip explains reciprocal behavior. Follows existing
Switch + Tooltip pattern from other privacy toggles.
EOF
)"
```

---

## Task 9: End-to-End Integration Testing

**Files:**
- No new files — manual testing checklist

- [x] **Step 1: Run all existing tests to verify no regressions**

Run: `yarn vitest --run`
Expected: All existing tests pass + new delivery receipt tests pass

- [x] **Step 2: Manual testing checklist**

Test each scenario with the dev build (`yarn dev`):

1. **Setting OFF (default)**: Send a DM — no ✓ appears, no ack messages in WebSocket traffic
2. **Setting ON, recipient OFF**: Send a DM — no ✓ appears (recipient doesn't send ack)
3. **Setting ON, both sides ON**: Send a DM — ✓ appears after recipient's app syncs
4. **Piggyback**: Both users chatting — verify acks ride on replies (check WebSocket for no standalone ack messages during active conversation)
5. **Standalone timeout**: Send a DM, recipient has setting ON but doesn't reply — ✓ appears after ~10s
6. **Offline**: Recipient goes offline, comes back — ack is queued and sent on reconnect
7. **Burst**: Send 5 messages while recipient is offline — recipient comes back, single ack covers all 5
8. **Toggle OFF mid-conversation**: Turn setting OFF — buffer is discarded, no more acks sent
9. **App restart**: Send DM, recipient acks — close and reopen app — ✓ still shows (persisted `deliveredAt`)

- [x] **Step 3: Commit any fixes from integration testing**

---

## Task 10: Documentation

**Files:**
- Modify: `.agents/docs/features/messages/message-sending-indicator.md`

- [x] **Step 1: Update the existing message sending indicator doc**

Add a new section "Delivery Receipts" to the existing doc at `.agents/docs/features/messages/message-sending-indicator.md`. Cover:
- The new `deliveredAt` field and ✓ indicator
- How acks flow (buffer → piggyback/standalone → process)
- Privacy setting behavior
- Link to the design spec

- [x] **Step 2: Commit**

```bash
git add .agents/docs/features/messages/message-sending-indicator.md
git commit -m "$(cat <<'EOF'
doc: add delivery receipts section to message indicator docs
EOF
)"
```

---

*Created: 2026-03-18*
