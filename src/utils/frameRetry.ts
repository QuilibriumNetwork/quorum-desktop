/**
 * Retry window for DM frames that fail to decrypt.
 *
 * A frame can fail purely because our receiving chain has not yet ratcheted
 * into the sender's current chain. Seconds later the DH ratchet runs and
 * stores the skipped message keys — and the SAME frame then decrypts.
 *
 * Deleting the frame from the server inbox on the FIRST failure (the previous
 * behaviour, in place since the original MessageService) threw those frames
 * away permanently. Measured live 2026-07-25 by replaying real captured
 * frames against real captured states: 5 of 6 frames desktop had deleted were
 * decryptable against a state desktop itself held ~35s later, and emptying
 * that state's skipped-keys map made them fail again — proving the keys the
 * frames needed did arrive, just after the frames were destroyed.
 *
 * So: keep the frame (the server redelivers anything not acked-by-delete, so
 * it comes back and gets retried), and only give up after the attempt budget
 * or the time budget is exhausted. That preserves the original protection
 * against a genuinely poisonous frame sitting in the inbox forever, without
 * discarding frames that were merely early.
 *
 * Pure and unit-tested; no I/O, no timers. Extractable to quorum-shared.
 */

/**
 * Attempt ceiling. Deliberately generous: redelivery is FAST (measured gaps of
 * 0.5-10s), so a small attempt budget burns out long before the receiving chain
 * catches up. Live measurement: a frame recovered on its 7th attempt, ~30s in,
 * while an 8-attempt budget was fully spent in ~35s — several frames were given
 * up moments before they would have decrypted. TIME is the meaningful bound
 * here, not attempt count; this cap only exists to stop unbounded work on a
 * single frame.
 */
export const FRAME_RETRY_MAX_ATTEMPTS = 40;

/** The real bound: give up this long after we first saw the frame. */
export const FRAME_RETRY_TTL_MS = 5 * 60_000;

/** Cap the tracker so a flood of undecryptable frames cannot grow it forever. */
export const FRAME_RETRY_MAX_TRACKED = 500;

/**
 * Stable identity for a sealed frame.
 *
 * NOT the timestamp: two DISTINCT live frames were observed sharing one
 * server timestamp (2026-07-25 capture), so timestamps cannot identify a
 * frame. Identity has to come from the content itself. FNV-1a over
 * inbox + length + payload; a 32-bit digest is ample for a bounded,
 * short-lived retry tracker, and length is mixed in to cut collisions.
 */
export function frameKey(inboxAddress: string | undefined, encryptedContent: string): string {
  const s = `${inboxAddress ?? ''}|${encryptedContent}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${s.length.toString(36)}:${(h >>> 0).toString(16)}`;
}

type Entry = { attempts: number; firstSeen: number };

/**
 * Tracks per-frame decrypt failures and decides when a frame is hopeless.
 *
 * Deliberately has no timers: it is driven entirely by the calls the receive
 * path already makes, so it cannot leak work or fire during teardown.
 */
export class UndecryptableFrameTracker {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly maxAttempts: number = FRAME_RETRY_MAX_ATTEMPTS,
    private readonly ttlMs: number = FRAME_RETRY_TTL_MS,
    private readonly maxTracked: number = FRAME_RETRY_MAX_TRACKED
  ) {}

  /**
   * Record a failed decrypt.
   * @returns true when the frame should be DELETED from the server inbox
   *          (budget exhausted), false to keep it for another attempt.
   */
  recordFailure(key: string, now: number = Date.now()): boolean {
    const existing = this.entries.get(key);
    const entry: Entry = existing ?? { attempts: 0, firstSeen: now };
    entry.attempts += 1;

    const exhausted = entry.attempts >= this.maxAttempts;
    const expired = now - entry.firstSeen >= this.ttlMs;
    if (exhausted || expired) {
      this.entries.delete(key);
      return true;
    }

    this.entries.set(key, entry);
    this.pruneExpired(now);
    return false;
  }

  /** A frame finally decrypted — stop tracking it. */
  clear(key: string): void {
    this.entries.delete(key);
  }

  /** Visible for tests/diagnostics. */
  size(): number {
    return this.entries.size;
  }

  /**
   * Drop expired entries, and if still over the cap drop the oldest. Bounded
   * so a flood of permanently-undecryptable frames (e.g. ghost-device traffic)
   * cannot grow the map without limit.
   */
  private pruneExpired(now: number): void {
    for (const [k, v] of this.entries) {
      if (now - v.firstSeen >= this.ttlMs) this.entries.delete(k);
    }
    if (this.entries.size <= this.maxTracked) return;
    const byAge = [...this.entries.entries()].sort((a, b) => a[1].firstSeen - b[1].firstSeen);
    for (const [k] of byAge.slice(0, this.entries.size - this.maxTracked)) {
      this.entries.delete(k);
    }
  }
}
