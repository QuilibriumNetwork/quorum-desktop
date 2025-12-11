/**
 * Simple sliding window rate limiter for message submission
 *
 * Tracks timestamps of recent actions and rejects if limit exceeded.
 * Simpler than token bucket - no refill math, no capacity tracking.
 */
export class SimpleRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxMessages: number,
    private readonly windowMs: number
  ) {}

  /**
   * Check if action is allowed, track if yes
   * @returns {allowed: boolean, waitMs: number}
   */
  canSend(): { allowed: boolean; waitMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove expired timestamps (sliding window)
    this.timestamps = this.timestamps.filter((t) => t > cutoff);

    if (this.timestamps.length < this.maxMessages) {
      this.timestamps.push(now);
      return { allowed: true, waitMs: 0 };
    }

    // Calculate wait time until oldest timestamp expires
    const oldestTimestamp = this.timestamps[0];
    const waitMs = oldestTimestamp + this.windowMs - now;

    return { allowed: false, waitMs: Math.max(0, waitMs) };
  }
}

/**
 * Rate limit presets
 */
export const RATE_LIMITS = {
  // UI layer: Gentle limit for accidental rapid clicking
  UI: { maxMessages: 5, windowMs: 5000 }, // 5 messages per 5 seconds

  // Receiving layer: More permissive, catches only true abuse
  RECEIVING: { maxMessages: 10, windowMs: 10000 }, // 10 messages per 10 seconds
} as const;
