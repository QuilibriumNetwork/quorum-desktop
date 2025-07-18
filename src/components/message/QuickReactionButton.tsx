import React from 'react';
import { Message as MessageType } from '../../api/quorumApi';

export interface QuickReactionButtonProps {
  emoji: string;
  message: MessageType;
  userAddress: string;
  onClick: () => void;
}

/**
 * Component for quick reaction buttons in the mobile drawer.
 * Provides touch-friendly emoji buttons with visual feedback for existing reactions.
 */
const QuickReactionButton: React.FC<QuickReactionButtonProps> = ({
  emoji,
  message,
  userAddress,
  onClick,
}) => {
  const existingReaction = message.reactions?.find(r => r.emojiId === emoji);
  const userHasReacted = existingReaction?.memberIds.includes(userAddress);
  const reactionCount = existingReaction?.memberIds.length || 0;

  return (
    <button
      className={`quick-reaction-button ${userHasReacted ? 'quick-reaction-button--active' : ''}`}
      onClick={onClick}
      aria-label={`React with ${emoji}`}
      type="button"
    >
      <span className="quick-reaction-button__emoji">{emoji}</span>
      {reactionCount > 0 && (
        <span className="quick-reaction-button__count">{reactionCount}</span>
      )}
    </button>
  );
};

export default QuickReactionButton;