import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import { useUserInfo } from '../../queries/userInfo/useUserInfo';
import { useSpace } from '../../queries/space/useSpace';

export interface UseSearchResultDisplaySpaceProps {
  result: SearchResult;
}

export interface UseSearchResultDisplaySpaceReturn {
  displayName: string;
  spaceName: string;
  channelName: string;
  isLoading: boolean;
}

/**
 * Manages display information for Space search result items
 * This hook handles user/space data fetching for non-DM messages
 */
export const useSearchResultDisplaySpace = ({
  result,
}: UseSearchResultDisplaySpaceProps): UseSearchResultDisplaySpaceReturn => {
  const { message } = result;

  // Fetch user info for the sender
  const { data: userInfo, isLoading: userLoading } = useUserInfo({
    address: message.content.senderId,
  });

  // Fetch space info
  const { data: spaceInfo, isLoading: spaceLoading } = useSpace({
    spaceId: message.spaceId,
  });

  // Calculate display values
  const displayValues = useMemo(() => {
    // Get channel name from space data
    const channel = spaceInfo?.groups
      .find((g) => g.channels.find((c) => c.channelId === message.channelId))
      ?.channels.find((c) => c.channelId === message.channelId);

    return {
      displayName: userInfo?.display_name || t`Unknown User`,
      spaceName: spaceInfo?.spaceName || t`Unknown Space`,
      channelName: channel?.channelName || message.channelId,
      isLoading: userLoading || spaceLoading,
    };
  }, [
    userInfo,
    spaceInfo,
    message.channelId,
    userLoading,
    spaceLoading,
  ]);

  return displayValues;
};