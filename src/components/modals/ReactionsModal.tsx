import React, { useState, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Modal, Text, Flex, ScrollContainer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import type { Reaction } from '../../api/quorumApi';
import type { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';

export interface MemberInfo {
  displayName?: string;
  userIcon?: string;
  address: string;
}

interface ReactionsModalProps {
  visible: boolean;
  onClose: () => void;
  reactions: Reaction[];
  customEmojis: CustomEmoji[];
  members: Record<string, MemberInfo>;
}

export const ReactionsModal: React.FC<ReactionsModalProps> = ({
  visible,
  onClose,
  reactions,
  customEmojis,
  members,
}) => {
  // Default to first reaction tab
  const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);

  // Determine the active emoji ID (first reaction if none selected)
  const activeEmojiId = selectedEmojiId ?? reactions[0]?.emojiId ?? null;

  // Get users for the selected reaction
  const selectedReaction = useMemo(() => {
    return reactions.find((r) => r.emojiId === activeEmojiId);
  }, [reactions, activeEmojiId]);

  // Helper to get user info from member ID
  const getUserInfo = (memberId: string): MemberInfo => {
    const member = members[memberId];
    return {
      displayName: member?.displayName || memberId.slice(0, 8) + '...',
      userIcon: member?.userIcon,
      address: memberId,
    };
  };

  // Map member IDs to user data
  const reactionUsers = useMemo(() => {
    if (!selectedReaction) return [];
    return selectedReaction.memberIds.map((memberId) => getUserInfo(memberId));
  }, [selectedReaction, members]);

  // Find custom emoji image URL
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
                <Text size="sm">{reaction.count}</Text>
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
                <UserAvatar
                  userIcon={user.userIcon}
                  displayName={user.displayName || ''}
                  address={user.address}
                  size={24}
                />
                <Text className="truncate-user-name flex-1 min-w-0">{user.displayName}</Text>
              </Flex>
            ))}
          </Flex>
        </ScrollContainer>
      </Flex>
    </Modal>
  );
};
