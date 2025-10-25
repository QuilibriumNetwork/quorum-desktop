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
  Spacer,
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
  const handleSubmitWithSettings = React.useCallback(async () => {
    if (!!address) {
      // Persist the conversation record with the selected non-repudiability
      const now = Date.now();
      try {
        await messageDB.saveConversation({
          conversationId: address + '/' + address,
          address: address,
          icon: DefaultImages.UNKNOWN_USER,
          displayName: t`Unknown User`,
          type: 'direct',
          timestamp: now,
          isRepudiable: !nonRepudiable ? true : false,
        });
      } catch (error) {
        console.error('Failed to save conversation settings:', error);
        // Continue with modal submission even if save fails
      }
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
            className="text-sm text-subtle !text-left max-sm:!text-center !block"
            style={{ textAlign: 'left' }}
          >
            {t`Enter a user's address to start messaging them.`}
          </Text>
        </Container>
        <Container margin="none">
          <Input
            className="w-full !text-xs sm:!text-sm"
            onChange={(value: string) => handleAddressChange(value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && !isButtonDisabled) {
                e.preventDefault();
                handleSubmitWithSettings();
              }
            }}
            placeholder={t`User address here`}
            error={!!error}
            errorMessage={error || undefined}
            autoFocus={true}
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

        <Spacer spaceBefore="lg" spaceAfter="md" border={true} direction="vertical" />
        <Container margin="none">
          <FlexRow className="items-center justify-between">
            <FlexRow className="items-center">
              <div className="text-label">{t`Always sign messages`}</div>
              <Tooltip
                id="dm-nonrepudiable-tip"
                content={t`You can change this later for this conversation by clicking the lock icon in the Conversation view.`}
                maxWidth={260}
                className="!text-left !max-w-[260px]"
                place="top"
              >
                <Icon
                  name="info-circle"
                  size="sm"
                  className="text-subtle hover:text-strong cursor-pointer ml-2"
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
