import React, { useMemo } from 'react';
import { i18n } from '@lingui/core';
import { parse as parseEmoji } from '@twemoji/parser';
import { Flex, Tooltip } from '../primitives';
import { useReactionsModal } from '../context/ReactionsModalProvider';
import { isTouchDevice } from '../../utils/platform';
import { emojiToUnified } from '../../utils/remarkTwemoji';
import type { Message as MessageType } from '../../api/quorumApi';
import type { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import type { MemberInfo } from '../modals/ReactionsModal';

/**
 * Render a standard (non-custom) emoji as a Twemoji image.
 * Validates via @twemoji/parser to ensure only real emojis produce image paths.
 * Falls back to raw text if the parser doesn't recognize it.
 */
function renderTwemoji(emojiText: string, size: number, className?: string) {
  const entities = parseEmoji(emojiText);
  if (entities.length === 0) {
    return <span style={{ fontSize: size }} className={className}>{emojiText}</span>;
  }
  const unified = emojiToUnified(entities[0].text);
  return (
    <img
      src={`/twitter/64/${unified}.png`}
      alt={emojiText}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}

interface ReactionsListProps {
  message: MessageType;
  userAddress: string;
  customEmojis: CustomEmoji[];
  mapSenderToUser: (senderId: string) => { displayName?: string; userIcon?: string } | undefined;
  onReactionClick: (emojiId: string) => void;
}

export const ReactionsList: React.FC<ReactionsListProps> = ({
  message,
  userAddress,
  customEmojis,
  mapSenderToUser,
  onReactionClick,
}) => {
  const { showReactionsModal } = useReactionsModal();
  const isTouch = isTouchDevice();

  // Build members record for all users who reacted (for modal)
  const members = useMemo(() => {
    if (!message.reactions) return {};
    const memberRecord: Record<string, MemberInfo> = {};
    message.reactions.forEach((r) => {
      r.memberIds.forEach((id) => {
        if (!memberRecord[id]) {
          const user = mapSenderToUser(id);
          memberRecord[id] = {
            displayName: user?.displayName,
            userIcon: user?.userIcon,
            address: id,
          };
        }
      });
    });
    return memberRecord;
  }, [message.reactions, mapSenderToUser]);

  const handleShowAllReactions = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Hide tooltip by removing hover state - find and hide all visible tooltips
    document.querySelectorAll('[role="tooltip"]').forEach((el) => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.visibility = 'hidden';
    });

    if (message.reactions) {
      showReactionsModal({
        reactions: message.reactions,
        customEmojis,
        members,
      });
    }
  };

  if (!message.reactions?.length) return null;

  return (
    <Flex className="flex-wrap pt-1 -mr-1">
      {message.reactions.map((r) => {
        // Build tooltip content showing who reacted
        const maxNames = 3;
        const reactorNames = r.memberIds
          .map((id) => {
            const name = mapSenderToUser(id)?.displayName || id.slice(0, 8) + '...';
            // Truncate long names in tooltip (max ~20 chars)
            return name.length > 20 ? name.slice(0, 18) + '...' : name;
          })
          .slice(0, maxNames);
        const remaining = r.memberIds.length - maxNames;
        const hasMore = remaining > 0;

        // Look up custom emoji once and reuse for both tooltip and badge
        const customEmoji = customEmojis.find((e) => e.id === r.emojiName);
        const emojiElement = customEmoji ? (
          <img src={customEmoji.imgUrl} alt={r.emojiName} width={36} height={36} />
        ) : (
          renderTwemoji(r.emojiName, 36)
        );

        // On desktop, make "+X more" clickable; on touch, just show text
        const namesList = reactorNames.join(', ') + (hasMore ? ` +${remaining} ${i18n._('more')}` : '');
        const tooltipContent = isTouch ? (
          `${i18n._('Reacted by')}: ${namesList}`
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">{emojiElement}</div>
            <span>
              <span className="!text-subtle">{i18n._('Reacted by')}:</span>{' '}
              {reactorNames.join(', ')}
              {hasMore && (
                <span
                  className="link ml-1"
                  onClick={handleShowAllReactions}
                >
                  +{remaining} {i18n._('more')}
                </span>
              )}
            </span>
          </div>
        );

        // Enable clickable tooltip on desktop when there's a "+X more" link
        const needsClickable = !isTouch && hasMore;

        return (
          <Tooltip
            key={message.messageId + '-reactions-' + r.emojiId}
            id={`reaction-${message.messageId}-${r.emojiId}`}
            content={tooltipContent}
            showOnTouch={true}
            touchTrigger="long-press"
            longPressDuration={500}
            autoHideAfter={3000}
            clickable={needsClickable}
            variant={isTouch ? 'simple' : 'rich'}
          >
            <Flex
              className={
                'cursor-pointer items-center mr-1 mb-1 rounded-lg py-1 px-2 whitespace-nowrap ' +
                (r.memberIds.includes(userAddress)
                  ? 'bg-accent-rgb/30 hover:bg-accent-rgb/60 border border-accent'
                  : 'bg-surface-5 hover:bg-surface-00 border border-surface-5 hover:border-surface-00')
              }
              onClick={() => {
                onReactionClick(r.emojiId);
              }}
            >
              {customEmoji ? (
                <img
                  width="18"
                  height="18"
                  className="mr-1"
                  src={customEmoji.imgUrl}
                  alt={r.emojiName}
                />
              ) : (
                renderTwemoji(r.emojiName, 18, 'mr-1')
              )}
              <span className="text-sm font-bold text-subtle">{r.count}</span>
            </Flex>
          </Tooltip>
        );
      })}
    </Flex>
  );
};
