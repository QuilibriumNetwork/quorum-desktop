import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useTwoStepConfirm } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useRegistration } from '../../../hooks';

export const useUserKicking = () => {
  const [kicking, setKicking] = useState(false);
  const { confirmationStep, armOrConfirm, resetConfirmation } = useTwoStepConfirm();

  const { actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { spaceId } = useParams();

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
      armOrConfirm(() => {
        kickUserFromSpace(userAddress, onSuccess);
      });
    },
    [armOrConfirm, kickUserFromSpace]
  );

  return {
    kicking,
    confirmationStep,
    handleKickClick,
    kickUserFromSpace,
    resetConfirmation,
  };
};
