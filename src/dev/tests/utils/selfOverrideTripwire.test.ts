import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordSelfOverrideWrite,
  readSelfOverrideTripwire,
  TRIPWIRE_KEY,
  MAX_TRIPWIRE_ENTRIES,
} from '@/utils/selfOverrideTripwire';

describe('selfOverrideTripwire', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('records a non-empty self override write', () => {
    recordSelfOverrideWrite({ spaceId: 'QmSpace', value: 'Stale Name' });
    const entries = readSelfOverrideTripwire();
    expect(entries).toHaveLength(1);
    expect(entries[0].spaceId).toBe('QmSpace');
    expect(entries[0].value).toBe('Stale Name');
    expect(entries[0].stack).toBeTruthy();
  });

  it('ignores a clear — writing "" is the fix, not the bug', () => {
    recordSelfOverrideWrite({ spaceId: 'QmSpace', value: '' });
    expect(readSelfOverrideTripwire()).toHaveLength(0);
  });

  it('bounds the ring so it cannot grow without limit', () => {
    for (let i = 0; i < MAX_TRIPWIRE_ENTRIES + 5; i++) {
      recordSelfOverrideWrite({ spaceId: `s${i}`, value: `v${i}` });
    }
    const entries = readSelfOverrideTripwire();
    expect(entries).toHaveLength(MAX_TRIPWIRE_ENTRIES);
    expect(entries[entries.length - 1].spaceId).toBe(`s${MAX_TRIPWIRE_ENTRIES + 4}`);
  });

  it('never throws when localStorage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordSelfOverrideWrite({ spaceId: 's', value: 'v' })).not.toThrow();
    spy.mockRestore();
  });

  it('exposes a stable key so it can be read from the console', () => {
    expect(TRIPWIRE_KEY).toBe('quorum:diag:selfOverrideWrites');
  });
});
