import * as React from 'react';
import { Input, Button, Modal, Container, Text } from '../primitives';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { useDirectMessageCreation } from '../../hooks';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  const {
    address,
    handleAddressChange,
    handleSubmit,
    buttonText,
    isButtonDisabled,
    error,
  } = useDirectMessageCreation();

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
    >
      <Container className="modal-new-direct-message" width="full" maxWidth="500px" margin="auto">
        <Container margin="none" className="mb-4">
          <Text 
            size="sm" 
            variant="subtle" 
            align="left"
            className="text-left max-sm:text-center"
          >
            {t`Enter a user's address to start messaging them.`}
          </Text>
        </Container>
        <Container margin="none">
          <Input
            className="w-full !text-xs sm:!text-sm"
            onChange={(value: string) => handleAddressChange(value)}
            placeholder={t`User address here`}
            error={!!error}
            errorMessage={error || undefined}
          />
        </Container>
        <React.Suspense
          fallback={
            <Container className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={true}
                onClick={() => {}}
              >
                {buttonText}
              </Button>
            </Container>
          }
        >
          <Container className="modal-new-direct-message-actions">
            <Button
              className="w-full sm:inline-block"
              type="primary"
              disabled={isButtonDisabled}
              onClick={handleSubmit}
            >
              {buttonText}
            </Button>
          </Container>
        </React.Suspense>
      </Container>
    </Modal>
  );
};

export default NewDirectMessageModal;