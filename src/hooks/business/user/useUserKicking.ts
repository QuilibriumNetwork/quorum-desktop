import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useRegistration } from '../../../hooks';

export const useUserKicking = () => {
  const [kicking, setKicking] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(0); // 0: initial, 1: awaiting confirmation
  const [confirmationTimeout, setConfirmationTimeout] =
    useState<NodeJS.Timeout | null>(null);

  const { actionQueueService } = useMessageDB();
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

  const kickUserFromSpace = useCallback(
    async (userAddress: string, onSuccess?: () => void) => {
      if (!spaceId || !registration.registration || !userAddress) return;

      setKicking(true);
      try {
        // Queue the kick action - will be processed in background
        await actionQueueService.enqueue(
          'kick-user',
          {
            spaceId,
            userAddress,
            user_keyset: keyset.userKeyset,
            device_keyset: keyset.deviceKeyset,
            registration: registration.registration,
          },
          `kick:${spaceId}:${userAddress}` // Dedup key
        );

        // Call success callback immediately since action is queued
        // The actual kick will happen in background with toast feedback
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error('Failed to queue kick action:', error);
      } finally {
        setKicking(false);
      }
    },
    [actionQueueService, spaceId, keyset, registration]
  );

  const handleKickClick = useCallback(
    (userAddress: string, onSuccess?: () => void) => {
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
    },
    [confirmationStep, confirmationTimeout, kickUserFromSpace]
  );

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
    kickUserFromSpace,
    resetConfirmation,
  };
};
