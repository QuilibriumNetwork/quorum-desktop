/**
 * KeyedMutex — per-key async mutual exclusion (FIFO).
 *
 * Why this exists: Double Ratchet state is strictly linear. Every operation
 * (encrypt on send, decrypt on receive) must read the latest saved state,
 * advance it, and save the result. Two operations that read the same state
 * concurrently fork the ratchet: whichever save lands last silently erases
 * the other's advance, and from then on the peer cannot derive the message
 * keys for the erased branch (observed live as `aead::Error` on every
 * subsequent frame). The Signal spec models encrypt/decrypt as sequential
 * mutations of a single state object; concurrent divergent copies have no
 * defined meaning. (https://signal.org/docs/specifications/doubleratchet/)
 *
 * Usage: wrap every read-state → ratchet-op → save-state critical section in
 * `runExclusive(conversationId, fn)`. Callers on the same key run strictly
 * one at a time in arrival order; different keys don't block each other.
 *
 * Pure TypeScript, no dependencies — extractable to quorum-shared for
 * mobile parity.
 *
 * Note: this serializes within one JS context only. Two tabs on the same
 * account still race each other (pre-existing, out of scope here — would
 * need the Web Locks API or single-instance enforcement).
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(key, current);
    await prev;
    try {
      return await fn();
    } finally {
      // Drop the map entry when no later caller has replaced our tail,
      // so idle keys don't accumulate forever.
      if (this.tails.get(key) === current) {
        this.tails.delete(key);
      }
      release();
    }
  }
}

/**
 * Shared lock for all DM Double Ratchet state operations, keyed by
 * conversationId.
 *
 * Module-level singleton on purpose: MessageService can be re-instantiated
 * many times per session (its React useMemo has a large dependency list),
 * and an instance-level mutex would let operations started on the old
 * instance race operations on the new one. All writers must go through
 * this one object.
 */
export const dmRatchetMutex = new KeyedMutex();
