import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useMessageDB } from '../../../components/context/MessageDB';

export const useSpaceLeaving = () => {
  const [confirmationStep, setConfirmationStep] = useState(0); // 0: initial, 1: awaiting confirmation
  const [confirmationTimeout, setConfirmationTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { deleteSpace } = useMessageDB();

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
      await deleteSpace(spaceId);
      navigate('/messages');
      if (onSuccess) {
        onSuccess();
      }
    },
    [deleteSpace, navigate]
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
    if (confirmationTimeout) {
      clearTimeout(confirmationTimeout);
      setConfirmationTimeout(null);
    }
  }, [confirmationTimeout]);

  return {
    confirmationStep,
    handleLeaveClick,
    resetConfirmation,
  };
};
