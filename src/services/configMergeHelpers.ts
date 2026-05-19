/**
 * Pure merge helpers for UserConfig fields that need conflict-free
 * resolution across concurrent device saves.
 *
 * Extracted from ConfigService so tests can import the real implementation
 * instead of maintaining a copy that can drift.
 */

/**
 * Merge local and remote deviceNames maps with additive union semantics.
 * Tombstoned addresses are removed from the result; tombstone lists are
 * de-duplicated so multiple devices marking the same address for deletion
 * don't produce repeated entries.
 *
 * @param localNames        Names as known locally (per-address label)
 * @param remoteNames       Names from the remote payload — wins on key conflict
 * @param localTombstones   Addresses the local device has marked deleted
 * @param remoteTombstones  Addresses the remote payload has marked deleted
 */
export function mergeDeviceNames(
  localNames: Record<string, string> | undefined,
  remoteNames: Record<string, string> | undefined,
  localTombstones: string[] | undefined,
  remoteTombstones: string[] | undefined
): { deviceNames: Record<string, string>; deletedDeviceNameAddresses: string[] } {
  const allTombstones = [
    ...new Set([...(localTombstones ?? []), ...(remoteTombstones ?? [])]),
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
