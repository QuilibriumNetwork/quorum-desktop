import { useState, useEffect, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import { useSpace } from '../../queries/space/useSpace';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { DefaultImages } from '../../../utils';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useResolvedName } from '../../../identity';

export interface UseSearchResultDisplayProps {
  result: SearchResult;
}

export interface UseSearchResultDisplayReturn {
  isDM: boolean;
  displayName: string;
  spaceName: string;
  channelName: string;
  icon?: string;
  isLoading: boolean;
}

/**
 * Manages display information for search result items
 * This hook handles user/space data fetching and DM detection
 * Contains some platform-specific logic for data fetching
 *
 * NAME resolves through `src/identity` (`useResolvedName`), never a raw
 * `display_name` field or `currentPasskeyInfo.displayName` — the latter is
 * the device-local auth record and carries no QNS name, the same bug fixed
 * in the nav rail (commit e066e789d). `enrich`: search renders a bounded
 * number of distinct senders and the ".q" matters.
 */
export const useSearchResultDisplay = ({
  result,
}: UseSearchResultDisplayProps): UseSearchResultDisplayReturn => {
  const { message } = result;
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // Detect if this is a DM message (spaceId === channelId indicates DM)
  const isDM = useMemo(() => message.spaceId === message.channelId, [message]);

  // DM icon only — the picture is outside the identity module's remit.
  const [dmIcon, setDmIcon] = useState<string>(DefaultImages.UNKNOWN_USER);

  // Space-specific data fetching — always called to satisfy rules of hooks, skipped when isDM
  const spaceQuery = useSpace({
    spaceId: message.spaceId,
    enabled: !isDM,
  });

  const spaceInfo = isDM ? null : spaceQuery.data;
  const spaceLoading = isDM ? false : spaceQuery.isLoading;

  // DM icon fetching (name no longer sourced here — see useResolvedName below)
  useEffect(() => {
    if (!isDM) return;

    if (message.content.senderId === currentPasskeyInfo?.address) {
      if (currentPasskeyInfo?.pfpUrl) setDmIcon(currentPasskeyInfo.pfpUrl);
      return;
    }

    const fetchDMIcon = async () => {
      try {
        // For DMs, conversationId format is spaceId/channelId
        const conversationId = `${message.content.senderId}/${message.content.senderId}`;
        const { conversation } = await messageDB.getConversation({
          conversationId,
        });
        if (conversation?.icon) {
          setDmIcon(conversation.icon);
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      }
    };

    fetchDMIcon();
  }, [isDM, messageDB, message.content.senderId, currentPasskeyInfo]);

  // NAME resolution — always through src/identity, self included. `spaceId`
  // is omitted for a DM (no roster tier applies), passed for a Space message
  // so a per-space nickname wins over the global name.
  const resolvedName = useResolvedName(message.content.senderId, {
    spaceId: isDM ? undefined : message.spaceId,
    enrich: true,
  });

  // Calculate display values
  const displayValues = useMemo(() => {
    if (isDM) {
      return {
        displayName: resolvedName,
        spaceName: t`Direct Message`,
        channelName: resolvedName,
        icon: dmIcon,
        isLoading: false,
      };
    }

    // Space message
    const channel = spaceInfo?.groups
      .find((g) => g.channels.find((c) => c.channelId === message.channelId))
      ?.channels.find((c) => c.channelId === message.channelId);

    return {
      displayName: resolvedName,
      spaceName: spaceInfo?.spaceName || t`Unknown Space`,
      channelName: channel?.channelName || message.channelId,
      icon: undefined, // Space messages don't use profile icons in this context
      isLoading: spaceLoading,
    };
  }, [
    isDM,
    resolvedName,
    dmIcon,
    spaceInfo,
    message.channelId,
    spaceLoading,
  ]);

  return {
    isDM,
    ...displayValues,
  };
};
