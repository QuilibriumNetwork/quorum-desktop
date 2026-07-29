import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installDmWarningCounters,
  getDmWarningState,
  __resetForTests,
} from '../../dm-doctor/warningCounters';

describe('warningCounters', () => {
  let originalWarn: typeof console.warn;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalInfo: typeof console.info;

  beforeEach(() => {
    originalWarn = console.warn;
    originalLog = console.log;
    originalError = console.error;
    originalInfo = console.info;
    __resetForTests();
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
    console.info = originalInfo;
  });

  it('counts the three tell-tale receive-path warnings the probe matches', () => {
    installDmWarningCounters();

    console.warn('[MessageService] ⚠️ SESSION REPLACED by init envelope', { a: 1 });
    console.warn('[MessageService] DM frame for unknown inbox — no encryption state, retained unread');
    console.error('Decryption failed: aead::Error');
    console.warn('unable to decrypt frame');

    const state = getDmWarningState();
    expect(state.counts.sessionReplaced).toBe(1);
    expect(state.counts.unknownInbox).toBe(1);
    expect(state.counts.decryptFailish).toBe(2);
  });

  it('does not count unrelated log lines', () => {
    installDmWarningCounters();
    console.log('just a normal debug line');
    console.info('decrypt succeeded'); // "decrypt" present but no fail/error/unable

    const state = getDmWarningState();
    expect(state.counts.sessionReplaced).toBe(0);
    expect(state.counts.unknownInbox).toBe(0);
    expect(state.counts.decryptFailish).toBe(0);
  });

  it('still calls through to the original console method (never swallows real logging)', () => {
    const spy = vi.fn();
    console.warn = spy;
    installDmWarningCounters();

    console.warn('hello world');
    expect(spy).toHaveBeenCalledWith('hello world');
  });

  it('is idempotent: calling install twice does not double-wrap or reset counts', () => {
    installDmWarningCounters();
    console.warn('SESSION REPLACED by init envelope');
    const afterFirst = getDmWarningState();

    installDmWarningCounters();
    const afterSecond = getDmWarningState();

    expect(afterSecond.installedAt).toBe(afterFirst.installedAt);
    expect(afterSecond.counts.sessionReplaced).toBe(1);
  });

  it('keeps only the last 5 hit timestamps per pattern, most recent first', () => {
    installDmWarningCounters();
    for (let i = 0; i < 7; i++) {
      console.warn('SESSION REPLACED by init envelope');
    }
    const state = getDmWarningState();
    expect(state.counts.sessionReplaced).toBe(7);
    expect(state.lastHits.sessionReplaced).toHaveLength(5);
  });
});
