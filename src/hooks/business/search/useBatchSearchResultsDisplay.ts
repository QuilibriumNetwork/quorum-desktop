import { useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import type { Group, Channel } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useNameResolver } from '../../../identity';
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
  triggerFocusMaintenance: number;
}

/**
 * Batch search results display hook that efficiently loads display data for all search results
 * This replaces individual useSearchResultDisplayDM and useSearchResultDisplaySpace hooks
 * to prevent cascading async operations that cause page refresh and focus stealing
 *
 * NAME resolution is imperative/bulk via `useNameResolver` (`src/identity`) —
 * a search result set spans an unbounded, only-known-at-render set of
 * distinct senders across possibly many spaces and DMs, which is exactly the
 * "many addresses, outside JSX" shape that hook exists for (a per-item
 * `useResolvedName` call would violate the rules of hooks). `requestNames`
 * enriches every distinct sender in one call (search renders a bounded
 * result set and the ".q" matters); `resolve` reads the SAME ladder
 * `<MemberName>` uses, spaceId passed per-result so a Space message's sender
 * gets their per-space nickname and a DM message's sender resolves on the
 * global ladder (DMs carry no spaceId). The caller (`SearchResults.tsx`)
 * mounts the ambient `<IdentityScopeProvider>` — a multi-space one, since
 * results can span every space the user belongs to.
 */
export const useBatchSearchResultsDisplay = ({
  results,
}: UseBatchSearchResultsDisplayProps): UseBatchSearchResultsDisplayReturn => {
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { resolve, requestNames } = useNameResolver();

  // Extract unique identifiers for batch operations
  const { uniqueSenderIds, uniqueSpaceIds } = useMemo(() => {
    const senderIds = new Set<string>();
    const spaceIds = new Set<string>();

    results.forEach((result) => {
      const { message } = result;
      const isDM = message.spaceId === message.channelId;

      senderIds.add(message.content.senderId);
      if (!isDM) {
        spaceIds.add(message.spaceId);
      }
    });

    return {
      uniqueSenderIds: Array.from(senderIds),
      uniqueSpaceIds: Array.from(spaceIds),
    };
  }, [results]);

  // Enrich every distinct sender in one call — deduped against addresses
  // already requested, so this is a no-op on a render that doesn't change
  // the result set, not a fetch storm.
  useEffect(() => {
    requestNames(uniqueSenderIds);
  }, [uniqueSenderIds, requestNames]);

  // Batch fetch space info for all unique spaces (channel/space NAME display,
  // unrelated to member identity)
  const spaceInfoQueries = useQueries({
    queries: uniqueSpaceIds.map((spaceId) => ({
      queryKey: buildSpaceKey({ spaceId }),
      queryFn: buildSpaceFetcher({ messageDB, spaceId }),
      refetchOnMount: false, // Use cached data when available
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1, // Limit retries to prevent cascading failures
    })),
  });

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
      const senderId = message.content.senderId;

      // The resolver owns the fallback (a truncated address) — never a
      // caller-owned "Unknown User"/"Loading..." placeholder here.
      const resolved = resolve(senderId, isDM ? {} : { spaceId: message.spaceId });
      const displayName = resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;

      if (isDM) {
        // Icon: unrelated to identity resolution. Self uses the passkey
        // picture; the other party has no cheap local source here (would
        // need a conversation fetch per row), so it stays the default —
        // unchanged from before this migration.
        const icon =
          senderId === currentPasskeyInfo?.address
            ? currentPasskeyInfo?.pfpUrl || undefined
            : undefined;

        dataMap.set(messageId, {
          messageId,
          isDM: true,
          displayName,
          spaceName: t`Direct Message`,
          channelName: displayName,
          icon,
          isLoading: false,
        });
      } else {
        // Handle Space display logic
        const spaceInfo = spaceInfoMap.get(message.spaceId);

        // Get channel name from space data
        let channelName = message.channelId;
        if (spaceInfo) {
          const channel = spaceInfo.groups
            ?.find((g: Group) =>
              g.channels?.find((c: Channel) => c.channelId === message.channelId)
            )
            ?.channels?.find((c: Channel) => c.channelId === message.channelId);
          if (channel) {
            channelName = channel.channelName;
          }
        }

        dataMap.set(messageId, {
          messageId,
          isDM: false,
          displayName,
          spaceName: spaceInfo?.spaceName || t`Unknown Space`,
          channelName,
          icon: undefined, // Spaces don't have icons in search results
          isLoading: !spaceInfo,
        });
      }
    });

    return dataMap;
  }, [results, resolve, spaceInfoMap, currentPasskeyInfo]);

  // Check if any queries are still loading
  const isAnyLoading = useMemo(() => {
    return spaceInfoQueries.some((query) => query.isLoading);
  }, [spaceInfoQueries]);

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
