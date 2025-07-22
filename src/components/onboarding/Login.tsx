import React, { useState } from 'react';
import {
  PasskeyModal,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';
import '../../styles/_passkey-modal.scss';
import Button from '../Button';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { useUploadRegistration } from '../../hooks/mutations/useUploadRegistration';
import { t } from '@lingui/core/macro';

export const Login = ({
  setUser,
}: {
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
}) => {
  const { setShowPasskeyPrompt } = usePasskeysContext();
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  return (
    <>
      <PasskeyModal
        fqAppPrefix="Quorum"
        getUserRegistration={async (address: string) => {
          return (await apiClient.getUser(address)).data;
        }}
        uploadRegistration={uploadRegistration}
      />
      <div className="flex flex-col grow"></div>
      <div className="flex flex-col select-none">
        <div className="flex flex-row grow"></div>
        <div className="flex flex-row grow font-light text-5xl">
          <div className="flex flex-col grow"></div>
          <div className="flex flex-col pt-8">
            <img className="h-16" src="/quorum.png" />
          </div>
          <div className="flex flex-col grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="flex flex-col justify-center py-8">
            <Button
              type="primary-white"
              className="w-80 mt-2"
              onClick={() => {
                setShowPasskeyPrompt({
                  value: true,
                });
              }}
            >
              {t`Create New Account`}
            </Button>
            <Button
              type="light-outline-white"
              className="w-80 mt-4"
              onClick={() => {
                //@ts-ignore
                setShowPasskeyPrompt({
                  value: true,
                  importMode: true,
                });
              }}
            >
              {t`Import Existing Key`}
            </Button>
          </div>
        </div>
        <div className="flex flex-row grow"></div>
      </div>
      <div className="flex flex-col grow"></div>
    </>
  );
};
