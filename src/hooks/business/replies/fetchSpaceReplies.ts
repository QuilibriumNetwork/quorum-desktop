import { isNotificationTypeEnabled } from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import type { ReplyNotification } from '../../../types/notifications';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { MessageDB, UserConfig } from '../../../db/messages';

/**
 * Fetch unread replies for ONE space (pure; no React). Replicates the per-space
 * gating from `useAllReplies`. Returns rows in channel-iteration order — the
 * CALLER sorts (the global hook sorts after merging across all spaces, so
 * sorting here would be wasted work).
 */
export async function fetchSpaceReplies(
  messageDB: MessageDB,
  space: Space,
  userAddress: string,
  opts: { enabled: boolean; config: UserConfig | undefined; perChannelLimit?: number },
): Promise<(ReplyNotification & { spaceId: string; spaceName: string })[]> {
  const { enabled, config, perChannelLimit = 1000 } = opts;
  const settings = config?.notificationSettings?.[space.spaceId];
  if (settings?.isMuted) return [];

  // `enabled` overrides persistent settings (matches old useAllReplies semantics).
  const shouldFetch = enabled !== undefined ? enabled : isNotificationTypeEnabled(settings, 'reply');
  if (!shouldFetch) return [];

  const mutedChannelIds = getMutedChannelsForSpace(space.spaceId, config?.mutedChannels);
  const allChannels = space.groups.flatMap((g) => g.channels);
  const channelIds = allChannels.map((c) => c.channelId);
  const out: (ReplyNotification & { spaceId: string; spaceName: string })[] = [];

  for (const channelId of channelIds) {
    if (mutedChannelIds.includes(channelId)) continue;
    const conversationId = `${space.spaceId}/${channelId}`;
    const { conversation } = await messageDB.getConversation({ conversationId });
    const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
    const threadReadTimes = await messageDB.getThreadReadTimesForChannel({
      spaceId: space.spaceId,
      channelId,
    });
    const messages = await messageDB.getUnreadReplies({
      spaceId: space.spaceId,
      channelId,
      userAddress,
      afterTimestamp: lastReadTimestamp,
      limit: perChannelLimit,
    });
    const channel = allChannels.find((c) => c.channelId === channelId);

    for (const message of messages) {
      if (message.isThreadReply && message.threadId) {
        const trt = threadReadTimes[message.threadId];
        if (trt !== undefined && message.createdDate <= trt) continue;
      }
      out.push({
        message,
        channelId,
        channelName: channel?.channelName || 'Unknown Channel',
        type: 'reply',
        spaceId: space.spaceId,
        spaceName: space.spaceName,
      });
    }
  }
  return out;
}
