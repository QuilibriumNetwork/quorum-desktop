import React, { useState } from 'react';
import { Message as MessageType } from '../../api/quorumApi';
import { Tooltip, Icon } from '../primitives';
import { useQuickReactions } from '../../hooks/business/messages';
import { t } from '@lingui/core/macro';

// Configuration constants for message actions
const MESSAGE_ACTIONS_CONFIG = {
  PIN_CONFIRMATION_DURATION: 2000, // Duration to show pin/unpin confirmation (ms)
} as const;

interface MessageActionsProps {
  message: MessageType;
  userAddress: string;
  canUserDelete: boolean;
  canPinMessages?: boolean;
  height: number;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopyLink: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
  onMoreReactions: (clientY: number) => void;
  copiedLinkId: string | null;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  userAddress,
  canUserDelete,
  canPinMessages,
  onReaction,
  onReply,
  onCopyLink,
  onDelete,
  onPin,
  onMoreReactions,
  copiedLinkId,
}) => {
  // State for tracking which action is currently hovered
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  // State for confirmation tooltips
  const [pinAction, setPinAction] = useState<'pinned' | 'unpinned' | null>(
    null
  );

  // Quick reactions hook
  const { handleQuickReaction } = useQuickReactions({
    userAddress,
    onReaction,
  });

  // Handle pin action with confirmation modal
  const handlePinClick = (e: React.MouseEvent) => {
    if (onPin) {
      onPin(e);
    }
  };

  // Clear pin action tooltip when hovering over pin button
  const handlePinHover = () => {
    setHoveredAction('pin');
    setPinAction(null);
  };

  // Get tooltip content based on current hovered action
  const getTooltipContent = () => {
    // Show confirmation tooltip for pin actions
    if (pinAction === 'pinned') return t`Pinned!`;
    if (pinAction === 'unpinned') return t`Unpinned!`;

    switch (hoveredAction) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'copy':
        return copiedLinkId === message.messageId
          ? t`Copied!`
          : t`Copy message link`;
      case 'pin':
        return message.isPinned ? t`Unpin message` : t`Pin message`;
      case 'delete':
        return t`Delete message`;
      default:
        return '';
    }
  };

  // Get tooltip placement based on current hovered action
  const getTooltipPlace = () => {
    switch (hoveredAction) {
      case 'delete':
        return 'top-end' as const;
      default:
        return 'top' as const;
    }
  };

  return (
    <>
      {/* Shared tooltip for the entire action zone */}
      <Tooltip
        id={`actions-${message.messageId}`}
        content={getTooltipContent()}
        place={getTooltipPlace()}
        disabled={!hoveredAction && !pinAction}
      >
        <div
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            return false;
          }}
          onMouseLeave={() => setHoveredAction(null)}
          className="absolute flex flex-row right-4 top-[-10px] p-1 bg-tooltip select-none shadow-lg rounded-lg -m-1"
        >
          {/* Quick reactions */}
          <div
            onClick={() => handleQuickReaction(message, '❤️')}
            className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
          >
            ❤️
          </div>
          <div
            onClick={() => handleQuickReaction(message, '👍')}
            className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
          >
            👍
          </div>
          <div
            onClick={() => handleQuickReaction(message, '🔥')}
            className="w-5 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
          >
            🔥
          </div>

          {/* Separator */}
          <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>

          {/* More reactions */}
          <div
            onClick={(e: React.MouseEvent) => {
              onMoreReactions(e.clientY);
            }}
            onMouseEnter={() => setHoveredAction('emoji')}
            className="mr-2 text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="face-smile-beam" size="md" variant="filled" />
          </div>

          {/* Reply */}
          <div
            onClick={onReply}
            onMouseEnter={() => setHoveredAction('reply')}
            className="mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="reply" size="md" />
          </div>

          {/* Copy link */}
          <div
            onClick={onCopyLink}
            onMouseEnter={() => setHoveredAction('copy')}
            className="text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="link" size="sm" />
          </div>

          {/* Pin (if user can pin) */}
          {canPinMessages && onPin && (
            <>
              <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePinClick(e);
                }}
                onMouseEnter={handlePinHover}
                className="text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
              >
                <Icon
                  name={message.isPinned ? 'pin-off' : 'pin'}
                  size="md"
                  variant={message.isPinned ? undefined : 'filled'}
                />
              </div>
            </>
          )}

          {/* Delete (if user can delete) */}
          {canUserDelete && (
            <>
              <div className="w-2 text-center flex flex-col"></div>
              <div
                onClick={onDelete}
                onMouseEnter={() => setHoveredAction('delete')}
                className="text-center transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
              >
                <Icon
                  name="trash"
                  size="md"
                  variant="filled"
                  className="text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))] hover:scale-125"
                />
              </div>
            </>
          )}
        </div>
      </Tooltip>
    </>
  );
};

export default MessageActions;
