import React, { useState } from 'react';
import { Message as MessageType } from '../../api/quorumApi';
import { Tooltip, Icon } from '../primitives';
import { useQuickReactions } from '../../hooks/business/messages';
import { t } from '@lingui/core/macro';

interface MessageActionsProps {
  message: MessageType;
  userAddress: string;
  canUserDelete: boolean;
  height: number;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onMoreReactions: (clientY: number) => void;
  copiedLinkId: string | null;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  userAddress,
  canUserDelete,
  onReaction,
  onReply,
  onCopyLink,
  onDelete,
  onMoreReactions,
  copiedLinkId,
}) => {
  // State for tracking which action is currently hovered
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Quick reactions hook
  const { handleQuickReaction } = useQuickReactions({
    userAddress,
    onReaction,
  });

  // Get tooltip content based on current hovered action
  const getTooltipContent = () => {
    switch (hoveredAction) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'copy':
        return copiedLinkId === message.messageId ? t`Copied!` : t`Copy message link`;
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
        disabled={!hoveredAction}
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
            className="w-5 mr-2 text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
          >
            <Icon name="face-smile-beam" size="sm" />
          </div>

          {/* Reply */}
          <div
            onClick={onReply}
            onMouseEnter={() => setHoveredAction('reply')}
            className="w-5 mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
          >
            <Icon name="reply" size="sm" />
          </div>

          {/* Copy link */}
          <div
            onClick={onCopyLink}
            onMouseEnter={() => setHoveredAction('copy')}
            className="w-5 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
          >
            <Icon name="link" size="sm" />
          </div>

          {/* Delete (if user can delete) */}
          {canUserDelete && (
            <>
              <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
              <div
                onClick={onDelete}
                onMouseEnter={() => setHoveredAction('delete')}
                className="w-5 text-center transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
              >
                <Icon
                  name="trash"
                  size="sm"
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