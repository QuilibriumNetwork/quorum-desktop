import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer } from '../primitives';
import { useUserKicking } from '../../hooks';
import { useModalSaveState } from '../../hooks';
import ModalSaveOverlay from './ModalSaveOverlay';
import { t } from '@lingui/core/macro';

type KickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const { kicking, confirmationStep, handleKickClick, kickUserFromSpace, resetConfirmation } =
    useUserKicking();

  const { isSaving, saveUntilComplete } = useModalSaveState({
    defaultTimeout: 5000,      // 5s for kick operations
    maxTimeout: 30000,         // 30s failsafe
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
      handleKickClick(props.kickUserAddress!, () => {});
    } else {
      // Second click - execute kick with overlay
      if (!props.kickUserAddress) return;

      saveUntilComplete(async () => {
        // Ensure minimum 3 second overlay display time
        const startTime = Date.now();
        const minDisplayTime = 3000; // 3 seconds

        // Execute the kick operation
        await kickUserFromSpace(props.kickUserAddress!);

        // If operation completed too quickly, wait for minimum display time
        const elapsed = Date.now() - startTime;
        if (elapsed < minDisplayTime) {
          await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
        }
      });
    }
  }, [confirmationStep, handleKickClick, saveUntilComplete, kickUserFromSpace, props.kickUserAddress]);

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
        <Container>
          <Text typography="body" variant="subtle">
            {t`Use the below button to kick this user out of the Space`}
          </Text>
        </Container>
        <Spacer size="lg"></Spacer>
        <FlexRow>
          <Button
            type="danger"
            disabled={isSaving || kicking}
            onClick={handleKickWithOverlay}
            hapticFeedback={true}
          >
            {confirmationStep === 0 ? t`Kick!` : t`Click again to confirm`}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default KickUserModal;
