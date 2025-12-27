import { useQuery } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { isMentionedWithSettings } from '../../../utils/mentionUtils';
import { getDefaultNotificationSettings } from '../../../utils/notificationSettingsUtils';
import { getMutedChannelsForSpace } from '../../../utils/channelUtils';
import type { Message } from '../../../api/quorumApi';

export interface MentionNotification {
  message: Message;
  channelId: string;
  channelName: string;
  mentionType: 'you' | 'everyone' | 'roles';
}

interface UseAllMentionsProps {
  spaceId: string;
  channelIds: string[];
  enabledTypes?: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
  userRoleIds?: string[];
}

/**
 * Hook to fetch all unread mentions across all channels in a space
 *
 * Returns array of MentionNotification objects sorted by date (newest first)
 * Respects user's mention notification settings for the space
 *
 * @example
 * const { mentions, isLoading } = useAllMentions({
 *   spaceId,
 *   channelIds,
 *   enabledTypes: ['mention-you', 'mention-everyone'] // Optional filter (unified format)
 * });
 */
export function useAllMentions({
  spaceId,
  channelIds,
  enabledTypes,
  userRoleIds = [],
}: UseAllMentionsProps) {
  const user = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const userAddress = user.currentPasskeyInfo?.address;

  const { data, isLoading } = useQuery({
    queryKey: ['mention-notifications', spaceId, userAddress, ...channelIds.sort(), ...(enabledTypes?.sort() || [])],
    queryFn: async () => {
      if (!userAddress) return [];

      const allMentions: MentionNotification[] = [];

      try {
        // Load user's notification settings for this space
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        // Determine which mention types to check (unified format)
        // If enabledTypes provided, use it; otherwise get from settings
        let typesToCheck: string[];
        if (enabledTypes) {
          typesToCheck = enabledTypes;
        } else {
          const allTypes = settings?.enabledNotificationTypes || getDefaultNotificationSettings(spaceId).enabledNotificationTypes;
          // Filter to only mention types (exclude 'reply')
          typesToCheck = allTypes.filter(t => t.startsWith('mention-'));
        }

        // If no mention types enabled, return empty
        if (typesToCheck.length === 0) {
          return [];
        }

        // Get muted channels to exclude from notifications
        const mutedChannelIds = getMutedChannelsForSpace(spaceId, config?.mutedChannels);

        // Get space data to access channel names
        const space = await messageDB.getSpace(spaceId);

        // Process each channel (excluding muted ones)
        for (const channelId of channelIds) {
          // Skip muted channels - they shouldn't show in notification panel
          if (mutedChannelIds.includes(channelId)) {
            continue;
          }
          const conversationId = `${spaceId}/${channelId}`;

          // Get conversation to find last read timestamp
          const { conversation } = await messageDB.getConversation({
            conversationId,
          });

          const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

          // Get all messages after last read (up to 10k for safety)
          const { messages } = await messageDB.getMessages({
            spaceId,
            channelId,
            limit: 10000,
          });

          // Get channel name from space data
          const channel = space?.groups
            ?.flatMap(g => g.channels)
            ?.find(c => c.channelId === channelId);

          // Filter messages that mention the user and are unread
          const unreadMentions = messages.filter((message: Message) => {
            if (message.createdDate <= lastReadTimestamp) return false;

            return isMentionedWithSettings(message, {
              userAddress,
              enabledTypes: typesToCheck,
              userRoles: userRoleIds,
            });
          });

          // Add to results with metadata
          unreadMentions.forEach((message) => {
            allMentions.push({
              message,
              channelId,
              channelName: channel?.channelName || 'Unknown Channel',
              mentionType: getMentionType(message, userAddress),
            });
          });
        }

        // Sort by date (newest first)
        allMentions.sort((a, b) => b.message.createdDate - a.message.createdDate);
      } catch (error) {
        console.error('[AllMentions] Error fetching mentions:', error);
        return [];
      }

      return allMentions;
    },
    enabled: !!userAddress && channelIds.length > 0,
    staleTime: 30000, // 30 seconds - matches useChannelMentionCounts
    refetchOnWindowFocus: true,
  });

  return {
    mentions: data || [],
    isLoading,
  };
}

// Helper to determine mention type
function getMentionType(message: Message, userAddress: string): 'you' | 'everyone' | 'roles' {
  if (message.mentions?.everyone) return 'everyone';
  if (message.mentions?.roleIds?.length && message.mentions.roleIds.length > 0) return 'roles';
  if (message.mentions?.memberIds?.includes(userAddress)) return 'you';
  return 'you'; // fallback
}
