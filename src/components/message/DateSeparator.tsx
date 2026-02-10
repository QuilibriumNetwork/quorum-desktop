import React from 'react';
import { Flex } from '../primitives';
import { getDateLabel } from '../../utils/messageGrouping';

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
    <Flex
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="date-separator"
    >
      {/* Left separator line */}
      <div className="flex-1 h-px border-t border-subtle" />

      {/* Date label */}
      <span
        className="text-label text-muted mx-3 select-none"
        data-testid="date-separator-label"
      >
        {displayLabel}
      </span>

      {/* Right separator line */}
      <div className="flex-1 h-px border-t border-subtle" />
    </Flex>
  );
};
