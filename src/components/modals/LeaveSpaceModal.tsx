import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow } from '../primitives';
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
  const { confirmationStep, handleLeaveClick, resetConfirmation } = useSpaceLeaving();

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
      size="medium"
    >
      <Container width="full" maxWidth="400px" margin="auto">
        <Container margin="none" className="mb-6 text-left max-sm:text-center">
          <Text 
            size="sm" 
            variant="subtle"
          >
            <Trans>
              Are you sure you want to leave this Space? You won't be able
              to rejoin unless you are re-invited.
            </Trans>
          </Text>
        </Container>
        <FlexRow className="gap-3 justify-start max-sm:justify-center">
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

export default LeaveSpaceModal;