import * as React from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import { useConversations } from '../../hooks';
import { AddressLookup } from '../AddressLookup';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';
import { base58btc } from 'multiformats/bases/base58';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  let [address, setAddress] = React.useState<string>('');
  let [error, setError] = React.useState<string | null>(null);

  const { data: conversations } =
    useConversations({ type: 'direct' });

  const conversationsList = [
    ...conversations.pages.flatMap((c: any) => c.conversations),
  ];

  const { currentPasskeyInfo } = usePasskeysContext();
  const ownAddress = currentPasskeyInfo?.address;

  const lookupUser = (value: string) => {
    setAddress(value.trim());
  };

  React.useEffect(() => {
    setError(null);

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
      setError(t`You already have a conversation with this user.`);
      return;
    }

    try {
      base58btc.baseDecode(address);
    } catch {
      setError(t`Invalid address format. Addresses must use valid alphanumeric characters.`);
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
            className="w-full !text-xs sm:!text-sm"
            onChange={(e) => lookupUser(e.target.value)}
            placeholder={t`User address here`}
          />
          {error && <div className="modal-new-direct-message-error">{error}</div>}
        </div>
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-full sm:max-w-32 sm:inline-block"
                type="primary"
                disabled={!address}
                onClick={() => {}}
              >
                {t`Send`}
              </Button>
            </div>
          }
        >
          {address.length === 46 && !error && <AddressLookup address={address} />}
        </React.Suspense>
        { (address.length !== 46 || error) && (
          <div className="modal-new-direct-message-actions">
            <Button
              className="w-full sm:max-w-32 sm:inline-block"
              type="primary"
              disabled={true}
              onClick={() => {}}
            >
              {t`Send`}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NewDirectMessageModal;
