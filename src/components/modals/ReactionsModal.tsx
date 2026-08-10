import React, { useState, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { parse as parseEmoji } from '@twemoji/parser';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Modal, Flex, ScrollContainer } from '../primitives';
import { MemberName, IdentityScopeProvider } from '../../identity';
import { useMultiSpaceRosters } from '../../hooks/business/identity';
import { emojiToUnified } from '../../utils/remarkTwemoji';
import type { Reaction } from '@quilibrium/quorum-shared';
import type { CustomEmoji } from '../emoji-picker/types';

export interface MemberInfo {
  userIcon?: string;
  address: string;
}

interface ReactionsModalProps {
  visible: boolean;
  onClose: () => void;
  reactions: Reaction[];
  customEmojis: CustomEmoji[];
  members: Record<string, MemberInfo>;
  /** The Space the reacted-to message lives in. `ReactionsModal` is mounted
   *  from `Layout.tsx` as a sibling of the app shell — there is no ambient
   *  `<IdentityScopeProvider>` — so it mounts its own below, scoped to this
   *  one message's space, rather than relying on ambient scope. */
  spaceId: string;
}

export const ReactionsModal: React.FC<ReactionsModalProps> = ({
  visible,
  onClose,
  reactions,
  customEmojis,
  members,
  spaceId,
}) => {
  const user = usePasskeysContext();
  const selfAddress = user?.currentPasskeyInfo?.address || null;
  const spaceIds = useMemo(() => [spaceId], [spaceId]);
  const rostersBySpace = useMultiSpaceRosters(spaceIds);

  return (
    <IdentityScopeProvider rostersBySpace={rostersBySpace} selfAddress={selfAddress}>
      <ReactionsModalInner
        visible={visible}
        onClose={onClose}
        reactions={reactions}
        customEmojis={customEmojis}
        members={members}
        spaceId={spaceId}
      />
    </IdentityScopeProvider>
  );
};

const ReactionsModalInner: React.FC<ReactionsModalProps> = ({
  visible,
  onClose,
  reactions,
  customEmojis,
  members,
  spaceId,
}) => {
  // Default to first reaction tab
  const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);

  // Determine the active emoji ID (first reaction if none selected)
  const activeEmojiId = selectedEmojiId ?? reactions[0]?.emojiId ?? null;

  // Get users for the selected reaction
  const selectedReaction = useMemo(() => {
    return reactions.find((r) => r.emojiId === activeEmojiId);
  }, [reactions, activeEmojiId]);

  // The reacted-to message's memberIds, resolved through src/identity —
  // spaceId is passed explicitly (see ReactionsModalProps.spaceId) rather
  // than an ambient scope, since this detached surface has none of its own.
  // `enrich`: a bounded set of reactors on ONE message.
  const reactionUsers = useMemo(() => {
    if (!selectedReaction) return [];
    return selectedReaction.memberIds.map((memberId) => ({
      address: memberId,
      userIcon: members[memberId]?.userIcon,
    }));
  }, [selectedReaction, members]);

  // Render emoji as Twemoji image or custom emoji
  const getEmojiDisplay = (reaction: Reaction) => {
    const customEmoji = customEmojis.find((e) => e.id === reaction.emojiName);
    if (customEmoji) {
      return (
        <img
          src={customEmoji.imgUrl}
          alt={reaction.emojiName}
          className="w-6 h-6 object-contain"
        />
      );
    }
    const entities = parseEmoji(reaction.emojiName);
    if (entities.length > 0) {
      const unified = emojiToUnified(entities[0].text);
      return (
        <img
          src={`/twitter/64/${unified}.png`}
          alt={reaction.emojiName}
          width={24}
          height={24}
          className="twemoji"
          draggable={false}
        />
      );
    }
    return <span className="text-lg">{reaction.emojiName}</span>;
  };

  return (
    <Modal
      title={t`Reactions`}
      visible={visible}
      onClose={onClose}
      size="small"
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <Flex className="items-stretch">
        {/* Left column: Reaction tabs (scrollable for long lists) */}
        <ScrollContainer height="250px" showBorder={false} className="flex-shrink-0 pr-3 border-r border-surface-5">
          <Flex direction="column" gap="xs">
            {reactions.map((reaction) => (
              <Flex
                key={reaction.emojiId}
                className={`cursor-pointer items-center gap-1 py-[1pt] px-2 rounded-lg whitespace-nowrap ${
                  activeEmojiId === reaction.emojiId
                    ? 'bg-accent-rgb/30 border border-accent'
                    : 'bg-surface-5 hover:bg-surface-00 border border-surface-5 hover:border-surface-00'
                }`}
                onClick={() => setSelectedEmojiId(reaction.emojiId)}
              >
                {getEmojiDisplay(reaction)}
                <span className="text-label">{reaction.count}</span>
              </Flex>
            ))}
          </Flex>
        </ScrollContainer>

        {/* Right column: Users who reacted (scrollable for long lists) */}
        <ScrollContainer height="250px" showBorder={false} className="flex-1 pl-3">
          <Flex direction="column" gap="none" className="justify-start">
            {reactionUsers.map((user) => (
              <Flex
                key={user.address}
                className="items-center gap-2 py-1 min-w-0"
              >
                <MemberName
                  address={user.address}
                  spaceId={spaceId}
                  enrich
                  withAvatar
                  avatarSize={24}
                  userIcon={user.userIcon}
                  className="truncate-user-name flex-1 min-w-0"
                />
              </Flex>
            ))}
          </Flex>
        </ScrollContainer>
      </Flex>
    </Modal>
  );
};
