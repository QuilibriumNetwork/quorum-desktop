import { useMemo, useCallback } from 'react';
import { t } from '@lingui/core/macro';
import { Message } from '../../../api/quorumApi';

export interface UseSearchResultFormattingProps {
  message: Message;
  onNavigate: (spaceId: string, channelId: string, messageId: string) => void;
}

export interface UseSearchResultFormattingReturn {
  formattedDate: string;
  messageTypeIcon: string;
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
  
  // Format date relative to current time
  const formattedDate = useMemo(() => {
    const date = new Date(message.createdDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return t`Yesterday`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, [message.createdDate]);

  // Get message type icon
  const messageTypeIcon = useMemo(() => {
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