import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faReply,
  faLink,
  faTrash,
  faFaceSmileBeam,
} from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import { Message as MessageType } from '../../api/quorumApi';
import MobileDrawer from '../MobileDrawer';
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

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t`Message actions`}
      showCloseButton={false}
    >
      {/* Quick reactions row */}
      <div className="message-actions-drawer__quick-reactions">
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
          {/* More reactions button as smile icon */}
          <button
            className="quick-reaction-button quick-reaction-button--more"
            onClick={handleMoreReactions}
            aria-label={t`More reactions`}
          >
            <FontAwesomeIcon 
              icon={faFaceSmileBeam} 
              className="quick-reaction-button__more-icon"
            />
          </button>
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

        {canDelete && (
          <ActionMenuItem
            icon={faTrash}
            label={t`Delete message`}
            onClick={handleDelete}
            variant="danger"
          />
        )}
      </div>
    </MobileDrawer>
  );
};

export default MessageActionsDrawer;