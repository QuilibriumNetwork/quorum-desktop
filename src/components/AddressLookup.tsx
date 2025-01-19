import React from 'react';
import { useLocalization, useRegistration } from '../hooks';
import { useNavigate } from 'react-router';
import Button from './Button';
import { getConfig } from '../config/config';

export const AddressLookup = ({ address }: { address: string }) => {
  const { data: registration } = useRegistration({ address });
  let { data: localization } = useLocalization({ langId: getConfig().langId });
  let navigate = useNavigate();
  return (
    <>
      {!registration.registered && (
        <div className="text-red-400 pt-2">User does not exist</div>
      )}
      <div className="modal-new-direct-message-actions">
        <Button
          className="w-32 inline-block"
          type="primary"
          disabled={!registration.registered}
          onClick={() => {
            if (!!address) {
              navigate('/messages/' + address);
            }
          }}
        >
          {localization.localizations['NEW_DIRECT_MESSAGE_BUTTON']([])}
        </Button>
      </div>
    </>
  );
};
