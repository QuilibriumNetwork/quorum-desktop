import { useMemo, useCallback } from 'react';
import { t } from '@lingui/core/macro';
import * as moment from 'moment-timezone';
import { Message } from '../../../api/quorumApi';
import { IconName } from '../../../components/primitives/Icon/types';

export interface UseSearchResultFormattingProps {
  message: Message;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
}

export interface UseSearchResultFormattingReturn {
  formattedDate: string;
  messageTypeIcon: IconName;
  handleClick: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Handles formatting and interaction logic for search result items
 * This hook is platform-agnostic and manages date formatting and click handlers
 */
export const useSearchResultFormatting = ({
  message,
  onNavigate,
}: UseSearchResultFormattingProps): UseSearchResultFormattingReturn => {
  // Format date to match pinned messages format (MMM D, YYYY)
  const formattedDate = useMemo(() => {
    const time = moment.tz(
      message.createdDate,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    return time.format('MMM D, YYYY');
  }, [message.createdDate]);

  // Get message type icon
  const messageTypeIcon = useMemo((): IconName => {
    // Only 'post' messages are searchable and appear in search results
    return 'hashtag';
  }, []);

  // Handle click navigation
  const handleClick = useCallback(() => {
    onNavigate(message.spaceId, message.channelId, message.messageId);
  }, [message.spaceId, message.channelId, message.messageId, onNavigate]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return {
    formattedDate,
    messageTypeIcon,
    handleClick,
    handleKeyDown,
  };
};
