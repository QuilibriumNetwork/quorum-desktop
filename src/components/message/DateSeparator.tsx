import React from 'react';
import { FlexRow, Text } from '../primitives';
import * as moment from 'moment-timezone';

interface DateSeparatorProps {
  timestamp: number;
  label?: string; // "Today", "Yesterday", or formatted date
  className?: string;
}

/**
 * DateSeparator component provides visual separation between messages from different days
 * with a horizontal line and centered date label.
 *
 * Features:
 * - Cross-platform compatible using primitive components
 * - Responsive design that works on mobile and desktop
 * - Automatic theme adaptation (light/dark)
 * - Subtle styling that doesn't interfere with message flow
 *
 * @param timestamp - Unix timestamp in milliseconds for the date
 * @param label - Optional custom label (defaults to auto-generated based on timestamp)
 * @param className - Optional additional CSS classes
 */
export const DateSeparator: React.FC<DateSeparatorProps> = ({
  timestamp,
  label,
  className = '',
}) => {
  const displayLabel = label || getDateLabel(timestamp);

  return (
    <FlexRow
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="date-separator"
    >
      {/* Left separator line */}
      <div className="flex-1 h-px border-t border-subtle" />

      {/* Date label */}
      <Text
        size="sm"
        variant="muted"
        className="mx-3 select-none"
        testId="date-separator-label"
      >
        {displayLabel}
      </Text>

      {/* Right separator line */}
      <div className="flex-1 h-px border-t border-subtle" />
    </FlexRow>
  );
};

/**
 * Generates a human-readable date label based on timestamp
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string in "Month DD, YYYY" format (e.g. "October 15, 2025")
 */
function getDateLabel(timestamp: number): string {
  const time = moment.tz(
    timestamp,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Always use the full date format: "October 15, 2025"
  return time.format('MMMM D, YYYY');
}
