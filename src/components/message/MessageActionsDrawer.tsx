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
        <Button
          type="unstyled"
          onClick={handleMoreReactions}
          iconName="mood-happy"
          iconOnly
          className="quick-reaction-more"
        />
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
      <div className="mobile-drawer__padded-content">
        {/* Actions menu */}
        <div className="message-actions-drawer__actions">
        <Button
          type="unstyled"
          size="normal"
          onClick={handleReply}
          iconName="reply"
          fullWidth
          className="action-menu-item"
        >
          {t`Reply`}
        </Button>

        <Button
          type="unstyled"
          size="normal"
          onClick={handleCopyLink}
          iconName="link"
          fullWidth
          className="action-menu-item"
        >
          {t`Copy message link`}
        </Button>

        {canEdit && onEdit && (
          <Button
            type="unstyled"
            size="normal"
            onClick={handleEdit}
            iconName="edit"
            fullWidth
            className="action-menu-item"
          >
            {t`Edit message`}
          </Button>
        )}

        {canViewEditHistory && onViewEditHistory && (
          <Button
            type="unstyled"
            size="normal"
            onClick={handleViewEditHistory}
            iconName="history"
            fullWidth
            className="action-menu-item"
          >
            {t`View edit history`}
          </Button>
        )}

        {canPinMessages && onPin && (
          <Button
            type="unstyled"
            size="normal"
            onClick={handlePin}
            iconName={message.isPinned ? "pin-off" : "pin"}
            fullWidth
            className={`action-menu-item ${
              message.isPinned ? 'action-menu-item--danger' : ''
            }`}
          >
            {message.isPinned ? t`Unpin message` : t`Pin message`}
          </Button>
        )}

        {canDelete && (
          <Button
            type="unstyled"
            size="normal"
            onClick={handleDelete}
            iconName="trash"
            fullWidth
            className="action-menu-item action-menu-item--danger"
          >
            {t`Delete message`}
          </Button>
        )}
        </div>
      </div>
    </MobileDrawer>
  );
};

export default MessageActionsDrawer;
