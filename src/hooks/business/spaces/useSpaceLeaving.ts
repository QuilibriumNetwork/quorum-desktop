import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';

export const useSpaceLeaving = () => {
  const [confirmationStep, setConfirmationStep] = useState(0); // 0: initial, 1: awaiting confirmation
  const [confirmationTimeout, setConfirmationTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { deleteSpace, getConfig, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
      }
    };
  }, [confirmationTimeout]);

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
        setConfirmationStep(0); // Reset confirmation state on error
      }
    },
    [deleteSpace, navigate, getConfig, actionQueueService, currentPasskeyInfo, keyset]
  );

  const handleLeaveClick = useCallback(
    (spaceId: string, onSuccess?: () => void) => {
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
        leaveSpace(spaceId, onSuccess);
      }
    },
    [confirmationStep, confirmationTimeout, leaveSpace]
  );

  const resetConfirmation = useCallback(() => {
    setConfirmationStep(0);
    setError(null);
    if (confirmationTimeout) {
      clearTimeout(confirmationTimeout);
      setConfirmationTimeout(null);
    }
  }, [confirmationTimeout]);

  return {
    confirmationStep,
    handleLeaveClick,
    leaveSpace, // Direct leave without confirmation (use when caller provides its own confirmation UI)
    resetConfirmation,
    error,
  };
};
