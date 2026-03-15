import React, { useState } from 'react';
import { parse as parseEmoji } from '@twemoji/parser';
import type { Message as MessageType } from '@quilibrium/quorum-shared';
import { Tooltip, Icon } from '../primitives';
import { useQuickReactions, useFrequentEmojis } from '../../hooks/business/messages';
import { emojiToUnified } from '../../utils/remarkTwemoji';
import { t } from '@lingui/core/macro';

interface MessageActionsProps {
  message: MessageType;
  userAddress: string;

  onReaction: (emoji: string) => void;
  onReply: () => void;
  onMoreReactions: (clientY: number) => void;
  onDotsClick: (position: { x: number; y: number }) => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  userAddress,
  onReaction,
  onReply,
  onMoreReactions,
  onDotsClick,
}) => {
  // State for tracking which action is currently hovered
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Quick reactions hook
  const { handleQuickReaction } = useQuickReactions({
    userAddress,
    onReaction,
  });

  // Dynamic frequent emojis from emoji picker usage history
  const frequentEmojis = useFrequentEmojis(3);

  // Get tooltip content based on current hovered action
  const getTooltipContent = () => {
    switch (hoveredAction) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'dots':
        return t`More actions`;
      default:
        return '';
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
        place="top"
        disabled={!hoveredAction}
      >
        <div
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
          }}
          onMouseLeave={() => setHoveredAction(null)}
          className="absolute flex flex-row right-4 top-[-10px] px-2 py-1 xl:px-3 xl:py-1.5 bg-tooltip select-none rounded-lg -m-1 border dark:border-0"
        >
          {/* Quick reactions - top 3 most frequently used emojis */}
          {frequentEmojis.map(({ emoji, unified }) => {
            // Resolve Twemoji image path from unified codepoint or native emoji
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
              <div
                key={emoji}
                onClick={() => handleQuickReaction(message, emoji)}
                className={emojiButtonClass}
              >
                {twemojiSrc ? (
                  <img
                    src={twemojiSrc}
                    alt={emoji}
                    width={16}
                    height={16}
                    draggable={false}
                    className="xl:w-[18px] xl:h-[18px]"
                  />
                ) : (
                  emoji
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div className={separatorClass}></div>

          {/* More reactions */}
          <div
            onClick={(e: React.MouseEvent) => {
              onMoreReactions(e.clientY);
            }}
            onMouseEnter={() => setHoveredAction('emoji')}
            className={iconButtonClassMr}
          >
            <Icon name="mood-happy" size="md" variant="filled" className="xl:hidden" />
            <Icon name="mood-happy" size="lg" variant="filled" className="hidden xl:block" />
          </div>

          {/* Reply */}
          <div
            onClick={onReply}
            onMouseEnter={() => setHoveredAction('reply')}
            className={iconButtonClassMr}
          >
            <Icon name="reply" size="md" className="xl:hidden" />
            <Icon name="reply" size="lg" className="hidden xl:block" />
          </div>

          {/* Dots — open context menu */}
          <div
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              // Open menu to the left of the dots icon
              const dotsRect = e.currentTarget.getBoundingClientRect();
              onDotsClick({ x: dotsRect.left - 10, y: dotsRect.top });
            }}
            onMouseEnter={() => setHoveredAction('dots')}
            className={iconButtonClass}
          >
            <Icon name="dots" size="md" className="xl:hidden" />
            <Icon name="dots" size="lg" className="hidden xl:block" />
          </div>
        </div>
      </Tooltip>
    </>
  );
};

export default MessageActions;
