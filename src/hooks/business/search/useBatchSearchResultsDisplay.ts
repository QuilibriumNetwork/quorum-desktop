import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../../utils';
import { buildUserInfoFetcher } from '../../queries/userInfo/buildUserInfoFetcher';
import { buildUserInfoKey } from '../../queries/userInfo/buildUserInfoKey';
import { buildSpaceFetcher } from '../../queries/space/buildSpaceFetcher';
import { buildSpaceKey } from '../../queries/space/buildSpaceKey';

export interface BatchSearchResultDisplayData {
  messageId: string;
  isDM: boolean;
  displayName: string;
  spaceName: string;
  channelName: string;
  icon?: string;
  isLoading: boolean;
}

export interface UseBatchSearchResultsDisplayProps {
  results: SearchResult[];
}

export interface UseBatchSearchResultsDisplayReturn {
  resultsData: Map<string, BatchSearchResultDisplayData>;
  isAnyLoading: boolean;
}

/**
 * Batch search results display hook that efficiently loads display data for all search results
 * This replaces individual useSearchResultDisplayDM and useSearchResultDisplaySpace hooks
 * to prevent cascading async operations that cause page refresh and focus stealing
 */
export const useBatchSearchResultsDisplay = ({
  results,
}: UseBatchSearchResultsDisplayProps): UseBatchSearchResultsDisplayReturn => {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // Extract unique identifiers for batch operations
  const { uniqueUserIds, uniqueSpaceIds, dmResults, spaceResults } = useMemo(() => {
    const userIds = new Set<string>();
    const spaceIds = new Set<string>();
    const dmResults: SearchResult[] = [];
    const spaceResults: SearchResult[] = [];

    results.forEach((result) => {
      const { message } = result;
      const isDM = message.spaceId === message.channelId;
      
      if (isDM) {
        dmResults.push(result);
        // For DMs, we need user info for the sender (unless it's current user)
        if (message.content.senderId !== currentPasskeyInfo?.address) {
          userIds.add(message.content.senderId);
        }
      } else {
        spaceResults.push(result);
        // For space messages, we need both user and space info
        userIds.add(message.content.senderId);
        spaceIds.add(message.spaceId);
      }
    });

    return {
      uniqueUserIds: Array.from(userIds),
      uniqueSpaceIds: Array.from(spaceIds),
      dmResults,
      spaceResults,
    };
  }, [results, currentPasskeyInfo]);

  // Batch fetch user info for all unique users
  const userInfoQueries = useQueries({
    queries: uniqueUserIds.map((address) => ({
      queryKey: buildUserInfoKey({ address }),
      queryFn: buildUserInfoFetcher({ messageDB, address }),
      refetchOnMount: false, // Use cached data when available
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1, // Limit retries to prevent cascading failures
    })),
  });

  // Batch fetch space info for all unique spaces
  const spaceInfoQueries = useQueries({
    queries: uniqueSpaceIds.map((spaceId) => ({
      queryKey: buildSpaceKey({ spaceId }),
      queryFn: buildSpaceFetcher({ messageDB, spaceId }),
      refetchOnMount: false, // Use cached data when available
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1, // Limit retries to prevent cascading failures
    })),
  });

  // Create lookup maps for efficient data access
  const userInfoMap = useMemo(() => {
    const map = new Map();
    uniqueUserIds.forEach((address, index) => {
      const query = userInfoQueries[index];
      if (query?.data) {
        map.set(address, query.data);
      }
    });
    return map;
  }, [uniqueUserIds, userInfoQueries]);

  const spaceInfoMap = useMemo(() => {
    const map = new Map();
    uniqueSpaceIds.forEach((spaceId, index) => {
      const query = spaceInfoQueries[index];
      if (query?.data) {
        map.set(spaceId, query.data);
      }
    });
    return map;
  }, [uniqueSpaceIds, spaceInfoQueries]);

  // Process all results and create display data
  const resultsData = useMemo(() => {
    const dataMap = new Map<string, BatchSearchResultDisplayData>();

    results.forEach((result) => {
      const { message } = result;
      const isDM = message.spaceId === message.channelId;
      const messageId = message.messageId;

      if (isDM) {
        // Handle DM display logic
        let displayName = t`Unknown User`;
        let icon = DefaultImages.UNKNOWN_USER;
        let isLoading = false;

        if (message.content.senderId === currentPasskeyInfo?.address) {
          // Current user's message
          displayName = currentPasskeyInfo?.displayName || t`You`;
          icon = currentPasskeyInfo?.pfpUrl || DefaultImages.UNKNOWN_USER;
        } else {
          // Other user's message - try to get from batch loaded data
          const userInfo = userInfoMap.get(message.content.senderId);
          if (userInfo) {
            displayName = userInfo.display_name || t`Unknown User`;
            // Note: User info might not have icon, would need conversation data
            // For now, use default icon to avoid additional async calls
          } else {
            // Still loading or failed to load
            isLoading = true;
          }
        }

        dataMap.set(messageId, {
          messageId,
          isDM: true,
          displayName,
          spaceName: t`Direct Message`,
          channelName: displayName,
          icon,
          isLoading,
        });
      } else {
        // Handle Space display logic
        const userInfo = userInfoMap.get(message.content.senderId);
        const spaceInfo = spaceInfoMap.get(message.spaceId);
        
        const displayName = userInfo?.display_name || t`Unknown User`;
        const spaceName = spaceInfo?.spaceName || t`Unknown Space`;
        
        // Get channel name from space data
        let channelName = message.channelId;
        if (spaceInfo) {
          const channel = spaceInfo.groups
            ?.find((g) => g.channels?.find((c) => c.channelId === message.channelId))
            ?.channels?.find((c) => c.channelId === message.channelId);
          if (channel) {
            channelName = channel.channelName;
          }
        }

        const isLoading = !userInfo || !spaceInfo;

        dataMap.set(messageId, {
          messageId,
          isDM: false,
          displayName,
          spaceName,
          channelName,
          icon: undefined, // Spaces don't have icons in search results
          isLoading,
        });
      }
    });

    return dataMap;
  }, [results, userInfoMap, spaceInfoMap, currentPasskeyInfo]);

  // Check if any queries are still loading
  const isAnyLoading = useMemo(() => {
    return [...userInfoQueries, ...spaceInfoQueries].some((query) => query.isLoading);
  }, [userInfoQueries, spaceInfoQueries]);

  // Trigger focus maintenance when results data updates
  // This helps prevent focus stealing during async data loading
  const triggerFocusMaintenance = useMemo(() => {
    // This memo will trigger whenever resultsData changes due to async operations
    return resultsData.size;
  }, [resultsData]);

  return {
    resultsData,
    isAnyLoading,
    triggerFocusMaintenance, // Expose for components that need to maintain focus
  };
};