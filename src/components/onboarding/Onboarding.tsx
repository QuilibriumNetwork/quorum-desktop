import React, { useEffect, useState } from 'react';
import Button from '../Button';
import {
  PasskeyModal,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';
import Input from '../Input';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImage } from '@fortawesome/free-solid-svg-icons';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { useUploadRegistration } from '../../hooks/mutations/useUploadRegistration';

export const Onboarding = ({
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
  const { currentPasskeyInfo, exportKey, updateStoredPasskey } =
    usePasskeysContext();
  const [exported, setExported] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentPasskeyInfo?.displayName ?? ''
  );
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  const downloadKey = async () => {
    let content = await exportKey(currentPasskeyInfo!.address);
    let fileName = currentPasskeyInfo!.address + '.key';
    const blob = new Blob([content], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setExported(true);
  };

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } =
    useDropzone({
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
      },
      minSize: 0,
      maxSize: 1 * 1024 * 1024,
    });

  useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        setFileData(await acceptedFiles[0].arrayBuffer());
      })();
    }
  }, [acceptedFiles]);

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
        <div className="flex flex-row grow font-semibold text-2xl">
          <div className="flex flex-col grow"></div>
          <div className="flex flex-col">
            {!exported
              ? 'Welcome to Quorum!'
              : currentPasskeyInfo?.pfpUrl && currentPasskeyInfo.displayName
                ? 'One of us, one of us!'
                : 'Personalize your account'}
          </div>
          <div className="flex flex-col grow"></div>
        </div>
        {!exported && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] py-4 text-justify">
                <b>Important first-time user information:</b> Quorum is
                peer-to-peer and end-to-end encrypted. This means your messages
                stay private, but equally important, they only live on the
                network for the time required to reach you and your recipients.{' '}
                {
                  //@ts-ignore
                  !window.electron ? (
                    <>
                      When using Quorum on a browser, your messages are saved
                      locally to your browser, so{' '}
                      <b>
                        if you clear your browser storage or switch browsers,
                        your old messages and keys may disappear.
                      </b>{' '}
                    </>
                  ) : (
                    <b>
                      If you uninstall the app, you will lose your old messages
                      and keys.{' '}
                    </b>
                  )
                }
                Click the button below to create a backup of your key info,
                because once it's gone, it's gone forever. You may be prompted
                to authenticate again.
              </div>
              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] pt-4 text-center">
                <Button type="primary" className="px-8 mr-4" onClick={downloadKey}>
                  Save User Key
                </Button>
                <Button
                  type="secondary"
                  className="px-8"
                  onClick={() => setExported(true)}
                >
                  I already saved mine
                </Button>
              </div>
              <div className="grow"></div>
            </div>
          </>
        )}
        {exported && !currentPasskeyInfo?.displayName && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] py-4 text-justify">
                Let your friends know who you are! Pick a friendly name to
                display in your conversations, something easier to read than{' '}
                {currentPasskeyInfo?.address}. This information is only provided
                to the spaces you join.
              </div>
              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] pt-4 text-center flex flex-row justify-between">
                <Input
                  className="!bg-[#272026] grow"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Bongocat"
                />
                <div className="flex flex-col justify-around pl-2">
                  <Button
                    type="primary"
                    disabled={displayName.length === 0}
                    className="px-8"
                    onClick={() => {
                      updateStoredPasskey(currentPasskeyInfo!.credentialId, {
                        credentialId: currentPasskeyInfo!.credentialId,
                        address: currentPasskeyInfo!.address,
                        publicKey: currentPasskeyInfo!.publicKey,
                        displayName: displayName,
                        completedOnboarding: false,
                      });
                    }}
                  >
                    Set Display Name
                  </Button>
                </div>
              </div>
              <div className="grow"></div>
            </div>
          </>
        )}
        {exported &&
          currentPasskeyInfo?.displayName &&
          !currentPasskeyInfo?.pfpUrl && (
            <>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-[460px] py-4 text-justify">
                  Make your account uniquely yours – set a contact photo. This
                  information is only provided to the spaces you join.
                </div>
                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-[460px] pt-4 text-center flex flex-row justify-around">
                  {acceptedFiles.length != 0 ? (
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <img
                        src={
                          fileData != undefined
                            ? 'data:' +
                              acceptedFiles[0].type +
                              ';base64,' +
                              Buffer.from(fileData).toString('base64')
                            : '/unknown.png'
                        }
                      />
                    </div>
                  ) : (
                    <div className="attachment-drop" {...getRootProps()}>
                      <span className="attachment-drop-icon inline-block justify-around w-20 h-20 flex flex-col">
                        <input {...getInputProps()} />
                        <FontAwesomeIcon icon={faFileImage} />
                      </span>
                    </div>
                  )}
                </div>
                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="flex flex-col justify-around pl-2 pt-4">
                  <Button
                    type="secondary"
                    className="px-8"
                    onClick={() => {
                      updateStoredPasskey(currentPasskeyInfo!.credentialId, {
                        credentialId: currentPasskeyInfo!.credentialId,
                        address: currentPasskeyInfo!.address,
                        publicKey: currentPasskeyInfo!.publicKey,
                        displayName: displayName,
                        completedOnboarding: false,
                        pfpUrl: '/unknown.png',
                      });
                    }}
                  >
                    Skip Adding Photo
                  </Button>
                  <Button
                    type="primary"
                    disabled={!fileData}
                    className="px-8"
                    onClick={() => {
                      updateStoredPasskey(currentPasskeyInfo!.credentialId, {
                        credentialId: currentPasskeyInfo!.credentialId,
                        address: currentPasskeyInfo!.address,
                        publicKey: currentPasskeyInfo!.publicKey,
                        displayName: displayName,
                        completedOnboarding: false,
                        pfpUrl:
                          'data:' +
                          acceptedFiles[0].type +
                          ';base64,' +
                          Buffer.from(fileData!).toString('base64'),
                      });
                    }}
                  >
                    Save Contact Photo
                  </Button>
                </div>
                <div className="grow"></div>
              </div>
            </>
          )}
        {exported &&
          currentPasskeyInfo?.pfpUrl &&
          currentPasskeyInfo.displayName && (
            <>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-[460px] py-4 text-center">
                  You're all set. Welcome to Quorum!
                </div>
                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="flex flex-col justify-around pl-2">
                  <Button
                    type="primary"
                    className="px-8"
                    onClick={() => {
                      updateStoredPasskey(currentPasskeyInfo!.credentialId, {
                        credentialId: currentPasskeyInfo!.credentialId,
                        address: currentPasskeyInfo!.address,
                        publicKey: currentPasskeyInfo!.publicKey,
                        displayName: displayName,
                        completedOnboarding: true,
                        pfpUrl: currentPasskeyInfo.pfpUrl ?? '/unknown.png',
                      });
                      setUser({
                        displayName: displayName,
                        state: 'online',
                        status: '',
                        userIcon: currentPasskeyInfo.pfpUrl ?? '/unknown.png',
                        address: currentPasskeyInfo!.address,
                      });
                    }}
                  >
                    Let's gooooooooo
                  </Button>
                </div>
                <div className="grow"></div>
              </div>
            </>
          )}
        <div className="flex flex-row grow"></div>
      </div>
      <div className="flex flex-col grow"></div>
    </>
  );
};
