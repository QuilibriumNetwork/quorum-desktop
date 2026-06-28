import * as React from 'react';
import {
  Input,
  Button,
  Modal,
  Switch,
  Icon,
  Tooltip,
  Flex,
  Spacer,
  Callout,
} from '../primitives';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useDirectMessageCreation } from '../../hooks';
import { useActionQueue } from '../context/ActionQueueContext';
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
    effectiveAddress,
    handleAddressChange,
    handleSubmit,
    buttonText,
    isButtonDisabled,
    error,
    existingConversation,
  } = useDirectMessageCreation();

  const { isOnline } = useActionQueue();

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
      } catch { /* ignore */ }
    })();
  }, [user.currentPasskeyInfo, keyset, getConfig]);

  // Override handleSubmit to save conversation settings (only for new conversations)
  const handleSubmitWithSettings = React.useCallback(async () => {
    // Only save conversation record for NEW conversations
    // For existing conversations, just navigate (don't overwrite their data).
    // Key the row on the RESOLVED Qm… address (effectiveAddress), never the raw
    // typed input: typing a @username would otherwise persist a row keyed by the
    // QNS name (e.g. "alice/alice") while navigation goes to the resolved Qm…,
    // splitting one partner into two contacts — and the name-keyed one is broken
    // (no registration, can't send, can't be re-resolved).
    if (effectiveAddress && !existingConversation) {
      // Persist the conversation record with the selected non-repudiability
      const now = Date.now();
      try {
        await messageDB.saveConversation({
          conversationId: effectiveAddress + '/' + effectiveAddress,
          address: effectiveAddress,
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
  }, [effectiveAddress, existingConversation, nonRepudiable, messageDB, handleSubmit]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
      size="small"
    >
      <div
        className="modal-new-direct-message w-full mx-auto"
        style={{ maxWidth: '500px' }}
      >
        {!isOnline && address && !existingConversation && (
          <Callout variant="warning" size="sm" className="mb-4 text-left">
            <Trans>You're offline. Looking up new users requires an internet connection.</Trans>
          </Callout>
        )}
        <p className="text-body text-subtle mb-4">
          {t`Enter a user's address or @username to start messaging them.`}
        </p>
        <div>
          <Input
            className="w-full !text-xs sm:!text-sm"
            onChange={(value: string) => handleAddressChange(value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && !isButtonDisabled) {
                e.preventDefault();
                handleSubmitWithSettings();
              }
            }}
            placeholder={t`Address (Qm...) or @username`}
            error={!!error}
            errorMessage={error || undefined}
            autoFocus={true}
          />
        </div>
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={true}
                onClick={() => {}}
              >
                {buttonText}
              </Button>
            </div>
          }
        >
          <div className="modal-new-direct-message-actions">
            <Button
              className="w-full sm:inline-block"
              type="primary"
              disabled={isButtonDisabled}
              onClick={handleSubmitWithSettings}
            >
              {buttonText}
            </Button>
          </div>
        </React.Suspense>

        <Spacer spaceBefore="lg" spaceAfter="md" border={true} direction="vertical" />
        <div>
          <Flex className="items-center justify-between">
            <Flex className="items-center">
              <span className="text-label-strong">{t`Always sign messages`}</span>
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
            </Flex>
            <Switch
              value={nonRepudiable}
              onChange={() => setNonRepudiable(!nonRepudiable)}
            />
          </Flex>
        </div>
      </div>
    </Modal>
  );
};

export default NewDirectMessageModal;
