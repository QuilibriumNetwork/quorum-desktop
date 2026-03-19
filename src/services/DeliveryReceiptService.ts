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
      }, FLUSH_TIMEOUT_MS),
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
