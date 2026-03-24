import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReceiptService } from '@/services/ReceiptService';

describe('ReceiptService', () => {
  let service: ReceiptService;
  let mockFlushCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFlushCallback = vi.fn();
    service = new ReceiptService({ onFlush: mockFlushCallback });
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
      service = new ReceiptService({
        onFlush: mockFlushCallback,
        onAckProcessed: mockAckProcessed,
      });
      service.onAckReceived(['msg-1', 'msg-2']);
      expect(mockAckProcessed).toHaveBeenCalledWith(['msg-1', 'msg-2']);
    });

    it('does not call onAckProcessed when empty array', () => {
      const mockAckProcessed = vi.fn();
      service = new ReceiptService({
        onFlush: mockFlushCallback,
        onAckProcessed: mockAckProcessed,
      });
      service.onAckReceived([]);
      expect(mockAckProcessed).not.toHaveBeenCalled();
    });
  });

  describe('onReadAckReceived', () => {
    it('calls onReadAckProcessed with correct arguments', () => {
      const mockReadAckProcessed = vi.fn();
      service = new ReceiptService({
        onFlush: mockFlushCallback,
        onReadAckProcessed: mockReadAckProcessed,
      });
      service.onReadAckReceived('msg-5', 5000, 'alice');
      expect(mockReadAckProcessed).toHaveBeenCalledWith('msg-5', 5000, 'alice');
    });

    it('does not throw when onReadAckProcessed is not provided', () => {
      service = new ReceiptService({
        onFlush: mockFlushCallback,
      });
      expect(() => service.onReadAckReceived('msg-5', 5000, 'alice')).not.toThrow();
    });
  });
});

describe('Read receipt buffering', () => {
  let service: ReceiptService;
  let mockFlushCallback: ReturnType<typeof vi.fn>;
  let mockReadFlushCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFlushCallback = vi.fn();
    mockReadFlushCallback = vi.fn();
    service = new ReceiptService({
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
