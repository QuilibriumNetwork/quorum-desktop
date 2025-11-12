import React from 'react';
import { FlexRow, Text } from '../primitives';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';

interface NewMessagesSeparatorProps {
  count?: number;
  className?: string;
}

/**
 * NewMessagesSeparator component provides visual separation before the first unread message
 * with an accent-colored horizontal line and centered "New Messages" label.
 *
 * Features:
 * - Cross-platform compatible using primitive components
 * - Responsive design that works on mobile and desktop
 * - Automatic theme adaptation (light/dark)
 * - Accent-colored styling to draw attention
 * - Optional unread message count display
 *
 * @param count - Optional number of unread messages to display
 * @param className - Optional additional CSS classes
 */
export const NewMessagesSeparator: React.FC<NewMessagesSeparatorProps> = ({
  count,
  className = '',
}) => {
  const displayLabel = formatLabel(count);

  return (
    <FlexRow
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="new-messages-separator"
    >
      {/* Left separator line */}
      <div className="flex-1 h-px border-t border-accent" />

      {/* "New Messages" label */}
      <Text
        size="sm"
        color="var(--accent)"
        className="mx-3 select-none"
        testId="new-messages-separator-label"
      >
        {displayLabel}
      </Text>

      {/* Right separator line */}
      <div className="flex-1 h-px border-t border-accent" />
    </FlexRow>
  );
};

/**
 * Formats the label with optional unread count
 * @param count - Optional number of unread messages
 * @returns Formatted label string (localized)
 */
function formatLabel(count?: number): string {
  if (count === undefined || count === 0) {
    return i18n._(t`New Messages`);
  }

  // Format large numbers with commas (e.g., 1,234) using locale
  const formattedCount = count.toLocaleString();
  return i18n._('{count} New Messages', { count: formattedCount });
}
