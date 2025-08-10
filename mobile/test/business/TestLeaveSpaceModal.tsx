import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer } from '@/primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useState, useCallback, useEffect } from 'react';

type TestLeaveSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

// Mock the space leaving logic for testing (no real navigation or database calls)
const useTestSpaceLeaving = () => {
  const [confirmationStep, setConfirmationStep] = useState(0);
  const [confirmationTimeout, setConfirmationTimeout] = useState<NodeJS.Timeout | null>(null);

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
      // Mock the space leaving action
      console.log(`[TEST] Would leave space: ${spaceId}`);
      if (onSuccess) {
        onSuccess();
      }
    },
    []
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

const TestLeaveSpaceModal: React.FunctionComponent<TestLeaveSpaceModalProps> = ({
  spaceId,
  visible,
  onClose,
}) => {
  // Mock space data for testing
  const mockSpace = {
    spaceName: 'Test Space',
    spaceId: spaceId,
  };

  const { confirmationStep, handleLeaveClick, resetConfirmation } = useTestSpaceLeaving();

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!visible) {
      resetConfirmation();
    }
  }, [visible, resetConfirmation]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t`Leave ${mockSpace?.spaceName || 'Space'}`}
      size="small"
      swipeToClose={true}
      hideClose={true}
    >
      <Container>
        <Container>
          <Text variant="subtle">
            <Trans>
              Are you sure you want to leave this Space? You won't be able to
              rejoin unless you are re-invited.
            </Trans>
          </Text>
        </Container>
        <Spacer size='lg'></Spacer>
        <FlexRow>
          <Button
            type="danger"
            onClick={() => handleLeaveClick(spaceId, onClose)}
          >
            {confirmationStep === 0 ? (
              <Trans>Leave Space</Trans>
            ) : (
              <Trans>Click again to confirm</Trans>
            )}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default TestLeaveSpaceModal;