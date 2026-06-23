import React, { useMemo } from 'react';
import { parse as parseEmoji } from '@twemoji/parser';
import { t } from '@lingui/core/macro';
import type { Message as MessageType } from '@quilibrium/quorum-shared';
import { Button, Icon } from '../primitives';
import { FloatingPopover, rectAnchor } from '../ui';
import { useFrequentEmojis } from '../../hooks/business/messages';
import { emojiToUnified } from '../../utils/remarkTwemoji';
import './MessageActionsMenu.scss';

// Delay for copy actions to show "Copied!" feedback
const COPY_CLOSE_DELAY = 500;

export interface MessageActionsMenuProps {
  message: MessageType;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: () => void;
  onCopyLink: () => void;
  onCopyMessageText: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onPin?: (e: React.MouseEvent) => void;
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
  hasThread?: boolean;
  onStartThread?: () => void;
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
  hasThread = false,
  onStartThread,
}) => {
  // Virtual reference at the click point. FloatingPopover's flip()/shift()
  // handle the edge cases the old calculatePosition() did by hand (flip-left on
  // right overflow, clamp-up on bottom overflow) — against the real menu size.
  const reference = useMemo(
    () => rectAnchor({ x: position.x, y: position.y }),
    [position.x, position.y]
  );

  // Dynamic frequent emojis from emoji picker usage history
  const frequentEmojis = useFrequentEmojis(3);

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

  const handlePin = (e: React.MouseEvent) => {
    if (onPin) {
      onPin(e);
      onClose();
    }
  };

  const handleBookmarkToggle = () => {
    if (onBookmarkToggle) {
      onBookmarkToggle();
      onClose();
    }
  };

  const handleStartThread = () => {
    if (onStartThread) {
      onStartThread();
      onClose();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    if (onDelete) {
      onDelete(e);
      onClose();
    }
  };

  const handleMoreReactions = () => {
    onMoreReactions();
  };

  return (
    <FloatingPopover
      open
      onClose={onClose}
      anchor={reference}
      // Opens down-and-right from the click point; flips left/up near edges.
      placement="bottom-start"
      gap={0}
      role="menu"
      // Anchored to a fixed point inside the virtualized message list — close
      // on scroll like the other in-list surfaces rather than chase the point.
      closeOnScroll
      // The menu's open animation scales via transform — position via top/left
      // so it doesn't fight floating-ui's positioning transform.
      positionViaLayout
      className="message-actions-menu"
    >
      {/* Quick reactions row */}
        <div className="message-actions-menu__reactions">
          {frequentEmojis.map(({ emoji, unified }) => {
            let twemojiSrc: string | null = null;
            if (unified) {
              twemojiSrc = `/twitter/64/${unified}.png`;
            } else {
              const entities = parseEmoji(emoji);
              if (entities.length > 0) {
                twemojiSrc = `/twitter/64/${emojiToUnified(entities[0].text)}.png`;
              }
            }

            return (
              <Button
                key={emoji}
                type="unstyled"
                onClick={() => handleReaction(emoji)}
                className={`message-actions-menu__reaction ${
                  hasReacted(emoji) ? 'message-actions-menu__reaction--active' : ''
                }`}
              >
                {twemojiSrc ? (
                  <img
                    src={twemojiSrc}
                    alt={emoji}
                    width={16}
                    height={16}
                    draggable={false}
                  />
                ) : (
                  emoji
                )}
              </Button>
            );
          })}
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
          <button onClick={handleReply} className="message-actions-menu__item">
            <Icon name="reply" size="sm" />
            {t`Reply`}
          </button>

          {onStartThread && (
            <button onClick={handleStartThread} className="message-actions-menu__item">
              <Icon name="messages" size="sm" />
              {hasThread ? t`View Thread` : t`Start Thread`}
            </button>
          )}

          <button onClick={handleCopyLink} className="message-actions-menu__item">
            <Icon name="link" size="sm" />
            {copiedLinkId === message.messageId ? t`Copied!` : t`Copy link`}
          </button>

          <button onClick={handleCopyMessageText} className="message-actions-menu__item">
            <Icon name="clipboard" size="sm" />
            {copiedMessageText ? t`Copied!` : t`Copy message`}
          </button>

          {canEdit && onEdit && (
            <button onClick={handleEdit} className="message-actions-menu__item">
              <Icon name="edit" size="sm" />
              {t`Edit`}
            </button>
          )}

          {canViewEditHistory && onViewEditHistory && (
            <button onClick={handleViewEditHistory} className="message-actions-menu__item">
              <Icon name="history" size="sm" />
              {t`Edit history`}
            </button>
          )}

          {onBookmarkToggle && (
            <button onClick={handleBookmarkToggle} className="message-actions-menu__item">
              <Icon name={isBookmarked ? 'bookmark-off' : 'bookmark'} size="sm" />
              {isBookmarked ? t`Remove bookmark` : t`Bookmark`}
            </button>
          )}

          {canPinMessages && onPin && (
            <button onClick={handlePin} className="message-actions-menu__item">
              <Icon name={message.isPinned ? 'pin-off' : 'pin'} size="sm" />
              {message.isPinned ? t`Unpin` : t`Pin`}
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              className="message-actions-menu__item message-actions-menu__item--danger"
            >
              <Icon name="trash" size="sm" />
              {t`Delete`}
            </button>
          )}
        </div>
    </FloatingPopover>
  );
};

export default MessageActionsMenu;
