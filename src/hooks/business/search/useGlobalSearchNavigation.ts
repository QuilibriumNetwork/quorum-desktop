import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface UseGlobalSearchNavigationReturn {
  handleNavigate: (
    spaceId: string,
    channelId: string,
    messageId: string
  ) => void;
}

/**
 * Handles navigation logic for global search results
 * Uses hash-based highlighting for cross-component communication.
 * This is the web implementation - a native version would use different navigation.
 */
export const useGlobalSearchNavigation =
  (): UseGlobalSearchNavigationReturn => {
    const navigate = useNavigate();

    const handleNavigate = useCallback(
      (spaceId: string, channelId: string, messageId: string) => {
        // Check if this is a DM message (spaceId === channelId indicates DM)
        const isDM = spaceId === channelId;

        if (isDM) {
          // For DMs, navigate to /messages/:address route
          navigate(`/messages/${spaceId}#msg-${messageId}`);
        } else {
          // For spaces, use normal space route
          navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
        }

        // Clean up hash after highlight animation completes (8s matches CSS animation)
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
// export const useGlobalSearchNavigation = (): UseGlobalSearchNavigationReturn => {
//   const navigation = useNavigation();
//
//   const handleNavigate = useCallback((
//     spaceId: string,
//     channelId: string,
//     messageId: string
//   ) => {
//     const isDM = spaceId === channelId;
//
//     if (isDM) {
//       navigation.navigate('Messages', {
//         address: spaceId,
//         messageId
//       });
//     } else {
//       navigation.navigate('Space', {
//         spaceId,
//         channelId,
//         messageId
//       });
//     }
//   }, [navigation]);
//
//   return { handleNavigate };
// };
