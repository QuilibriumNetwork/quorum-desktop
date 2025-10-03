import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer } from '@/components/primitives';
import { t } from '@lingui/core/macro';
import { useState, useCallback, useEffect } from 'react';

type TestKickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

// Mock the user kicking logic for testing (no real API calls)
const useTestUserKicking = () => {
  const [kicking, setKicking] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(0);
  const [confirmationTimeout, setConfirmationTimeout] =
    useState<NodeJS.Timeout | null>(null);

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
      setKicking(true);

      // Mock the kick operation with a delay
      console.log(`[TEST] Would kick user: ${userAddress}`);

      // Simulate async operation
      setTimeout(() => {
        setKicking(false);
        if (onSuccess) {
          onSuccess();
        }
      }, 1000);
    },
    []
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
    resetConfirmation,
  };
};

const TestKickUserModal: React.FunctionComponent<TestKickUserModalProps> = (
  props
) => {
  const { kicking, confirmationStep, handleKickClick, resetConfirmation } =
    useTestUserKicking();

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!props.visible) {
      resetConfirmation();
    }
  }, [props.visible, resetConfirmation]);

  // Mock user address for testing
  const mockUserAddress = props.kickUserAddress || 'test-user-address-123';

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`Kick User`}
      size="small"
      swipeToClose={true}
      hideClose={true}
    >
      <Container>
        <Container>
          <Text variant="subtle">
            {t`Use the below button to kick this user out of the Space`}
          </Text>
        </Container>
        <Spacer size="lg"></Spacer>
        <FlexRow>
          <Button
            type="danger"
            disabled={kicking}
            onClick={() => handleKickClick(mockUserAddress, props.onClose)}
            hapticFeedback={true}
          >
            {confirmationStep === 0 ? t`Kick!` : t`Click again to confirm`}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default TestKickUserModal;
