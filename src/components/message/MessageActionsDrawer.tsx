import React, { useState } from 'react';
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
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Handle visibility changes with animation
  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      // Wait for animation to complete before hiding
      setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // Match CSS animation duration
    }
  }, [isOpen, shouldRender]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    handleClose();
  };

  const handleReply = () => {
    onReply();
    handleClose();
  };

  const handleCopyLink = () => {
    onCopyLink();
    handleClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      handleClose();
    }
  };

  const handleMoreReactions = () => {
    onMoreReactions();
    handleClose();
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`message-actions-drawer ${isOpen && !isClosing ? 'message-actions-drawer--open' : ''} ${isClosing ? 'message-actions-drawer--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t`Message actions`}
    >
        {/* Close button */}
        <button
          className="message-actions-drawer__close"
          onClick={handleClose}
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
  );
};

export default MessageActionsDrawer;