import { describe, it, expect } from 'vitest';

// Pure merge logic extracted for testing — mirrors the private method in ConfigService
function mergeDeviceNames(
  localNames: Record<string, string> | undefined,
  remoteNames: Record<string, string> | undefined,
  localTombstones: string[] | undefined,
  remoteTombstones: string[] | undefined
): { deviceNames: Record<string, string>; deletedDeviceNameAddresses: string[] } {
  const allTombstones = [
    ...(localTombstones ?? []),
    ...(remoteTombstones ?? []),
  ];
  const merged: Record<string, string> = {
    ...(localNames ?? {}),
    ...(remoteNames ?? {}), // remote wins on conflict for same key
  };
  for (const addr of allTombstones) {
    delete merged[addr];
  }
  return { deviceNames: merged, deletedDeviceNameAddresses: allTombstones };
}

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

  it('handles undefined inputs gracefully', () => {
    const result = mergeDeviceNames(undefined, undefined, undefined, undefined);
    expect(result.deviceNames).toEqual({});
    expect(result.deletedDeviceNameAddresses).toEqual([]);
  });
});
