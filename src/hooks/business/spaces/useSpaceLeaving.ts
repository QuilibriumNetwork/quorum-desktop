import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useTwoStepConfirm } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';

export const useSpaceLeaving = () => {
  const [error, setError] = useState<string | null>(null);
  const { confirmationStep, armOrConfirm, resetConfirmation: resetTwoStep } =
    useTwoStepConfirm();
  const navigate = useNavigate();
  const { deleteSpace, getConfig, actionQueueService, updateUserProfile } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();

  const leaveSpace = useCallback(
    async (spaceId: string, onSuccess?: () => void) => {
      try {
        setError(null);

        // Clear space tag if it was from this space (before deleting)
        try {
          if (currentPasskeyInfo?.address && keyset?.userKeyset) {
            const config = await getConfig({
              address: currentPasskeyInfo.address,
              userKey: keyset.userKeyset,
            });
            if (config?.spaceTagId === spaceId) {
              const newConfig = { ...config, spaceTagId: undefined };
              await actionQueueService.enqueue(
                'save-user-config',
                { config: newConfig },
                `config:${currentPasskeyInfo.address}`
              );
              // Broadcast profile update with no tag so other members stop seeing it
              await updateUserProfile(
                currentPasskeyInfo.displayName ?? '',
                currentPasskeyInfo.pfpUrl ?? '',
                currentPasskeyInfo,
                undefined
              );
            }
          }
        } catch (tagErr) {
          // Non-blocking: tag will be stale but won't crash leave flow
          console.error('Failed to clear space tag on leave:', tagErr);
        }

        await deleteSpace(spaceId);
        navigate('/messages');
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error('Failed to leave space:', err);
        setError(err instanceof Error ? err.message : 'Failed to leave space. Please try again.');
        resetTwoStep(); // Reset confirmation state on error
      }
    },
    [deleteSpace, navigate, getConfig, actionQueueService, updateUserProfile, currentPasskeyInfo, keyset, resetTwoStep]
  );

  const handleLeaveClick = useCallback(
    (spaceId: string, onSuccess?: () => void) => {
      armOrConfirm(() => {
        leaveSpace(spaceId, onSuccess);
      });
    },
    [armOrConfirm, leaveSpace]
  );

  const resetConfirmation = useCallback(() => {
    setError(null);
    resetTwoStep();
  }, [resetTwoStep]);

  return {
    confirmationStep,
    handleLeaveClick,
    leaveSpace, // Direct leave without confirmation (use when caller provides its own confirmation UI)
    resetConfirmation,
    error,
  };
};
