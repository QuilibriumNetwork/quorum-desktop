import { isMentionedWithSettings, getDefaultNotificationSettings } from '@quilibrium/quorum-shared';
import type { Message, Space } from '@quilibrium/quorum-shared';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { MessageDB } from '../../../db/messages';
import type { MentionNotification } from './useAllMentions';

function getMentionType(message: Message, userAddress: string): 'you' | 'everyone' | 'roles' {
  if (message.mentions?.everyone) return 'everyone';
  if (message.mentions?.roleIds?.length && message.mentions.roleIds.length > 0) return 'roles';
  if (message.mentions?.memberIds?.includes(userAddress)) return 'you';
  return 'you';
}

export async function fetchSpaceMentions(
  messageDB: Pick<MessageDB, 'getConversation' | 'getThreadReadTimesForChannel' | 'getUnreadMentions'>,
  space: Space,
  userAddress: string,
  opts: {
    enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
    userRoleIds: string[];
    config: any; // UserConfig | undefined
  },
): Promise<MentionNotification[]> {
  const { enabledTypes, userRoleIds, config } = opts;
  const settings = config?.notificationSettings?.[space.spaceId];
  if (settings?.isMuted) return [];

  let typesToCheck: string[];
  if (enabledTypes) {
    typesToCheck = enabledTypes;
  } else {
    const allTypes =
      settings?.enabledNotificationTypes ||
      getDefaultNotificationSettings(space.spaceId).enabledNotificationTypes;
    typesToCheck = allTypes.filter((tp: string) => tp.startsWith('mention-'));
  }
  if (typesToCheck.length === 0) return [];

  const mutedChannelIds = getMutedChannelsForSpace(space.spaceId, config?.mutedChannels);
  const channelIds = space.groups.flatMap((g) => g.channels.map((c) => c.channelId));
  const out: MentionNotification[] = [];

  for (const channelId of channelIds) {
    if (mutedChannelIds.includes(channelId)) continue;
    const conversationId = `${space.spaceId}/${channelId}`;
    const { conversation } = await messageDB.getConversation({ conversationId });
    const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
    const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
      spaceId: space.spaceId,
      channelId,
    });
    const messages = await messageDB.getUnreadMentions({
      spaceId: space.spaceId,
      channelId,
      afterTimestamp: lastReadTimestamp,
      limit: 1000,
    });
    const channel = space.groups
      .flatMap((g) => g.channels)
      .find((c) => c.channelId === channelId);

    const unread = messages.filter((message: Message) => {
      if (message.isThreadReply && message.threadId) {
        const trt = threadReadTimes[message.threadId];
        if (trt !== undefined && message.createdDate <= trt) return false;
      } else if (message.createdDate <= lastReadTimestamp) {
        return false;
      }
      return isMentionedWithSettings(message, {
        userAddress,
        enabledTypes: typesToCheck,
        userRoles: userRoleIds,
        space,
      });
    });

    for (const message of unread) {
      out.push({
        message,
        channelId,
        channelName: channel?.channelName || 'Unknown Channel',
        mentionType: getMentionType(message, userAddress),
        spaceId: space.spaceId,
        spaceName: space.spaceName,
      });
    }
  }
  return out;
}
