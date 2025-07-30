import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/MessageDB';
import { useRegistrationContext } from '../../../components/context/RegistrationPersister';
import { useRegistration } from '../../../hooks';
import { useQueryClient } from '@tanstack/react-query';

export const useUserKicking = () => {
  const [kicking, setKicking] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(0); // 0: initial, 1: awaiting confirmation
  const [confirmationTimeout, setConfirmationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const { kickUser } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { spaceId } = useParams();

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
      }
    };
  }, [confirmationTimeout]);

  const kickUserFromSpace = useCallback(async (userAddress: string, onSuccess?: () => void) => {
    if (!spaceId || !registration.registration || !userAddress) return;

    setKicking(true);
    try {
      await kickUser(
        spaceId,
        userAddress,
        keyset.userKeyset,
        keyset.deviceKeyset,
        registration.registration
      );
      
      // The kickUser function doesn't remove the user from local IndexedDB
      // So we invalidate the cache to trigger a re-render, but the kicked user
      // will still appear until the server sync removes them from local DB
      console.log('Kick operation completed for user:', userAddress);
      
      // Invalidate space members cache to refresh the user list
      await queryClient.invalidateQueries({
        queryKey: ['SpaceMembers', spaceId]
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to kick user:', error);
    } finally {
      setKicking(false);
    }
  }, [kickUser, spaceId, keyset, registration, queryClient]);

  const handleKickClick = useCallback((userAddress: string, onSuccess?: () => void) => {
    if (confirmationStep === 0) {
      setConfirmationStep(1);
      // Reset confirmation after 5 seconds
      const timeout = setTimeout(() => setConfirmationStep(0), 5000);
      setConfirmationTimeout(timeout);
    } else {
      // Clear the timeout since we're confirming
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
        setConfirmationTimeout(null);
      }
      kickUserFromSpace(userAddress, onSuccess);
    }
  }, [confirmationStep, confirmationTimeout, kickUserFromSpace]);

  const resetConfirmation = useCallback(() => {
    setConfirmationStep(0);
    if (confirmationTimeout) {
      clearTimeout(confirmationTimeout);
      setConfirmationTimeout(null);
    }
  }, [confirmationTimeout]);

  return {
    kicking,
    confirmationStep,
    handleKickClick,
    resetConfirmation,
  };
};