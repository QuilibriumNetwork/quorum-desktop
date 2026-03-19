import { useCallback } from 'react';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

interface UseQuickReactionsProps {
  userAddress: string;
  onReaction: (emoji: string) => void;
}

interface UseQuickReactionsReturn {
  handleQuickReaction: (message: MessageType, emoji: string) => void;
  isUserReacted: (message: MessageType, emoji: string) => boolean;
}

export const useQuickReactions = ({
  userAddress,
  onReaction,
}: UseQuickReactionsProps): UseQuickReactionsReturn => {
  const isUserReacted = useCallback(
    (message: MessageType, emoji: string): boolean => {
      return Boolean(
        message.reactions
          ?.find((r) => r.emojiId === emoji)
          ?.memberIds.includes(userAddress)
      );
    },
    [userAddress]
  );

  const handleQuickReaction = useCallback(
    (message: MessageType, emoji: string) => {
      if (!isUserReacted(message, emoji)) {
        onReaction(emoji);
      }
    },
    [isUserReacted, onReaction]
  );

  return {
    handleQuickReaction,
    isUserReacted,
  };
};
