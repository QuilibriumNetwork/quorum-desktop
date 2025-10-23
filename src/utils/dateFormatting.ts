import * as moment from 'moment-timezone';
import { t } from '@lingui/core/macro';

/**
 * Formats a message timestamp using a calendar-based format.
 * This is the standard format used across all message-related components.
 *
 * Format:
 * - Today: "Today at 3:45 pm"
 * - Yesterday: "Yesterday at 3:45 pm"
 * - Last week: Day name (e.g., "Monday")
 * - Older: Relative time (e.g., "3 days ago", "2 months ago")
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
export const formatMessageDate = (timestamp: number): string => {
  const time = moment.tz(
    timestamp,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const fromNow = time.fromNow();
  const timeFormatted = time.format('h:mm a');

  return time.calendar(null, {
    sameDay: function () {
      return `[${t`Today at ${timeFormatted}`}]`;
    },
    lastWeek: 'dddd',
    lastDay: `[${t`Yesterday at ${timeFormatted}`}]`,
    sameElse: function () {
      return `[${fromNow}]`;
    },
  });
};
