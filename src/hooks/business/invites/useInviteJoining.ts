import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/MessageDB';

/**
 * Custom hook for handling invite-based space joining functionality
 * Manages join process, loading states, navigation, and error handling specifically for invite links
 */
export const useInviteJoining = (inviteLink: string) => {
  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>();
  const { joinInviteLink, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const navigate = useNavigate();

  const joinSpace = useCallback(async () => {
    if (!currentPasskeyInfo) {
      setJoinError('No passkey available');
      return false;
    }

    setJoining(true);
    setJoinError(undefined);

    try {
      const result = await joinInviteLink(
        inviteLink,
        keyset,
        currentPasskeyInfo
      );
      
      if (result) {
        // Navigate to the newly joined space and channel
        navigate(`/spaces/${result.spaceId}/${result.channelId}`);
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('Failed to join space:', e);
      const errorMessage = e?.message || e?.toString() || 'Failed to join space';
      setJoinError(errorMessage);
      return false;
    } finally {
      setJoining(false);
    }
  }, [joinInviteLink, keyset, currentPasskeyInfo, inviteLink, navigate]);

  const clearJoinError = useCallback(() => {
    setJoinError(undefined);
  }, []);

  return {
    joining,
    joinSpace,
    joinError,
    clearJoinError,
  };
};