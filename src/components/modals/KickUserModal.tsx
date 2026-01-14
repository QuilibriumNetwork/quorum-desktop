import * as React from 'react';
import { Button, Modal, Container, Flex, Spacer } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { useUserKicking } from '../../hooks';
import { useModalSaveState } from '../../hooks';
import ModalSaveOverlay from './ModalSaveOverlay';
import { t } from '@lingui/core/macro';
import { getAddressSuffix } from '../../utils';

type KickUserModalProps = {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userIcon?: string;
  userAddress: string;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const { kicking, confirmationStep, handleKickClick, kickUserFromSpace, resetConfirmation } =
    useUserKicking();

  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000,         // 30s failsafe
    showOverlayDelay: 1000,    // Only show overlay if operation takes >1s
    onSaveComplete: props.onClose, // Auto-close modal on success
    onSaveError: (error) => {
      console.error('Kick failed:', error);
      // Keep modal open on error
    },
  });

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!props.visible) {
      resetConfirmation();
    }
  }, [props.visible, resetConfirmation]);

  const handleKickWithOverlay = React.useCallback(() => {
    if (confirmationStep === 0) {
      // First click - just advance to confirmation step
      handleKickClick(props.userAddress, () => {});
    } else {
      // Second click - execute kick (queued via ActionQueue)
      if (!props.userAddress) return;

      saveUntilComplete(async () => {
        await kickUserFromSpace(props.userAddress);
      });
    }
  }, [confirmationStep, handleKickClick, saveUntilComplete, kickUserFromSpace, props.userAddress]);

  return (
    <Modal
      visible={props.visible}
      onClose={isSaving ? undefined : props.onClose}
      closeOnBackdropClick={!isSaving}
      closeOnEscape={!isSaving}
      title={t`Kick User`}
      size="small"
      swipeToClose={!isSaving}
    >
      <ModalSaveOverlay visible={isSaving} message={t`Kicking...`} />

      <Container>
        <Flex gap="md" align="center">
          <UserAvatar
            userIcon={props.userIcon}
            displayName={props.userName}
            address={props.userAddress}
            size={40}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-body font-semibold truncate-user-name">
              {props.userName}
            </span>
            <span className="text-small">
              {getAddressSuffix(props.userAddress)}
            </span>
          </div>
        </Flex>

        <Spacer size="lg" />

        <p className="text-body text-subtle">
          {t`This user will be removed from the Space.`}
        </p>

        <Spacer size="lg" />

        <Flex gap="sm">
          <Button
            type="subtle"
            onClick={props.onClose}
            disabled={isSaving}
            fullWidth={true}
          >
            {t`Cancel`}
          </Button>
          <Button
            type="danger"
            disabled={isSaving || kicking}
            onClick={handleKickWithOverlay}
            hapticFeedback={true}
            fullWidth={true}
          >
            {confirmationStep === 0 ? t`Kick` : t`Click again to confirm`}
          </Button>
        </Flex>
      </Container>
    </Modal>
  );
};

export default KickUserModal;
