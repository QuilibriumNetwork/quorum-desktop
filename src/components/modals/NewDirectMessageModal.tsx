import * as React from 'react';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import { useNavigate } from 'react-router';
import {  useRegistration } from '../../hooks';
import { getConfig } from '../../config/config';
import { AddressLookup } from '../AddressLookup';
import './NewDirectMessageModal.scss';
import { t } from '@lingui/core/macro';

type NewDirectMessageModalProps = {
  visible: boolean;
  onClose: () => void;
};

const NewDirectMessageModal: React.FunctionComponent<
  NewDirectMessageModalProps
> = (props) => {
  let [address, setAddress] = React.useState<string | undefined>(undefined);

  const lookupUser = (address: string) => {
    if (address == '' || address.length != 46) {
      setAddress(undefined);
    } else {
      setAddress(address);
    }
  };

  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t`New Direct Message`}
    >
      <div className="modal-new-direct-message">
        <div>
          <Input
            className="w-[400pt] !text-xs"
            onChange={(e) => lookupUser(e.target.value)}
            placeholder={t`Enter a user's address to start messaging them.`}
          />
        </div>
        <React.Suspense
          fallback={
            <div className="modal-new-direct-message-actions">
              <Button
                className="w-40 inline-block"
                type="primary"
                disabled={!address}
                onClick={() => {}}
              >
                {t`Send`}
              </Button>
            </div>
          }
        >
          {address?.length == 46 && <AddressLookup address={address} />}
        </React.Suspense>
        {address?.length != 46 && (
          <div className="modal-new-direct-message-actions">
            <Button
              className="w-32 inline-block"
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
