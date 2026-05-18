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
