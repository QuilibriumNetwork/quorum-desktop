import React from 'react';
import { useRegistration } from '../hooks';
import { useNavigate } from 'react-router';
import Button from './Button';
import { Trans } from '@lingui/react/macro';

export const AddressLookup = ({ address }: { address: string }) => {
  const { data: registration } = useRegistration({ address });
  let navigate = useNavigate();
  return (
    <>
      {!registration.registered && (
        <div className="text-red-400 pt-2">
          <Trans>User does not exist</Trans>
        </div>
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
          <Trans>Send</Trans>
        </Button>
      </div>
    </>
  );
};
