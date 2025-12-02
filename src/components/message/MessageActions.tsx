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
  canUserEdit?: boolean;
  canViewEditHistory?: boolean;
  canPinMessages?: boolean;
  height: number;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onCopyLink: () => void;
  onCopyMessageText: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
  onMoreReactions: (clientY: number) => void;
  onEdit?: () => void;
  onViewEditHistory?: () => void;
  copiedLinkId: string | null;
  copiedMessageText: boolean;
  // Bookmark props
  isBookmarked?: boolean;
  isBookmarkPending?: boolean;
  canAddBookmark?: boolean;
  onBookmarkToggle?: () => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  userAddress,
  canUserDelete,
  canUserEdit,
  canViewEditHistory,
  canPinMessages,
  onReaction,
  onReply,
  onCopyLink,
  onCopyMessageText,
  onDelete,
  onPin,
  onMoreReactions,
  onEdit,
  onViewEditHistory,
  copiedLinkId,
  copiedMessageText,
  // Bookmark props
  isBookmarked = false,
  isBookmarkPending = false,
  canAddBookmark = true,
  onBookmarkToggle,
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
      case 'copyMessage':
        return copiedMessageText
          ? t`Copied!`
          : t`Copy message`;
      case 'edit':
        return t`Edit message`;
      case 'history':
        return t`View edit history`;
      case 'pin':
        return message.isPinned ? t`Unpin message` : t`Pin message`;
      case 'bookmark':
        if (isBookmarkPending) return t`Processing...`;
        if (!canAddBookmark && !isBookmarked) return t`Bookmark limit reached`;
        return isBookmarked ? t`Remove bookmark` : t`Bookmark message`;
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
          className="absolute flex flex-row right-4 top-[-10px] px-2 py-1 bg-tooltip select-none shadow-lg rounded-lg -m-1"
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
            className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
          >
            🔥
          </div>

          {/* More reactions */}
          <div
            onClick={(e: React.MouseEvent) => {
              onMoreReactions(e.clientY);
            }}
            onMouseEnter={() => setHoveredAction('emoji')}
            className="text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="mood-happy" size="md" variant="filled" />
          </div>

          {/* Separator */}
          <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>

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
            className="mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="link" size="sm" />
          </div>

          {/* Copy message */}
          <div
            onClick={onCopyMessageText}
            onMouseEnter={() => setHoveredAction('copyMessage')}
            className="mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
          >
            <Icon name="clipboard" size="sm" />
          </div>

          {/* Bookmark (right after copy message, no separator before) */}
          {onBookmarkToggle && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (!isBookmarkPending && (canAddBookmark || isBookmarked)) {
                  onBookmarkToggle();
                }
              }}
              onMouseEnter={() => setHoveredAction('bookmark')}
              className={`text-center transition duration-200 rounded-md flex items-center justify-center ${
                isBookmarkPending || (!canAddBookmark && !isBookmarked)
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:scale-125'
              } text-surface-9 hover:text-surface-10`}
            >
              <Icon
                name={isBookmarked ? 'bookmark-off' : 'bookmark'}
                size="md"
                className={isBookmarkPending ? 'animate-pulse' : ''}
              />
            </div>
          )}

          {/* Edit/History section with separator */}
          {(canUserEdit || canViewEditHistory) && (
            <>
              {/* Separator before edit/history section */}
              <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>

              {/* Edit (if user can edit) */}
              {canUserEdit && onEdit && (
                <div
                  onClick={onEdit}
                  onMouseEnter={() => setHoveredAction('edit')}
                  className="mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
                >
                  <Icon name="edit" size="md" />
                </div>
              )}

              {/* View Edit History (if available) */}
              {canViewEditHistory && onViewEditHistory && (
                <div
                  onClick={onViewEditHistory}
                  onMouseEnter={() => setHoveredAction('history')}
                  className="text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex items-center justify-center cursor-pointer"
                >
                  <Icon name="history" size="md" />
                </div>
              )}
            </>
          )}

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
