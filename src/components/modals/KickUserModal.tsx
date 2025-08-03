import * as React from 'react';
import { Button, Modal, Container, Text, FlexRow } from '../primitives';
import { useUserKicking } from '../../hooks';
import { t } from '@lingui/core/macro';

type KickUserModalProps = {
  visible: boolean;
  kickUserAddress?: string;
  onClose: () => void;
};

const KickUserModal: React.FunctionComponent<KickUserModalProps> = (props) => {
  const { kicking, confirmationStep, handleKickClick, resetConfirmation } = useUserKicking();

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!props.visible) {
      resetConfirmation();
    }
  }, [props.visible, resetConfirmation]);

  return (
    <Modal visible={props.visible} onClose={props.onClose} title={t`Kick User`} size='small'>
      <Container width="full" maxWidth="400px" margin="auto">
        <Container margin="none" className="mb-4 text-left max-sm:text-center">
          <Text 
            size="sm" 
            variant="subtle"
          >
            {t`Use the below button to kick this user out of the Space`}
          </Text>
        </Container>
        <FlexRow className="justify-start max-sm:justify-center">
          <Button
            type="danger"
            disabled={kicking}
            onClick={() => handleKickClick(props.kickUserAddress!, props.onClose)}
          >
            {confirmationStep === 0 ? t`Kick!` : t`Click again to confirm`}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default KickUserModal;