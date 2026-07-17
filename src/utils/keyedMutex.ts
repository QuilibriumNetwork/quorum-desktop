import { KeyedMutex } from '@quilibrium/quorum-shared';

/**
 * Shared lock for all DM Double Ratchet state operations, keyed by
 * conversationId. Every read-state → ratchet-op → save-state critical
 * section in MessageService must run inside
 * `dmRatchetMutex.runExclusive(conversationId, …)` — see KeyedMutex's doc
 * comment in quorum-shared for the rationale and the two usage hazards
 * (never hold the lock across delivery; beware promise auto-flattening).
 *
 * Module-level singleton on purpose: MessageService can be re-instantiated
 * many times per session (its React useMemo has a large dependency list),
 * and an instance-level mutex would let operations started on the old
 * instance race operations on the new one. All writers must go through
 * this one object.
 */
export const dmRatchetMutex = new KeyedMutex();
