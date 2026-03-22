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
  /** Called when incoming read acks are received. conversationAddress is the DM partner's address. */
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
    if (existing && existing.timestamp >= timestamp) return;

    this.readHighWaterMarks.set(address, { messageId, timestamp });
    this.resetReadTimer(address);
  }

  flushReadForPiggyback(address: string): ReadHighWaterMark | null {
    const hwm = this.readHighWaterMarks.get(address);
    if (!hwm) return null;

    this.clearReadAddress(address);
    return hwm;
  }

  onReadAckReceived(upToMessageId: string, upToTimestamp: number, conversationAddress: string): void {
    if (this.options.onReadAckProcessed) {
      this.options.onReadAckProcessed(upToMessageId, upToTimestamp, conversationAddress);
    }
  }

  clearReadBuffer(): void {
    for (const timer of this.readTimers.values()) {
      clearTimeout(timer);
    }
    this.readHighWaterMarks.clear();
    this.readTimers.clear();
  }

  // === Shared Methods ===

  flushAll(): void {
    for (const [address, buffer] of this.buffers) {
      if (buffer.size > 0) {
        this.options.onFlush(address, Array.from(buffer));
      }
    }
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
