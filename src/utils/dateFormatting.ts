import { t } from '@lingui/core/macro';
import {
  formatMessageDate as sharedFormatMessageDate,
  formatConversationTime as sharedFormatConversationTime,
} from '@quilibrium/quorum-shared';

/**
 * Formats a message timestamp using a calendar-based format.
 * This is the standard format used across all message-related components.
 *
 * Format:
 * - Today: locale time ("14:45" / "2:45 PM", per the device region)
 * - Yesterday: "Yesterday at 14:45" (or just "Yesterday" if compact)
 * - Last week: Day name (e.g., "Monday")
 * - Older: Relative time (e.g., "3 days ago", "2 months ago")
 *
 * Thin desktop shim over the shared string helper: it binds the lingui labels
 * (shared is i18n-agnostic) and keeps the `(timestamp, compact)` signature so
 * call sites don't change. `yesterdayAt` translates the whole "Yesterday at X"
 * phrase as one unit, so locale word order is preserved. The clock is now
 * locale-driven (was hard-coded 24h) — intended, matches mobile.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param compact - If true, omit time for today/yesterday (useful for mobile)
 * @returns Formatted date string
 */
export const formatMessageDate = (timestamp: number, compact = false): string =>
  sharedFormatMessageDate(timestamp, {
    compact,
    labels: {
      today: t`Today`,
      yesterday: t`Yesterday`,
      yesterdayAt: (time) => t`Yesterday at ${time}`,
    },
  });

/**
 * Formats a timestamp for conversation list display (compact format).
 * Used in DirectMessageContact and similar preview components.
 *
 * Format:
 * - Today: locale time ("14:45" / "2:45 PM")
 * - 1-6 days: "1d", "2d", etc.
 * - 7+ days (same year): "Jan 8"
 * - 1+ year ago: "Jan 8, 2024"
 *
 * Delegates to the shared formatter (no fixed words → no labels needed).
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Compact formatted time string
 */
export const formatConversationTime = (timestamp: number): string =>
  sharedFormatConversationTime(timestamp);

/**
 * Formats remaining mute duration for display.
 * Uses smart formatting based on duration length.
 *
 * Examples:
 * - 364d 23h remaining → "365 days"
 * - 6d 5h remaining   → "7 days"
 * - 23h 45m remaining → "24 hours"
 * - 2h 15m remaining  → "3 hours"
 *
 * @param expiresAt - Unix timestamp when mute expires (milliseconds)
 * @returns Formatted duration string (e.g., "7 days", "24 hours")
 */
export const formatMuteRemaining = (expiresAt: number): string => {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return t`0 hours`;

  const hours = Math.ceil(remaining / (1000 * 60 * 60));
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));

  if (days > 1) {
    return t`${days} days`;
  } else {
    return t`${hours} hours`;
  }
};
