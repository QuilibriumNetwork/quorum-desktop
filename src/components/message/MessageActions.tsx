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

  // Reusable class strings for consistency
  const emojiButtonClass =
    'w-5 xl:w-6 mr-1 text-center xl:text-lg rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 xl:hover:scale-150 transition duration-200';
  const iconButtonClass =
    'text-center text-surface-9 hover:text-surface-10 hover:scale-125 xl:hover:scale-150 transition duration-200 rounded-md flex items-center justify-center cursor-pointer';
  const iconButtonClassMr = `${iconButtonClass} mr-2`;
  const separatorClass =
    'w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5';

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
          className="absolute flex flex-row right-4 top-[-10px] px-2 py-1 xl:px-3 xl:py-1.5 bg-tooltip select-none rounded-lg -m-1 border dark:border-0"
        >
          {/* Quick reactions */}
          <div
            onClick={() => handleQuickReaction(message, '❤️')}
            className={emojiButtonClass}
          >
            ❤️
          </div>
          <div
            onClick={() => handleQuickReaction(message, '👍')}
            className={emojiButtonClass}
          >
            👍
          </div>
          <div
            onClick={() => handleQuickReaction(message, '🔥')}
            className={emojiButtonClass}
          >
            🔥
          </div>

          {/* More reactions */}
          <div
            onClick={(e: React.MouseEvent) => {
              onMoreReactions(e.clientY);
            }}
            onMouseEnter={() => setHoveredAction('emoji')}
            className={iconButtonClass}
          >
            <Icon name="mood-happy" size="md" variant="filled" className="xl:hidden" />
            <Icon name="mood-happy" size="lg" variant="filled" className="hidden xl:block" />
          </div>

          {/* Separator */}
          <div className={separatorClass}></div>

          {/* Reply */}
          <div
            onClick={onReply}
            onMouseEnter={() => setHoveredAction('reply')}
            className={iconButtonClassMr}
          >
            <Icon name="reply" size="md" className="xl:hidden" />
            <Icon name="reply" size="lg" className="hidden xl:block" />
          </div>

          {/* Copy link */}
          <div
            onClick={onCopyLink}
            onMouseEnter={() => setHoveredAction('copy')}
            className={iconButtonClassMr}
          >
            <Icon name="link" size="sm" className="xl:hidden" />
            <Icon name="link" size="lg" className="hidden xl:block" />
          </div>

          {/* Copy message */}
          <div
            onClick={onCopyMessageText}
            onMouseEnter={() => setHoveredAction('copyMessage')}
            className={iconButtonClassMr}
          >
            <Icon name="clipboard" size="sm" className="xl:hidden" />
            <Icon name="clipboard" size="lg" className="hidden xl:block" />
          </div>

          {/* Bookmark (right after copy message, no separator before) */}
          {onBookmarkToggle && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkToggle();
              }}
              onMouseEnter={() => setHoveredAction('bookmark')}
              className={iconButtonClass}
            >
              <Icon
                name={isBookmarked ? 'bookmark-off' : 'bookmark'}
                size="md"
                className="xl:hidden"
              />
              <Icon
                name={isBookmarked ? 'bookmark-off' : 'bookmark'}
                size="lg"
                className="hidden xl:block"
              />
            </div>
          )}

          {/* Edit/History section with separator */}
          {(canUserEdit || canViewEditHistory) && (
            <>
              {/* Separator before edit/history section */}
              <div className={separatorClass}></div>

              {/* Edit (if user can edit) */}
              {canUserEdit && onEdit && (
                <div
                  onClick={onEdit}
                  onMouseEnter={() => setHoveredAction('edit')}
                  className={iconButtonClassMr}
                >
                  <Icon name="edit" size="md" className="xl:hidden" />
                  <Icon name="edit" size="lg" className="hidden xl:block" />
                </div>
              )}

              {/* View Edit History (if available) */}
              {canViewEditHistory && onViewEditHistory && (
                <div
                  onClick={onViewEditHistory}
                  onMouseEnter={() => setHoveredAction('history')}
                  className={iconButtonClass}
                >
                  <Icon name="history" size="md" className="xl:hidden" />
                  <Icon name="history" size="lg" className="hidden xl:block" />
                </div>
              )}
            </>
          )}

          {/* Pin (if user can pin) */}
          {canPinMessages && onPin && (
            <>
              <div className={separatorClass}></div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePinClick(e);
                }}
                onMouseEnter={handlePinHover}
                className={iconButtonClass}
              >
                <Icon
                  name={message.isPinned ? 'pin-off' : 'pin'}
                  size="md"
                  className="xl:hidden"
                />
                <Icon
                  name={message.isPinned ? 'pin-off' : 'pin'}
                  size="lg"
                  className="hidden xl:block"
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
                className="text-center transition duration-200 rounded-md flex items-center justify-center cursor-pointer hover:scale-125 xl:hover:scale-150"
              >
                <Icon
                  name="trash"
                  size="md"
                  className="xl:hidden text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))]"
                />
                <Icon
                  name="trash"
                  size="lg"
                  className="hidden xl:block text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))]"
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
