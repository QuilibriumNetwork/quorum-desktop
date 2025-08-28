import * as React from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { base58btc } from 'multiformats/bases/base58';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConversations, useRegistration } from '../../hooks';
import { useNavigate } from 'react-router';
import { useModalContext } from '../AppWithSearch';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import ToggleSwitch from '../ToggleSwitch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import ReactTooltip from '../ReactTooltip';
import { useMessageDB } from '../context/MessageDB';
import { DefaultImages } from '../../utils';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  let [address, setAddress] = React.useState<string>('');
  let [error, setError] = React.useState<string | null>(null);
  let [buttonText, setButtonText] = React.useState<string>(t`Send`);
  let navigate = useNavigate();
  const { closeNewDirectMessage } = useModalContext();
  const { getConfig, keyset, messageDB } = useMessageDB();
  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);

  const { data: conversations } =
    useConversations({ type: 'direct' });
  const conversationsList = [
    ...conversations.pages.flatMap((c: any) => c.conversations),
  ];
  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address;

  const { apiClient } = useQuorumApiClient();

  const lookupUser = async (): Promise<boolean> => {
      setButtonText(t`Looking up user...`);
      try {
        await apiClient.getUser(address);
        return true;
      } catch (e) {
        setError(t`User does not exist.`);
        return false;
      } finally {
        setButtonText(t`Send`);
      }
  };

  const resetState = () => {
    setError(null);
    setButtonText(t`Send`);
  };

  React.useEffect(() => {
    resetState();

    if (!address) return;

    // check if address is the same as own address
    if (address === ownAddress) {
      setError(t`You cannot send a direct message to yourself.`);
      return;
    }

    // check if address is exactly 46 characters long
    if (address.length !== 46) {
      setError(t`Addresses must be exactly 46 characters long.`);
      return;
    }

    // check if address starts with Qm
    if (!address.startsWith('Qm')) {
      setError(t`Addresses start with "Qm".`);
      return;
    }

    // check if conversation already exists
    if (conversationsList.find((c: any) => c.address === address)) {
      setButtonText(t`Go to conversation`);
      return;
    }

    lookupUser().then((isRegistered: boolean) => {
      setError(isRegistered ? null : t`User does not exist.`);
    });

    try {
      base58btc.baseDecode(address);
    } catch {
      setError(t`Invalid address format. Addresses must use valid alphanumeric characters.`);
      return;
    }
  }, [address, ownAddress]);

  // Load user default non-repudiable setting to initialize the switch
  React.useEffect(() => {
    (async () => {
      if (!currentPasskeyInfo?.address || !keyset?.userKeyset) return;
      try {
        const cfg = await getConfig({
          address: currentPasskeyInfo.address,
          userKey: keyset.userKeyset,
        });
        setNonRepudiable(cfg?.nonRepudiable ?? true);
      } catch {}
    })();
  }, [currentPasskeyInfo, keyset, getConfig]);

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
    >
      <div className="modal-new-direct-message w-full max-w-[500px] mx-auto">
        <div className="mb-4 text-sm text-subtle text-left max-sm:text-center">
          {t`Enter a user's address to start messaging them.`}
        </div>
        <div>
          <Input
            className={`w-full !text-xs sm:!text-sm ${error ? 'error' : ''}`}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder={t`User address here`}
          />
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center text-sm text-subtle">
              <span className="mr-1">{t`Always sign messages`}</span>
              <FontAwesomeIcon
                className="text-subtle"
                icon={faCircleInfo}
                data-tooltip-id="dm-nonrepudiable-tip"
              />
            </div>
            <ToggleSwitch
              active={nonRepudiable}
              onClick={() => setNonRepudiable((s) => !s)}
            />
          </div>
        </div>
        {error && <div className="modal-new-direct-message-error">{error}</div>}
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={!address}
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
              disabled={!address || !!error}
              onClick={() => {
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
                  closeNewDirectMessage();
                  navigate('/messages/' + address);
                }
              }}
            >
              {buttonText}
            </Button>
          </div>
        </React.Suspense>
      </div>
      <ReactTooltip
        id="dm-nonrepudiable-tip"
        content={t`You can change this later per conversation from the header lock toggle.`}
        className="max-w-[260px]"
        place="top"
      />
    </Modal>
  );
};

export default NewDirectMessageModal;
