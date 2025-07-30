import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useMessageDB } from '../../../components/context/MessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

export const useSpaceJoining = () => {
  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>();
  const navigate = useNavigate();
  const { joinInviteLink, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  const joinSpace = useCallback(async (inviteLink: string) => {
    setJoining(true);
    setJoinError(undefined);
    
    try {
      const result = await joinInviteLink(inviteLink, keyset, currentPasskeyInfo!);
      if (result) {
        navigate('/spaces/' + result.spaceId + '/' + result.channelId);
        return true;
      }
      return false;
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || e.toString() || 'Failed to join space';
      setJoinError(errorMessage);
      return false;
    } finally {
      setJoining(false);
    }
  }, [joinInviteLink, keyset, currentPasskeyInfo, navigate]);

  return {
    joinSpace,
    joining,
    joinError,
    clearJoinError: () => setJoinError(undefined),
  };
};