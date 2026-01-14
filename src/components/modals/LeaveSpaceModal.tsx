import * as React from 'react';
import { Button, Modal, Container, Flex, Spacer, Callout } from '../primitives';
import { useSpace, useSpaceLeaving } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

type LeaveSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

const LeaveSpaceModal: React.FunctionComponent<LeaveSpaceModalProps> = ({
  spaceId,
  visible,
  onClose,
}) => {
  const { data: space } = useSpace({ spaceId });
  const { confirmationStep, handleLeaveClick, resetConfirmation, error } =
    useSpaceLeaving();

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
      title={t`Leave ${space?.spaceName || 'Space'}`}
      size="small"
      swipeToClose={true}
    >
      <Container>
        <p className="text-body text-subtle">
          <Trans>
            Are you sure you want to leave this Space? You won't be able to
            rejoin unless you are re-invited.
          </Trans>
        </p>
        {error && (
          <>
            <Spacer size="md"></Spacer>
            <Callout variant="error">
              {error}
            </Callout>
          </>
        )}
        <Spacer size="lg"></Spacer>
        <Flex>
          <Button
            type="danger"
            onClick={() => handleLeaveClick(spaceId, onClose)}
            hapticFeedback={true}
          >
            {confirmationStep === 0 ? (
              <Trans>Leave Space</Trans>
            ) : (
              <Trans>Click again to confirm</Trans>
            )}
          </Button>
        </Flex>
      </Container>
    </Modal>
  );
};

export default LeaveSpaceModal;
