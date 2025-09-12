import { useState, useEffect } from 'react';
import { t } from '@lingui/core/macro';
import { SearchResult } from '../../../db/messages';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { DefaultImages } from '../../../utils';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

export interface UseSearchResultDisplayDMProps {
  result: SearchResult;
}

export interface UseSearchResultDisplayDMReturn {
  displayName: string;
  spaceName: string;
  channelName: string;
  icon?: string;
  isLoading: boolean;
}

/**
 * Manages display information for DM search result items
 * This hook handles DM-specific user data fetching without calling Space hooks
 */
export const useSearchResultDisplayDM = ({
  result,
}: UseSearchResultDisplayDMProps): UseSearchResultDisplayDMReturn => {
  const { message } = result;
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // DM-specific state
  const [icon, setIcon] = useState<string>(DefaultImages.UNKNOWN_USER);
  const [displayName, setDisplayName] = useState<string>(t`Unknown User`);
  const [isLoading, setIsLoading] = useState(true);

  // DM user info fetching
  useEffect(() => {
    const fetchDMUserInfo = async () => {
      try {
        setIsLoading(true);

        // For DMs, conversationId format is spaceId/channelId
        const conversationId = `${message.content.senderId}/${message.content.senderId}`;
        const { conversation } = await messageDB.getConversation({
          conversationId,
        });
        if (conversation) {
          setIcon(conversation.icon);
          setDisplayName(conversation.displayName);
        }
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
        setIsLoading(false);
      }
    };

    if (message.content.senderId !== currentPasskeyInfo?.address) {
      fetchDMUserInfo();
    } else if (
      currentPasskeyInfo &&
      currentPasskeyInfo.pfpUrl &&
      currentPasskeyInfo.displayName
    ) {
      setIcon(currentPasskeyInfo.pfpUrl);
      setDisplayName(currentPasskeyInfo.displayName);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [messageDB, message.content.senderId, currentPasskeyInfo]);

  return {
    displayName,
    spaceName: t`Direct Message`,
    channelName: displayName,
    icon,
    isLoading,
  };
};
