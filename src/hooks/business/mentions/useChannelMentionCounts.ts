import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentionedWithSettings } from '../../../utils/mentionUtils';
import { getDefaultNotificationSettings } from '../../../utils/notificationSettingsUtils';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';

interface UseChannelMentionCountsProps {
  spaceId: string;
  channelIds: string[];
  userRoleIds?: string[];
}

// Early-exit threshold: Stop counting after 10 mentions per channel
// (UI shows "9+" for counts > 9, so exact count beyond 10 is unnecessary)
const DISPLAY_THRESHOLD = 10;

/**
 * Hook to calculate unread mention counts for channels in a space
 *
 * Returns a map of channelId -> mentionCount for channels where the user has unread mentions.
 * Only channels with mentions > 0 are included in the result.
 *
 * The hook:
 * 1. Loads user's mention notification settings for this space
 * 2. Gets the last read timestamp for each channel
 * 3. Queries messages after that timestamp
 * 4. Filters messages where the user is mentioned (based on enabled mention types)
 * 5. Returns count per channel
 *
 * Uses React Query with 30s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 */
export function useChannelMentionCounts({
  spaceId,
  channelIds,
  userRoleIds = [],
}: UseChannelMentionCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Note: Query key includes all channelIds so it invalidates when channels change
    // Can be invalidated at space level ['mention-counts', 'channel', spaceId] or
    // more broadly ['mention-counts', 'channel'] for all channels
    queryKey: ['mention-counts', 'channel', spaceId, userAddress, ...channelIds.sort()],
    queryFn: async () => {
      if (!userAddress) return {};

      const counts: Record<string, number> = {};

      try {
        // Load user's notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        // If no settings exist, use defaults (all notification types enabled)
        const enabledTypes = settings?.enabledNotificationTypes ||
          getDefaultNotificationSettings(spaceId).enabledNotificationTypes;

        // Filter to only mention types (exclude 'reply')
        // e.g., ['mention-you', 'mention-everyone', 'reply'] -> ['mention-you', 'mention-everyone']
        const mentionTypes = enabledTypes.filter(t => t.startsWith('mention-'));

        // If no mention types are enabled, return empty counts
        if (mentionTypes.length === 0) {
          return {};
        }

        // Get muted channels to exclude from counts
        const mutedChannelIds = getMutedChannelsForSpace(spaceId, config?.mutedChannels);

        // Process each channel (excluding muted ones)
        for (const channelId of channelIds) {
          // Skip muted channels - they shouldn't contribute to notification counts
          if (mutedChannelIds.includes(channelId)) {
            continue;
          }
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Use optimized database query to get only unread messages with mentions
          // This is much faster than fetching all 10k messages
          const messages = await messageDB.getUnreadMentions({
            spaceId,
            channelId,
            afterTimestamp: lastReadTimestamp,
            limit: DISPLAY_THRESHOLD, // Only fetch what we need for display
          });

          // Count mentions with per-message early exit
          let channelMentionCount = 0;
          for (const message of messages) {
            // Use settings-aware mention check with unified notification format
            if (isMentionedWithSettings(message, {
              userAddress,
              enabledTypes: mentionTypes,
              userRoles: userRoleIds,
            })) {
              channelMentionCount++;

              // Early exit if we've hit the display threshold
              if (channelMentionCount >= DISPLAY_THRESHOLD) {
                break; // Stop scanning messages in this channel
              }
            }
          }

          // Only include channels with mentions
          if (channelMentionCount > 0) {
            counts[channelId] = channelMentionCount;
          }
        }
      } catch (error) {
        console.error('[MentionCounts] Error calculating mention counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return counts;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || {};
}
