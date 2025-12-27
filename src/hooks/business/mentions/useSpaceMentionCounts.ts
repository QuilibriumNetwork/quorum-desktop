import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentionedWithSettings } from '../../../utils/mentionUtils';
import { getDefaultNotificationSettings } from '../../../utils/notificationSettingsUtils';
import { getUserRoles } from '../../../utils/permissions';
import type { Space } from '../../../api/quorumApi';

interface UseSpaceMentionCountsProps {
  spaces: Space[];
}

// Early-exit threshold: Stop counting after 10 mentions
// (UI shows "9+" for counts > 9, so exact count beyond 10 is unnecessary)
const DISPLAY_THRESHOLD = 10;

/**
 * Hook to calculate unread mention counts for entire spaces
 *
 * Returns a map of spaceId -> total mention count across all channels in that space.
 * Only spaces with mentions > 0 are included in the result.
 *
 * The hook:
 * 1. For each space, gets all channel IDs
 * 2. For each channel, gets the last read timestamp
 * 3. Queries messages after that timestamp where user is mentioned
 * 4. Aggregates total mentions per space
 *
 * Uses React Query with 30s stale time for performance while maintaining
 * reasonable real-time updates when invalidated.
 */
export function useSpaceMentionCounts({
  spaces,
}: UseSpaceMentionCountsProps): Record<string, number> {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data } = useQuery({
    // Query key includes space IDs to invalidate when spaces change
    // Can be invalidated at space level ['mention-counts', 'space', spaceId] or
    // more broadly ['mention-counts', 'space'] for all spaces
    queryKey: [
      'mention-counts',
      'space',
      userAddress,
      ...spaces.map((s) => s.spaceId).sort(),
    ],
    queryFn: async () => {
      if (!userAddress) return {};

      const spaceCounts: Record<string, number> = {};

      try {
        // Load user's notification settings
        const config = await messageDB.getUserConfig({ address: userAddress });

        // Process each space
        for (const space of spaces) {
          let spaceTotal = 0;

          // Get user's role IDs for this space
          const userRolesData = getUserRoles(userAddress, space);
          const userRoleIds = userRolesData.map(r => r.roleId);

          // Get notification settings for this space
          const settings = config?.notificationSettings?.[space.spaceId];

          // Check if entire space is muted (takes precedence over individual settings)
          if (settings?.isMuted) {
            continue; // Space is muted - no notifications
          }

          const enabledTypes = settings?.enabledNotificationTypes ||
            getDefaultNotificationSettings(space.spaceId).enabledNotificationTypes;

          // Filter to only mention types
          const mentionTypes = enabledTypes.filter(t => t.startsWith('mention-'));

          // If no mention types enabled, skip this space
          if (mentionTypes.length === 0) {
            continue;
          }

          // Get all channel IDs from all groups in this space
          const channelIds = space.groups.flatMap((group) =>
            group.channels.map((channel) => channel.channelId)
          );

          // Process each channel in the space with early exit
          for (const channelId of channelIds) {
            // Early exit: no need to count beyond display threshold
            if (spaceTotal >= DISPLAY_THRESHOLD) {
              break; // Stop scanning remaining channels
            }

            const conversationId = `${space.spaceId}/${channelId}`;

            // Get conversation to find last read timestamp
            const { conversation } = await messageDB.getConversation({
              conversationId,
            });

            const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

            // Use optimized database query to get only unread messages with mentions
            // This is much faster than fetching all 10k messages
            const remainingLimit = DISPLAY_THRESHOLD - spaceTotal;
            const messages = await messageDB.getUnreadMentions({
              spaceId: space.spaceId,
              channelId,
              afterTimestamp: lastReadTimestamp,
              limit: remainingLimit, // Only fetch what we need
            });

            // Count mentions that are for the current user
            for (const message of messages) {
              if (isMentionedWithSettings(message, {
                userAddress,
                enabledTypes: mentionTypes,
                userRoles: userRoleIds,
              })) {
                spaceTotal++;

                // Early exit if we've hit the display threshold
                if (spaceTotal >= DISPLAY_THRESHOLD) {
                  break; // Stop scanning messages
                }
              }
            }
          }

          // Only include spaces with mentions
          if (spaceTotal > 0) {
            spaceCounts[space.spaceId] = spaceTotal;
          }
        }
      } catch (error) {
        console.error('[SpaceMentionCounts] Error calculating mention counts:', error);
        // Return empty counts on error - graceful degradation
        return {};
      }

      return spaceCounts;
    },
    enabled: !!userAddress && spaces.length > 0,
    staleTime: 90000, // 90 seconds (1.5 minutes) - reduces query frequency while maintaining reasonable UX
    refetchOnWindowFocus: true, // Immediate updates when user returns to app
  });

  return data || {};
}
