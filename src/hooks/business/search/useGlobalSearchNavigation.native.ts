import { useCallback } from 'react';

export interface UseGlobalSearchNavigationReturn {
  handleNavigate: (
    spaceId: string,
    channelId: string,
    messageId: string
  ) => void;
}

/**
 * Handles navigation logic for global search results
 * This is the React Native implementation - placeholder until React Navigation is implemented
 */
export const useGlobalSearchNavigation =
  (): UseGlobalSearchNavigationReturn => {
    // MOBILE TODO: Replace with React Navigation hooks when implemented
    // const navigation = useNavigation();

    const handleNavigate = useCallback(
      (spaceId: string, channelId: string, messageId: string) => {
        // Check if this is a DM message (spaceId === channelId indicates DM)
        const isDM = spaceId === channelId;

        // MOBILE TODO: Implement actual navigation when React Navigation is set up
        // For now, log the navigation intent to maintain the same logic structure
        if (isDM) {
          // For DMs, would navigate to Messages screen with address
          console.log(`Navigate to DM: /messages/${spaceId}#msg-${messageId}`);
          // navigation.navigate('Messages', {
          //   address: spaceId,
          //   messageId
          // });
        } else {
          // For spaces, would navigate to Space screen
          console.log(`Navigate to Space: /spaces/${spaceId}/${channelId}#msg-${messageId}`);
          // navigation.navigate('Space', {
          //   spaceId,
          //   channelId,
          //   messageId
          // });
        }
      },
      []
    );

    return {
      handleNavigate,
    };
  };