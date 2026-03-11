import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildMessageHash } from '../../../utils/messageHashNavigation';

export interface UseGlobalSearchNavigationReturn {
  handleNavigate: (
    spaceId: string,
    channelId: string,
    messageId: string,
    threadId?: string
  ) => void;
}

/**
 * Handles navigation logic for global search results.
 * Uses hash-based highlighting for cross-component communication.
 * Thread replies use compound hash: #thread-{threadId}-msg-{messageId}
 */
export const useGlobalSearchNavigation =
  (): UseGlobalSearchNavigationReturn => {
    const navigate = useNavigate();

    const handleNavigate = useCallback(
      (spaceId: string, channelId: string, messageId: string, threadId?: string) => {
        const isDM = spaceId === channelId;
        const hash = buildMessageHash(messageId, threadId);

        if (isDM) {
          navigate(`/messages/${spaceId}${hash}`);
        } else {
          navigate(`/spaces/${spaceId}/${channelId}${hash}`);
        }

        setTimeout(() => {
          history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }, 8000);
      },
      [navigate]
    );

    return {
      handleNavigate,
    };
  };

// TODO: Create native version at useGlobalSearchNavigation.native.ts
