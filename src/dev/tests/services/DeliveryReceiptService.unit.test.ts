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
