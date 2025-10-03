/**
 * Byte manipulation utilities
 */

/**
 * Converts a 64-bit integer to a big-endian byte array.
 * Used for message timestamps and nonces in the Quilibrium protocol.
 *
 * @param num - The number to convert (must be within safe integer range)
 * @returns 8-byte Uint8Array in big-endian format
 *
 * @example
 * const timestamp = Date.now();
 * const bytes = int64ToBytes(timestamp);
 * // bytes is an 8-byte array: Uint8Array [0, 0, 1, 140, 123, 45, 67, 89]
 */
export function int64ToBytes(num: number): Uint8Array {
  const arr = new Uint8Array(8);
  const view = new DataView(arr.buffer);
  view.setBigInt64(0, BigInt(num), false);
  return arr;
}
