import * as React from 'react';
import { Button, Modal } from '../primitives';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';
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
  const navigate = useNavigate();
  const { deleteSpace } = useMessageDB();
  const [confirmationStep, setConfirmationStep] = React.useState(0); // 0: initial, 1: awaiting confirmation

  const leaveSpace = React.useCallback(async () => {
    deleteSpace(space!.spaceId);
    navigate('/messages');
    onClose();
  }, [space, deleteSpace, navigate, onClose]);

  return (
    <Modal visible={visible} onClose={onClose} title={t`Leave ${space?.spaceName || 'Space'}`} size="medium">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="mb-6 text-sm text-subtle text-left max-sm:text-center">
          <Trans>
            Are you sure you want to leave this Space? You won't be able
            to rejoin unless you are re-invited.
          </Trans>
        </div>
        <div className="flex gap-3 justify-start max-sm:justify-center">
          <Button
            type="danger"
            onClick={() => {
              if (confirmationStep === 0) {
                setConfirmationStep(1);
                // Reset confirmation after 5 seconds
                setTimeout(() => setConfirmationStep(0), 5000);
              } else {
                leaveSpace();
              }
            }}
          >
            {confirmationStep === 0 ? (
              <Trans>Leave Space</Trans>
            ) : (
              <Trans>Click again to confirm</Trans>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default LeaveSpaceModal;
