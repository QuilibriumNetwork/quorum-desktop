import React from 'react';
import {
  PasskeyModal,
} from '@quilibrium/quilibrium-js-sdk-channels';
import '../../styles/_passkey-modal.scss';
import { Input, Icon, Button, Tooltip } from '../primitives';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { 
  useUploadRegistration,
  useOnboardingFlow,
  useWebKeyBackup,
  useWebFileUpload
} from '../../hooks';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { Trans } from '@lingui/react/macro';
import { DefaultImages } from '../../utils';

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
  // Business logic hooks
  const onboardingFlow = useOnboardingFlow();
  const keyBackup = useWebKeyBackup();
  const fileUpload = useWebFileUpload();

  // API context
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  // Handle key download and mark as exported
  const handleDownloadKey = async () => {
    try {
      await keyBackup.downloadKey();
      onboardingFlow.markKeyAsExported();
    } catch (error) {
      console.error('Error downloading key:', error);
    }
  };

  // Handle "I already saved mine" with confirmation
  const handleAlreadySaved = () => {
    const canProceed = keyBackup.handleAlreadySaved();
    if (canProceed) {
      onboardingFlow.markKeyAsExported();
    }
  };

  // Handle profile photo save
  const handleSavePhoto = () => {
    const dataUrl = fileUpload.getImageDataUrl();
    onboardingFlow.saveProfilePhoto(dataUrl || undefined);
  };

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
        <div className="flex flex-row grow font-semibold text-2xl justify-center px-4">
          <div className="flex flex-col text-white text-center">
            {onboardingFlow.currentStep === 'key-backup'
              ? t`Welcome to Quorum!`
              : onboardingFlow.currentPasskeyInfo?.pfpUrl && onboardingFlow.currentPasskeyInfo.displayName
                ? t`One of us, one of us!`
                : t`Personalize your account`}
          </div>
        </div>
        {fileUpload.isDragActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay pointer-events-none">
            <div className="flex flex-col p-8 border-2 border-dashed border-white rounded-lg bg-white bg-opacity-50 items-center">
              <Icon name="file-image" className="text-4xl text-gray-700 mb-4" />
              <p className="text-xl font-semibold text-gray-800">
                {t`Drop your profile photo here`}
              </p>
            </div>
          </div>
        )}
        {onboardingFlow.currentStep === 'key-backup' && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-full max-w-[460px] px-4 py-4 text-justify text-white">
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
              <div className="w-full max-w-[460px] px-4 pt-4 text-center">
                <Button
                  type="primary-white"
                  className="px-8 mb-4 w-full sm:w-auto"
                  onClick={handleDownloadKey}
                >
                  {t`Save User Key`}
                </Button>
                <div className="pt-4">
                  <Button
                    type="light-outline-white"
                    className="px-8 w-full sm:!w-auto sm:!inline-flex"
                    onClick={handleAlreadySaved}
                  >
                    {keyBackup.getConfirmationButtonText()}
                  </Button>
                </div>
              </div>
              <div className="grow"></div>
            </div>
          </>
        )}
        {onboardingFlow.currentStep === 'display-name' && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-full max-w-[460px] px-4 py-4 text-center text-white">
                <p className="pb-4">
                  <Trans>
                    Let your friends know who you are! Pick a friendly name to
                    display in your conversations, something easier to read
                    than:
                  </Trans>
                </p>
                <pre className="text-sm font-mono bg-black bg-opacity-20 p-2 rounded mb-4 break-all whitespace-pre-wrap word-break overflow-wrap-anywhere">
                  {onboardingFlow.currentPasskeyInfo?.address}
                </pre>
                <p className="text-sm">{t`This information is only provided to the Spaces you join.`}</p>
              </div>

              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-full max-w-[460px] px-4 pt-4 text-center flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Input
                    className="onboarding-input !bg-white w-full"
                    value={onboardingFlow.displayName}
                    onChange={onboardingFlow.setDisplayName}
                    placeholder="Bongocat"
                  />
                </div>
                <div className="flex flex-col justify-center sm:min-w-[180px] sm:pl-2">
                  <Button
                    type="primary-white"
                    disabled={!onboardingFlow.canProceedWithName}
                    className={`px-8 w-full ${!onboardingFlow.canProceedWithName ? 'btn-disabled-onboarding ' : ''}`}
                    onClick={onboardingFlow.saveDisplayName}
                  >
                    {t`Set Display Name`}
                  </Button>
                </div>
              </div>
              <div className="grow"></div>
            </div>
          </>
        )}
        {onboardingFlow.currentStep === 'profile-photo' && (
            <>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-full max-w-[460px] px-4 flex flex-col justify-center py-4 text-white">
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
                      { maxFileSize: `${fileUpload.maxImageSize / 1024 / 1024}MB` }
                    )}
                  </div>
                  {fileUpload.fileError && (
                    <div className="error-label mt-2">{fileUpload.fileError}</div>
                  )}
                </div>

                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-full max-w-[460px] px-4 py-4 text-center flex flex-row justify-around">
                  {fileUpload.hasValidFile ? (
                    <div {...fileUpload.getRootProps()}>
                      <input {...fileUpload.getInputProps()} />
                      <img
                        className="max-w-[200px] max-h-[200px] object-cover rounded-full mx-auto"
                        src={fileUpload.getImageDataUrl() || DefaultImages.UNKNOWN_USER}
                      />
                    </div>
                  ) : (
                    <div
                      className="attachment-drop cursor-pointer"
                      {...fileUpload.getRootProps()}
                    >
                      <span className="attachment-drop-icon justify-around w-20 h-20 flex flex-col">
                        <input {...fileUpload.getInputProps()} />
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
                      onClick={handleSavePhoto}
                    >
                      {t`Skip Adding Photo`}
                    </Button>
                    <Tooltip
                      id="profile-image-info"
                      content={t`If skipped, you'll get the default profile image and can set it later`}
                      place="right"
                      maxWidth={300}
                    >
                      <Icon
                        name="circle-info"
                        className="text-white/80 hover:text-white/60 cursor-pointer ml-2 my-auto"
                        aria-label={t`If skipped, you'll get the default profile image and can set it later`}
                      />
                    </Tooltip>
                  </div>
                  <Button
                    type="primary-white"
                    disabled={!fileUpload.canSaveFile}
                    className={`px-8 mt-4 w-full sm:w-auto ${!fileUpload.canSaveFile ? 'btn-disabled-onboarding' : ''}`}
                    onClick={handleSavePhoto}
                  >
                    {t`Save Contact Photo`}
                  </Button>
                </div>
                <div className="grow"></div>
              </div>
            </>
          )}
        {onboardingFlow.currentStep === 'complete' && (
            <>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="w-full max-w-[460px] px-4 py-4 text-center text-white">
                  {t`You're all set. Welcome to Quorum!`}
                </div>
                <div className="grow"></div>
              </div>
              <div className="flex flex-row justify-center">
                <div className="grow"></div>
                <div className="flex flex-col justify-around pl-2">
                  <Button
                    type="primary-white"
                    className="px-8 w-full sm:w-auto"
                    onClick={() => onboardingFlow.completeOnboarding(setUser)}
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
