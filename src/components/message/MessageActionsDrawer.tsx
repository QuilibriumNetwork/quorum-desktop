import React from 'react';
import { t } from '@lingui/core/macro';
import { Message as MessageType } from '../../api/quorumApi';
import { MobileDrawer } from '../ui';
import { Button, Icon, Text } from '../primitives';
import './MessageActionsDrawer.scss';

export interface MessageActionsDrawerProps {
  isOpen: boolean;
  message: MessageType;
  onClose: () => void;
  onReply: () => void;
  onCopyLink: () => void;
  onCopyMessageText: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReaction: (emoji: string) => void;
  onMoreReactions: () => void;
  onEdit?: () => void;
  onViewEditHistory?: () => void;
  canDelete?: boolean;
  canEdit?: boolean;
  canViewEditHistory?: boolean;
  canPinMessages?: boolean;
  userAddress: string;
  onDeleteWithConfirmation?: () => void;
  onPinWithConfirmation?: () => void;
  // Bookmark props
  isBookmarked?: boolean;
  isBookmarkPending?: boolean;
  canAddBookmark?: boolean;
  onBookmarkToggle?: () => void;
}

/**
 * Mobile drawer component for message actions.
 * Provides touch-friendly interface for message interactions on mobile devices.  Used for the web app when visited via touch devices.
 */
const MessageActionsDrawer: React.FC<MessageActionsDrawerProps> = ({
  isOpen,
  message,
  onClose,
  onReply,
  onCopyLink,
  onCopyMessageText,
  onDelete,
  onPin,
  onReaction,
  onMoreReactions,
  onEdit,
  onViewEditHistory,
  canDelete = false,
  canEdit = false,
  canViewEditHistory = false,
  canPinMessages = false,
  userAddress,
  onDeleteWithConfirmation,
  onPinWithConfirmation,
  // Bookmark props
  isBookmarked = false,
  isBookmarkPending = false,
  canAddBookmark = true,
  onBookmarkToggle,
}) => {
  const quickReactions = ['❤️', '👍', '🔥', '😂', '😢', '😮'];

  // Check if the user has reacted with a specific emoji
  const hasReacted = (emoji: string) => {
    return message.reactions
      ?.find((r) => r.emojiId === emoji)
      ?.memberIds.includes(userAddress) || false;
  };

  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    onClose();
  };

  const handleReply = () => {
    onReply();
    onClose();
  };

  const handleCopyLink = () => {
    onCopyLink();
    onClose();
  };

  const handleCopyMessageText = () => {
    onCopyMessageText();
    onClose();
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
      onClose();
    }
  };

  const handleViewEditHistory = () => {
    if (onViewEditHistory) {
      onViewEditHistory();
      onClose();
    }
  };

  const handleDelete = () => {
    // Use the confirmation callback if provided, otherwise use direct delete
    if (onDeleteWithConfirmation) {
      onDeleteWithConfirmation();
      onClose();
    } else if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handlePin = () => {
    // Use the confirmation callback if provided, otherwise use direct pin
    if (onPinWithConfirmation) {
      onPinWithConfirmation();
      onClose();
    } else if (onPin) {
      onPin();
      onClose();
    }
  };

  const handleBookmarkToggle = () => {
    if (onBookmarkToggle && !isBookmarkPending && (canAddBookmark || isBookmarked)) {
      onBookmarkToggle();
      onClose();
    }
  };

  const handleMoreReactions = () => {
    onMoreReactions();
    // Don't call onClose() - the MobileProvider automatically closes this drawer
    // when OPEN_EMOJI_PICKER action is dispatched
  };

  // Quick reactions as header content
  const reactionsContent = (
    <div className="message-actions-drawer__reactions">
      <div className="message-actions-drawer__reactions-row">
        {quickReactions.map((emoji) => (
          <Button
            key={emoji}
            type="unstyled"
            onClick={() => handleReaction(emoji)}
            className={`quick-reaction-emoji ${
              hasReacted(emoji) ? 'quick-reaction-emoji--active' : ''
            }`}
          >
            {emoji}
          </Button>
        ))}
        {/* More reactions button with dashed circle */}
        <div
          onClick={handleMoreReactions}
          className="quick-reaction-more"
        >
          <Icon
            name="mood-happy"
            size="lg"
            variant="filled"
            color="var(--color-text-subtle)"
          />
        </div>
      </div>
    </div>
  );

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t`Message actions`}
      showCloseButton={false}
      headerContent={reactionsContent}
    >
      {/* Actions menu using new grouped layout */}
      <div className="mobile-drawer__action-group">
        <div
          onClick={handleReply}
          className="mobile-drawer__action-item"
        >
          <Icon name="reply" />
          <Text>{t`Reply`}</Text>
        </div>

        <div
          onClick={handleCopyLink}
          className="mobile-drawer__action-item"
        >
          <Icon name="link" />
          <Text>{t`Copy message link`}</Text>
        </div>

        <div
          onClick={handleCopyMessageText}
          className="mobile-drawer__action-item"
        >
          <Icon name="clipboard" />
          <Text>{t`Copy message`}</Text>
        </div>

        {canEdit && onEdit && (
          <div
            onClick={handleEdit}
            className="mobile-drawer__action-item"
          >
            <Icon name="edit" />
            <Text>{t`Edit message`}</Text>
          </div>
        )}

        {canViewEditHistory && onViewEditHistory && (
          <div
            onClick={handleViewEditHistory}
            className="mobile-drawer__action-item"
          >
            <Icon name="history" />
            <Text>{t`View edit history`}</Text>
          </div>
        )}

        {canPinMessages && onPin && (
          <div
            onClick={handlePin}
            className="mobile-drawer__action-item"
          >
            <Icon name={message.isPinned ? "pin-off" : "pin"} />
            <Text>{message.isPinned ? t`Unpin message` : t`Pin message`}</Text>
          </div>
        )}

        {onBookmarkToggle && (
          <div
            onClick={handleBookmarkToggle}
            className={`mobile-drawer__action-item ${
              isBookmarkPending || (!canAddBookmark && !isBookmarked) ? 'opacity-50' : ''
            }`}
          >
            <Icon
              name={isBookmarked ? 'bookmark-off' : 'bookmark'}
              className={isBookmarkPending ? 'animate-pulse' : ''}
            />
            <Text>
              {isBookmarkPending
                ? t`Processing...`
                : isBookmarked
                ? t`Remove bookmark`
                : t`Bookmark message`}
            </Text>
          </div>
        )}

        {canDelete && (
          <div
            onClick={handleDelete}
            className="mobile-drawer__action-item"
            style={{ color: 'rgb(var(--danger))' }}
          >
            <Icon name="trash" />
            <Text>{t`Delete message`}</Text>
          </div>
        )}
      </div>
    </MobileDrawer>
  );
};

export default MessageActionsDrawer;
