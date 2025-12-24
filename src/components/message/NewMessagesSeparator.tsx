import React from 'react';
import { FlexRow } from '../primitives';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';

interface NewMessagesSeparatorProps {
  className?: string;
}

/**
 * NewMessagesSeparator component provides visual separation before the first unread message
 *
 * Features:
 * - Cross-platform compatible using primitive components
 * - Responsive design that works on mobile and desktop
 * - Automatic theme adaptation (light/dark)
 * - Accent-colored styling to draw attention
 * - "New" label in accent color positioned on the right
 *
 * @param className - Optional additional CSS classes
 */
export const NewMessagesSeparator: React.FC<NewMessagesSeparatorProps> = ({
  className = '',
}) => {
  return (
    <FlexRow
      align="center"
      justify="center"
      className={`my-4 px-4 ${className}`}
      data-testid="new-messages-separator"
    >
      {/* Full-width separator line */}
      <div className="flex-1 h-px bg-accent" />

      {/* "New" label */}
      <span
        className="ml-2 text-accent text-sm font-semibold select-none"
        data-testid="new-messages-separator-label"
      >
        {i18n._(t`New`)}
      </span>
    </FlexRow>
  );
};
