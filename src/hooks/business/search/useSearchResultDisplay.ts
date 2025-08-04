import { useState, useEffect, useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import { useUserInfo } from '../../queries/userInfo/useUserInfo';
import { useSpace } from '../../queries/space/useSpace';
import { useMessageDB } from '../../../components/context/MessageDB';
import { DefaultImages } from '../../../utils';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

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
 */
export const useSearchResultDisplay = ({
  result,
}: UseSearchResultDisplayProps): UseSearchResultDisplayReturn => {
  const { message } = result;
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // Detect if this is a DM message (spaceId === channelId indicates DM)
  const isDM = useMemo(() => message.spaceId === message.channelId, [message]);

  // DM-specific state
  const [dmIcon, setDmIcon] = useState<string>(DefaultImages.UNKNOWN_USER);
  const [dmDisplayName, setDmDisplayName] = useState<string>(t`Unknown User`);

  // Space-specific data fetching (conditionally called based on isDM)
  // For DM messages, we'll skip these hooks entirely
  let userInfo, userLoading, spaceInfo, spaceLoading;

  if (isDM) {
    // For DMs, don't call the hooks that cause issues
    userInfo = null;
    userLoading = false;
    spaceInfo = null;
    spaceLoading = false;
  } else {
    // For Space messages, call the hooks normally
    const userQuery = useUserInfo({
      address: message.content.senderId,
    });
    userInfo = userQuery.data;
    userLoading = userQuery.isLoading;

    const spaceQuery = useSpace({
      spaceId: message.spaceId,
    });
    spaceInfo = spaceQuery.data;
    spaceLoading = spaceQuery.isLoading;
  }

  // DM user info fetching
  useEffect(() => {
    if (!isDM) return;

    const fetchDMUserInfo = async () => {
      try {
        // For DMs, conversationId format is spaceId/channelId
        const conversationId = `${message.content.senderId}/${message.content.senderId}`;
        const { conversation } = await messageDB.getConversation({
          conversationId,
        });
        if (conversation) {
          setDmIcon(conversation.icon);
          setDmDisplayName(conversation.displayName);
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      }
    };

    if (message.content.senderId !== currentPasskeyInfo?.address) {
      fetchDMUserInfo();
    } else if (
      currentPasskeyInfo &&
      currentPasskeyInfo.pfpUrl &&
      currentPasskeyInfo.displayName
    ) {
      setDmIcon(currentPasskeyInfo.pfpUrl);
      setDmDisplayName(currentPasskeyInfo.displayName);
    }
  }, [isDM, messageDB, message.content.senderId, currentPasskeyInfo]);

  // Calculate display values
  const displayValues = useMemo(() => {
    if (isDM) {
      return {
        displayName: dmDisplayName,
        spaceName: t`Direct Message`,
        channelName: dmDisplayName,
        icon: dmIcon,
        isLoading: false, // DM loading is handled in useEffect
      };
    }

    // Space message
    const channel = spaceInfo?.groups
      .find((g) => g.channels.find((c) => c.channelId === message.channelId))
      ?.channels.find((c) => c.channelId === message.channelId);

    return {
      displayName: userInfo?.display_name || t`Unknown User`,
      spaceName: spaceInfo?.spaceName || t`Unknown Space`,
      channelName: channel?.channelName || message.channelId,
      icon: undefined, // Space messages don't use profile icons in this context
      isLoading: userLoading || spaceLoading,
    };
  }, [
    isDM,
    dmDisplayName,
    dmIcon,
    userInfo,
    spaceInfo,
    message.channelId,
    userLoading,
    spaceLoading,
  ]);

  return {
    isDM,
    ...displayValues,
  };
};
