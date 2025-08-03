import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFaceSmileBeam,
  faReply,
  faTrash,
  faLink,
} from '@fortawesome/free-solid-svg-icons';
import { Message as MessageType } from '../../api/quorumApi';
import ReactTooltip from '../ReactTooltip';
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
  isVisible: boolean; // Add visibility condition
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  userAddress,
  canUserDelete,
  height,
  onReaction,
  onReply,
  onCopyLink,
  onDelete,
  onMoreReactions,
  copiedLinkId,
  isVisible,
}) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Quick reaction handler
  const handleQuickReaction = (emoji: string) => {
    if (
      !message.reactions
        ?.find((r) => r.emojiId === emoji)
        ?.memberIds.includes(userAddress)
    ) {
      onReaction(emoji);
    }
  };

  // Tooltip content mapping function
  const getTooltipContent = (action: string | null) => {
    switch (action) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'copy':
        return copiedLinkId === message.messageId
          ? t`Copied!`
          : t`Copy message link`;
      case 'delete':
        return t`Delete message`;
      default:
        return '';
    }
  };

  // Get the correct anchor ID for each action
  const getTooltipAnchorId = (action: string | null) => {
    switch (action) {
      case 'emoji':
        return `#emoji-tooltip-icon-${message.messageId}`;
      case 'reply':
        return `#reply-tooltip-icon-${message.messageId}`;
      case 'copy':
        return `#copy-link-tooltip-icon-${message.messageId}`;
      case 'delete':
        return `#delete-tooltip-icon-${message.messageId}`;
      default:
        return '';
    }
  };

  // Get the correct placement for each action
  const getTooltipPlacement = (action: string | null) => {
    switch (action) {
      case 'delete':
        return 'top-end'; // Delete is at the right edge, so expand left
      default:
        return 'top'; // All others open above and center
    }
  };

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          return false;
        }}
        className="absolute flex flex-row right-4 top-[-10px] p-1 bg-tooltip select-none shadow-lg rounded-lg"
      >
        {/* Quick reactions */}
        <div
          onClick={() => handleQuickReaction('❤️')}
          className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
        >
          ❤️
        </div>
        <div
          onClick={() => handleQuickReaction('👍')}
          className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
        >
          👍
        </div>
        <div
          onClick={() => handleQuickReaction('🔥')}
          className="w-5 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125 transition duration-200"
        >
          🔥
        </div>

        {/* Separator */}
        <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>

        {/* More reactions */}
        <div
          id={`emoji-tooltip-icon-${message.messageId}`}
          onClick={(e) => {
            onMoreReactions(e.clientY);
          }}
          onMouseEnter={() => setHoveredAction('emoji')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-5 mr-2 text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
        >
          <FontAwesomeIcon icon={faFaceSmileBeam} />
        </div>

        {/* Reply */}
        <div
          id={`reply-tooltip-icon-${message.messageId}`}
          onClick={onReply}
          onMouseEnter={() => setHoveredAction('reply')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-5 mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
        >
          <FontAwesomeIcon icon={faReply} />
        </div>

        {/* Copy link */}
        <div
          id={`copy-link-tooltip-icon-${message.messageId}`}
          onClick={onCopyLink}
          onMouseEnter={() => setHoveredAction('copy')}
          onMouseLeave={() => setHoveredAction(null)}
          className="w-5 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
        >
          <FontAwesomeIcon icon={faLink} />
        </div>

        {/* Delete (if user can delete) */}
        {canUserDelete && (
          <>
            <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
            <div
              id={`delete-tooltip-icon-${message.messageId}`}
              onClick={onDelete}
              onMouseEnter={() => setHoveredAction('delete')}
              onMouseLeave={() => setHoveredAction(null)}
              className="w-5 text-center transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
            >
              <FontAwesomeIcon
                icon={faTrash}
                className="text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))] hover:scale-125"
              />
            </div>
          </>
        )}
      </div>

      {/* Shared tooltip for all action icons to avoid flashing issues */}
      {isVisible && hoveredAction && (
        <ReactTooltip
          id={`shared-action-tooltip-${message.messageId}`}
          content={getTooltipContent(hoveredAction)}
          place={getTooltipPlacement(hoveredAction) as any}
          anchorSelect={getTooltipAnchorId(hoveredAction)}
        />
      )}
    </>
  );
};

export default MessageActions;