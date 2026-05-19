import { describe, it, expect } from 'vitest';
import { mergeDeviceNames } from '@/services/configMergeHelpers';

describe('mergeDeviceNames', () => {
  it('merges local and remote names', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Work Laptop' },
      { 'QmBBB': 'Phone' },
      [],
      []
    );
    expect(result.deviceNames).toEqual({ 'QmAAA': 'Work Laptop', 'QmBBB': 'Phone' });
  });

  it('remote wins when same key exists in both', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Old Name' },
      { 'QmAAA': 'New Name' },
      [],
      []
    );
    expect(result.deviceNames).toEqual({ 'QmAAA': 'New Name' });
  });

  it('removes tombstoned addresses from result', () => {
    const result = mergeDeviceNames(
      { 'QmAAA': 'Work Laptop', 'QmDEAD': 'Old Phone' },
      { 'QmBBB': 'Tablet' },
      ['QmDEAD'],
      []
    );
    expect(result.deviceNames).not.toHaveProperty('QmDEAD');
    expect(result.deviceNames).toEqual({ 'QmAAA': 'Work Laptop', 'QmBBB': 'Tablet' });
  });

  it('unions tombstone lists from both sides', () => {
    const result = mergeDeviceNames({}, {}, ['QmAAA'], ['QmBBB']);
    expect(result.deletedDeviceNameAddresses).toContain('QmAAA');
    expect(result.deletedDeviceNameAddresses).toContain('QmBBB');
  });

  it('deduplicates tombstones when the same address appears in both sides', () => {
    const result = mergeDeviceNames({}, {}, ['QmAAA'], ['QmAAA']);
    expect(result.deletedDeviceNameAddresses).toEqual(['QmAAA']);
  });

  it('handles undefined inputs gracefully', () => {
    const result = mergeDeviceNames(undefined, undefined, undefined, undefined);
    expect(result.deviceNames).toEqual({});
    expect(result.deletedDeviceNameAddresses).toEqual([]);
  });

  it('removes remote-only name when remote tombstones it', () => {
    const result = mergeDeviceNames(
      {},
      { 'QmX': 'Foo' },
      [],
      ['QmX']
    );
    expect(result.deviceNames).not.toHaveProperty('QmX');
    expect(result.deletedDeviceNameAddresses).toEqual(['QmX']);
  });
});
