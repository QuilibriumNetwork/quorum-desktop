import * as React from 'react';
import {
  Input,
  Button,
  Modal,
  Container,
  Text,
  Switch,
  Icon,
  Tooltip,
  FlexRow,
} from '../primitives';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { useDirectMessageCreation } from '../../hooks';
import { useMessageDB } from '../context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';

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

  const { getConfig, keyset, messageDB } = useMessageDB();
  const user = usePasskeysContext();
  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);

  // Load user default non-repudiable setting to initialize the switch
  React.useEffect(() => {
    (async () => {
      if (!user.currentPasskeyInfo?.address || !keyset?.userKeyset) return;
      try {
        const cfg = await getConfig({
          address: user.currentPasskeyInfo.address,
          userKey: keyset.userKeyset,
        });
        setNonRepudiable(cfg?.nonRepudiable ?? true);
      } catch {}
    })();
  }, [user.currentPasskeyInfo, keyset, getConfig]);

  // Override handleSubmit to save conversation settings
  const handleSubmitWithSettings = React.useCallback(() => {
    if (!!address) {
      // Persist the conversation record with the selected non-repudiability
      const now = Date.now();
      messageDB
        .saveConversation({
          conversationId: address + '/' + address,
          address: address,
          icon: DefaultImages.UNKNOWN_USER,
          displayName: t`Unknown User`,
          type: 'direct',
          timestamp: now,
          isRepudiable: !nonRepudiable ? true : false,
        })
        .catch(() => {});
    }
    handleSubmit();
  }, [address, nonRepudiable, messageDB, handleSubmit]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
      size="small"
    >
      <Container
        className="modal-new-direct-message"
        width="full"
        maxWidth="500px"
        margin="auto"
      >
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
              onClick={handleSubmitWithSettings}
            >
              {buttonText}
            </Button>
          </Container>
        </React.Suspense>

        <Container margin="none" className="mt-6 pt-4 border-t border-default">
          <FlexRow className="items-center justify-between">
            <FlexRow className="items-center text-sm text-subtle gap-1">
              <span>{t`Always sign messages`}</span>
              <Tooltip
                id="dm-nonrepudiable-tip"
                content={t`You can change this later for this conversation by clicking the lock icon in the Conversation view.`}
                maxWidth={260}
                className="!text-left"
              >
                <Icon
                  name="info-circle"
                  size="xs"
                  className="text-subtle info-icon-tooltip"
                />
              </Tooltip>
            </FlexRow>
            <Switch
              value={nonRepudiable}
              onChange={() => setNonRepudiable(!nonRepudiable)}
            />
          </FlexRow>
        </Container>
      </Container>
    </Modal>
  );
};

export default NewDirectMessageModal;
