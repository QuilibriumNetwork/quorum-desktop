import dayjs from './dayjs';
import { t } from '@lingui/core/macro';

/**
 * Formats a message timestamp using a calendar-based format.
 * This is the standard format used across all message-related components.
 *
 * Format:
 * - Today: "14:45" (just the time in 24h format, or just "Today" if compact)
 * - Yesterday: "Yesterday at 14:45" (or just "Yesterday" if compact)
 * - Last week: Day name (e.g., "Monday")
 * - Older: Relative time (e.g., "3 days ago", "2 months ago")
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param compact - If true, omit time for today/yesterday (useful for mobile)
 * @returns Formatted date string
 */
export const formatMessageDate = (timestamp: number, compact = false): string => {
  const time = dayjs.tz(
    timestamp,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const fromNow = time.fromNow();
  const timeFormatted = time.format('HH:mm');

  if (compact) {
    return time.calendar(null, {
      sameDay: `[${t`Today`}]`,
      lastDay: `[${t`Yesterday`}]`,
      lastWeek: 'dddd',
      sameElse: `[${fromNow}]`,
    });
  }

  return time.calendar(null, {
    sameDay: `[${timeFormatted}]`,
    lastWeek: 'dddd',
    lastDay: `[${t`Yesterday at ${timeFormatted}`}]`,
    sameElse: `[${fromNow}]`,
  });
};

/**
 * Formats a timestamp for conversation list display (compact format).
 * Used in DirectMessageContact and similar preview components.
 *
 * Format:
 * - 0-24h: "14:45" (24h format)
 * - 1-6 days: "1d", "2d", etc.
 * - 7+ days (same year): "Jan 8"
 * - 1+ year ago: "Jan 8, 2024"
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Compact formatted time string
 */
export const formatConversationTime = (timestamp: number): string => {
  const time = dayjs.tz(timestamp, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const now = dayjs();
  const daysDiff = now.startOf('day').diff(time.startOf('day'), 'day');

  // Today: show time
  if (daysDiff === 0) return time.format('HH:mm');

  // 1-6 days ago: show "1d", "2d", etc.
  if (daysDiff >= 1 && daysDiff <= 6) return `${daysDiff}d`;

  // Different year: include year
  if (time.year() !== now.year()) return time.format('MMM D, YYYY');

  // 7+ days, same year: short date
  return time.format('MMM D');
};

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
