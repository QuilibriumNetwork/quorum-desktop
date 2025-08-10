import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow, Spacer } from '../primitives';
import { useUserKicking } from '../../hooks';
import { t } from '@lingui/core/macro';

type KickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const { kicking, confirmationStep, handleKickClick, resetConfirmation } =
    useUserKicking();

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!props.visible) {
      resetConfirmation();
    }
  }, [props.visible, resetConfirmation]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`Kick User`}
      size="small"
      swipeToClose={true}
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
            onClick={() =>
              handleKickClick(props.kickUserAddress!, props.onClose)
            }
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
