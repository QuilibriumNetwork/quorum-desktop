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
          <Trans>New Direct Message</Trans>
        </Button>
      </div>
    </>
  );
};
