import React, { useEffect, useState } from 'react';
import Button from '../Button';
import {
  PasskeyModal,
  usePasskeysContext,
  passkey,
} from '@quilibrium/quilibrium-js-sdk-channels';
import '../../styles/_passkey-modal.scss';
import Input from '../Input';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImage, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { useUploadRegistration } from '../../hooks/mutations/useUploadRegistration';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { Trans } from '@lingui/react/macro';
import { DefaultImages } from '../../utils';
import ReactTooltip from '../ReactTooltip';

const maxImageSize = 2 * 1024 * 1024;

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
  const [fileError, setFileError] = useState<string | null>(null);

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

  const [tooltipVisible, setTooltipVisible] = useState(false);

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } =
    useDropzone({
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg'],
      },
      minSize: 0,
      maxSize: maxImageSize,
      maxFiles: 1,
      multiple: false,
      onDropRejected: (fileRejections) => {
        for (const rejection of fileRejections) {
          if (rejection.errors.some((err) => err.code === 'file-too-large')) {
            setFileError(
              i18n._(`File cannot be larger than {maxFileSize}`, {
                maxFileSize: `${maxImageSize / 1024 / 1024}MB`,
              })
            );
          } else {
            setFileError(t`File rejected`);
          }
        }
      },
      onDropAccepted: () => {
        setFileError(null);
      },
    });

  const setPfpImage = async () => {
    let pfpUrl: string = String(DefaultImages.UNKNOWN_USER);

    if (acceptedFiles.length > 0) {
      pfpUrl =
        'data:' +
        acceptedFiles[0].type +
        ';base64,' +
        Buffer.from(fileData!).toString('base64');
    }

    updateUserStoredInfo({ pfpUrl });
  };

  const updateUserStoredInfo = (
    updates: Partial<passkey.StoredPasskey> = {}
  ) => {
    updateStoredPasskey(currentPasskeyInfo!.credentialId, {
      credentialId: currentPasskeyInfo!.credentialId,
      address: currentPasskeyInfo!.address,
      publicKey: currentPasskeyInfo!.publicKey,
      displayName: displayName,
      completedOnboarding: false,
      pfpUrl: currentPasskeyInfo?.pfpUrl ?? DefaultImages.UNKNOWN_USER,
      ...updates,
    });
  };

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
          <div className="flex flex-col text-white">
            {!exported
              ? t`Welcome to Quorum!`
              : currentPasskeyInfo?.pfpUrl && currentPasskeyInfo.displayName
                ? t`One of us, one of us!`
                : t`Personalize your account`}
          </div>
          <div className="flex flex-col grow"></div>
        </div>
        {isDragActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay pointer-events-none">
            <div className="flex flex-col p-8 border-2 border-dashed border-white rounded-lg bg-white bg-opacity-50 items-center">
              <FontAwesomeIcon
                icon={faFileImage}
                className="text-4xl text-gray-700 mb-4"
              />
              <p className="text-xl font-semibold text-gray-800">
                {t`Drop your profile photo here`}
              </p>
            </div>
          </div>
        )}
        {!exported && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] py-4 text-justify text-white">
                <p className="py-4">
                  <b>{t`Important first-time user information:`}</b>
                </p>
                <p className="pb-4">
                  {t`Quorum is peer-to-peer and end-to-end encrypted. This means your messages stay private, but equally important, they only live on the network for the time required to reach you and your recipients.`}
                </p>
                <p className="pb-4">
                  {
                    // @ts-ignore
                    !window.electron ? (
                      <>
                        <p className="pb-4">
                          {t`When using Quorum on a browser, your messages are saved locally to your browser.`}
                        </p>
                        <p className="font-bold">
                          <b>
                            {t`If you clear your browser storage or switch browsers, your old messages and keys may disappear.`}
                          </b>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="pb-4 font-bold">
                          {t`If you uninstall the app from your device, you will lose your old messages and keys.`}
                        </p>
                      </>
                    )
                  }
                </p>
                <p className="pb-4">
                  {t`Click the button below to create a backup of your key info, because once it's gone, it's gone  forever. You may be prompted to authenticate again.`}
                </p>
              </div>

              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] pt-4 text-center">
                <Button
                  type="primary-white"
                  className="px-8 mb-4"
                  onClick={downloadKey}
                >
                  {t`Save User Key`}
                </Button>
                <Button
                  type="light-outline-white"
                  className="px-8"
                  onClick={() => setExported(true)}
                >
                  {t`I already saved mine`}
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
              <div className="w-[460px] py-4 text-justify text-white">
                <p className="pb-4">
                  <Trans>
                    Let your friends know who you are! Pick a friendly name to
                    display in your conversations, something easier to read than{' '}
                    {currentPasskeyInfo?.address}
                  </Trans>
                </p>
                <p>{t`This information is only provided to the Spaces you join.`}</p>
              </div>

              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] pt-4 text-center flex flex-row justify-between">
                <Input
                  className="onboarding-input !bg-white grow"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Bongocat"
                />
                <div className="flex flex-col justify-around pl-2">
                  <Button
                    type="primary-white"
                    disabled={displayName.length === 0}
                    className={`px-8 ${displayName.length === 0 ? 'btn-disabled-onboarding ' : ''}`}
                    onClick={() =>
                      updateUserStoredInfo({ displayName, pfpUrl: undefined })
                    }
                  >
                    {t`Set Display Name`}
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
                <div className="w-[460px] flex flex-col justify-center py-4 text-white">
                  <div className="mb-2 text-center">
                    {t`Make your account uniquely yours – set a contact photo. This information is only provided to the Spaces you join.`}
                  </div>
                  {/* <div className="mb-2 text-center">
                    {t`You can click the default image below to select it with your system's file dialog or drag and drop a new one.`}
                  </div>
                  <div className="mb-2 text-center">
                    {t`You will be able to change this later in your settings.`}
                  </div> */}
                  <div className="mb-2 text-sm text-center">
                    {i18n._(
                      `Your profile image size must be {maxFileSize} or less and must be a PNG, JPG, or JPEG file extension.`,
                      { maxFileSize: `${maxImageSize / 1024 / 1024}MB` }
                    )}
                  </div>
                  {fileError && (
                    <div className="error-label mt-2">{fileError}</div>
                  )}
                </div>

                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-[460px] py-4  text-center flex flex-row justify-around">
                  {acceptedFiles.length != 0 ? (
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <img
                        className="max-w-[200px] max-h-[200px] object-cover rounded-full mx-auto"
                        src={
                          fileData != undefined
                            ? 'data:' +
                              acceptedFiles[0].type +
                              ';base64,' +
                              Buffer.from(fileData).toString('base64')
                            : DefaultImages.UNKNOWN_USER
                        }
                      />
                    </div>
                  ) : (
                    <div
                      className="attachment-drop cursor-pointer"
                      {...getRootProps()}
                    >
                      <span className="attachment-drop-icon inline-block justify-around w-20 h-20 flex flex-col">
                        <input {...getInputProps()} />
                        <img
                          src={DefaultImages.UNKNOWN_USER}
                          className="w-20 h-20 object-cover rounded-full mx-auto"
                        />
                      </span>
                    </div>
                  )}
                </div>

                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="flex flex-col justify-around pl-2 pt-4">
                  <div className="flex flex-row justify-between ml-4">
                    <Button
                      type="light-outline-white"
                      className="px-8"
                      onClick={setPfpImage}
                    >
                      {t`Skip Adding Photo`}
                    </Button>
                    <>
                      <div className="flex flex-row justify-between">
                        <FontAwesomeIcon
                          icon={faCircleInfo}
                          id="profile-image-info-tooltip-anchor"
                          className="text-white/80 hover:text-white/60 cursor-pointer ml-2 my-auto"
                          aria-label={t`If skipped, you'll get the default profile image and can set it later`}
                        />
                      </div>

                      <ReactTooltip
                        id="profile-image-info-tooltip"
                        anchorSelect="#profile-image-info-tooltip-anchor"
                        content={t`If skipped, you'll get the default profile image and can set it later`}
                        place="right"
                      />
                    </>
                  </div>
                  <Button
                    type="primary-white"
                    disabled={!fileData || !!fileError}
                    className={`px-8 mt-4 ${!fileData || !!fileError ? 'btn-disabled-onboarding' : ''}`}
                    onClick={setPfpImage}
                  >
                    {t`Save Contact Photo`}
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
                <div className="w-[460px] py-4 text-center text-white">
                  {t`You're all set. Welcome to Quorum!`}
                </div>
                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="flex flex-col justify-around pl-2">
                  <Button
                    type="primary-white"
                    className="px-8"
                    onClick={() => {
                      updateUserStoredInfo({ completedOnboarding: true });
                      setUser({
                        displayName: displayName,
                        state: 'online',
                        status: '',
                        userIcon:
                          currentPasskeyInfo.pfpUrl ??
                          DefaultImages.UNKNOWN_USER,
                        address: currentPasskeyInfo!.address,
                      });
                    }}
                  >
                    {t`Let's gooooooooo`}
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
