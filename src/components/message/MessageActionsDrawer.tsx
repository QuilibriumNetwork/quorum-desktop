import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faReply,
  faLink,
  faTrash,
  faFaceSmileBeam,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import { Message as MessageType } from '../../api/quorumApi';
import QuickReactionButton from './QuickReactionButton';
import ActionMenuItem from './ActionMenuItem';
import './MessageActionsDrawer.scss';

export interface MessageActionsDrawerProps {
  isOpen: boolean;
  message: MessageType;
  onClose: () => void;
  onReply: () => void;
  onCopyLink: () => void;
  onDelete?: () => void;
  onReaction: (emoji: string) => void;
  onMoreReactions: () => void;
  canDelete?: boolean;
  userAddress: string;
}

/**
 * Mobile drawer component for message actions.
 * Provides touch-friendly interface for message interactions on mobile devices.
 */
const MessageActionsDrawer: React.FC<MessageActionsDrawerProps> = ({
  isOpen,
  message,
  onClose,
  onReply,
  onCopyLink,
  onDelete,
  onReaction,
  onMoreReactions,
  canDelete = false,
  userAddress,
}) => {
  const quickReactions = ['❤️', '👍', '🔥', '😂', '😢', '😮'];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleMoreReactions = () => {
    onMoreReactions();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="message-actions-drawer-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t`Message actions`}
    >
      <div className="message-actions-drawer">
        {/* Close button */}
        <button
          className="message-actions-drawer__close"
          onClick={onClose}
          aria-label={t`Close`}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* Quick reactions row */}
        <div className="message-actions-drawer__quick-reactions">
          <div className="message-actions-drawer__quick-reactions-title">
            {t`Quick reactions`}
          </div>
          <div className="message-actions-drawer__quick-reactions-list">
            {quickReactions.map((emoji) => (
              <QuickReactionButton
                key={emoji}
                emoji={emoji}
                message={message}
                userAddress={userAddress}
                onClick={() => handleReaction(emoji)}
              />
            ))}
          </div>
        </div>

        {/* Actions menu */}
        <div className="message-actions-drawer__actions">
          <ActionMenuItem
            icon={faReply}
            label={t`Reply`}
            onClick={handleReply}
          />
          
          <ActionMenuItem
            icon={faLink}
            label={t`Copy message link`}
            onClick={handleCopyLink}
          />
          
          <ActionMenuItem
            icon={faFaceSmileBeam}
            label={t`More reactions`}
            onClick={handleMoreReactions}
          />

          {canDelete && (
            <ActionMenuItem
              icon={faTrash}
              label={t`Delete message`}
              onClick={handleDelete}
              variant="danger"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageActionsDrawer;