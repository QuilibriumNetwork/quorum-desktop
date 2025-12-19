import React, { useRef, useEffect, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Message as MessageType } from '../../api/quorumApi';
import { Portal, Button, Icon, Text } from '../primitives';
import { useClickOutside } from '../../hooks/useClickOutside';
import './MessageActionsMenu.scss';

// Fixed dimensions for viewport edge detection
const MENU_WIDTH = 240;
const MENU_HEIGHT = 320;
const PADDING = 8;

// Delay for copy actions to show "Copied!" feedback
const COPY_CLOSE_DELAY = 500;

export interface MessageActionsMenuProps {
  message: MessageType;
  position: { x: number; y: number };
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
  copiedLinkId: string | null;
  copiedMessageText: boolean;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
}

function calculatePosition(clickX: number, clickY: number) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const flipX = clickX + MENU_WIDTH + PADDING > viewportW;
  const flipY = clickY + MENU_HEIGHT + PADDING > viewportH;

  return {
    x: flipX ? Math.max(PADDING, clickX - MENU_WIDTH) : clickX,
    y: flipY ? Math.max(PADDING, clickY - MENU_HEIGHT) : clickY,
  };
}

const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  message,
  position,
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
  copiedLinkId,
  copiedMessageText,
  isBookmarked = false,
  onBookmarkToggle,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(() =>
    calculatePosition(position.x, position.y)
  );

  const quickReactions = ['❤️', '👍', '🔥'];

  // Click outside to close
  useClickOutside(menuRef, onClose, true);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on scroll (any scroll in capture phase)
  // Uses close-once guard to prevent onClose firing hundreds of times per scroll gesture
  useEffect(() => {
    let hasClosed = false;
    const handleScroll = () => {
      if (hasClosed) return;
      hasClosed = true;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  // Recalculate position if it changes
  useEffect(() => {
    setAdjustedPosition(calculatePosition(position.x, position.y));
  }, [position.x, position.y]);

  // Check if the user has reacted with a specific emoji
  const hasReacted = (emoji: string) => {
    return (
      message.reactions
        ?.find((r) => r.emojiId === emoji)
        ?.memberIds.includes(userAddress) || false
    );
  };

  // Handlers with appropriate close timing
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
    // Delayed close to show "Copied!" feedback
    setTimeout(onClose, COPY_CLOSE_DELAY);
  };

  const handleCopyMessageText = () => {
    onCopyMessageText();
    // Delayed close to show "Copied!" feedback
    setTimeout(onClose, COPY_CLOSE_DELAY);
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

  const handlePin = () => {
    if (onPin) {
      onPin();
      onClose();
    }
  };

  const handleBookmarkToggle = () => {
    if (onBookmarkToggle) {
      onBookmarkToggle();
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleMoreReactions = () => {
    onMoreReactions();
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        className="message-actions-menu"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {/* Quick reactions row */}
        <div className="message-actions-menu__reactions">
          {quickReactions.map((emoji) => (
            <Button
              key={emoji}
              type="unstyled"
              onClick={() => handleReaction(emoji)}
              className={`message-actions-menu__reaction ${
                hasReacted(emoji) ? 'message-actions-menu__reaction--active' : ''
              }`}
            >
              {emoji}
            </Button>
          ))}
          <Button
            type="unstyled"
            onClick={handleMoreReactions}
            className="message-actions-menu__reaction message-actions-menu__reaction--more"
          >
            <Icon name="mood-happy" size="md" variant="filled" />
          </Button>
        </div>

        {/* Divider */}
        <div className="message-actions-menu__divider" />

        {/* Action items */}
        <div className="message-actions-menu__actions">
          <div onClick={handleReply} className="message-actions-menu__item">
            <Icon name="reply" size="sm" />
            <Text size="sm">{t`Reply`}</Text>
          </div>

          <div onClick={handleCopyLink} className="message-actions-menu__item">
            <Icon name="link" size="sm" />
            <Text size="sm">
              {copiedLinkId === message.messageId ? t`Copied!` : t`Copy link`}
            </Text>
          </div>

          <div onClick={handleCopyMessageText} className="message-actions-menu__item">
            <Icon name="clipboard" size="sm" />
            <Text size="sm">
              {copiedMessageText ? t`Copied!` : t`Copy message`}
            </Text>
          </div>

          {canEdit && onEdit && (
            <div onClick={handleEdit} className="message-actions-menu__item">
              <Icon name="edit" size="sm" />
              <Text size="sm">{t`Edit`}</Text>
            </div>
          )}

          {canViewEditHistory && onViewEditHistory && (
            <div onClick={handleViewEditHistory} className="message-actions-menu__item">
              <Icon name="history" size="sm" />
              <Text size="sm">{t`Edit history`}</Text>
            </div>
          )}

          {onBookmarkToggle && (
            <div onClick={handleBookmarkToggle} className="message-actions-menu__item">
              <Icon name={isBookmarked ? 'bookmark-off' : 'bookmark'} size="sm" />
              <Text size="sm">
                {isBookmarked ? t`Remove bookmark` : t`Bookmark`}
              </Text>
            </div>
          )}

          {canPinMessages && onPin && (
            <div onClick={handlePin} className="message-actions-menu__item">
              <Icon name={message.isPinned ? 'pin-off' : 'pin'} size="sm" />
              <Text size="sm">
                {message.isPinned ? t`Unpin` : t`Pin`}
              </Text>
            </div>
          )}

          {canDelete && (
            <div
              onClick={handleDelete}
              className="message-actions-menu__item message-actions-menu__item--danger"
            >
              <Icon name="trash" size="sm" />
              <Text size="sm">{t`Delete`}</Text>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default MessageActionsMenu;
