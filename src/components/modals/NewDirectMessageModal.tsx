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

  const { data: conversations } = useConversations({ type: 'direct' });
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
      setError(
        t`Invalid address format. Addresses must use valid alphanumeric characters.`
      );
      return;
    }
  }, [address, ownAddress]);

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
    </Modal>
  );
};

export default NewDirectMessageModal;
