import React, { useState, useCallback } from 'react';
import { PasskeyModal } from '@quilibrium/quilibrium-js-sdk-channels';
import '../../styles/_passkey-modal.scss';
import { Input, Icon, Button, Tooltip, FileUpload } from '../primitives';
import { useQuorumApiClient } from '../context/QuorumApiContext';
// Use direct imports for better tree-shaking and to avoid import chain issues
import { useUploadRegistration } from '../../hooks/mutations/useUploadRegistration';
import { useOnboardingFlow } from '../../hooks/business/user/useOnboardingFlow';
import { useKeyBackup } from '../../hooks/useKeyBackup';
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
  const keyBackup = useKeyBackup();

  // API context
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  // FileUpload state management
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const maxImageSize = 25 * 1024 * 1024; // 25MB

  // Handle file upload
  const handleFilesSelected = useCallback((files: any[]) => {
    if (files.length > 0) {
      const file = files[0];
      setProfileImage(file.uri);
      setFileError(null);
    }
  }, []);

  const handleFileError = useCallback((error: Error) => {
    setFileError(error.message);
    setProfileImage(null);
  }, []);

  // Get image data URL for saving
  const getImageDataUrl = useCallback((): string | null => {
    return profileImage;
  }, [profileImage]);

  // Validation helpers
  const hasValidFile = !!profileImage;
  const canSaveFile = hasValidFile && !fileError;

  // Handle key download and mark as exported
  const handleDownloadKey = async () => {
    try {
      await keyBackup.downloadKey();
      onboardingFlow.markKeyAsExported();
    } catch (error) {
      console.error('Error downloading key:', error);
    }
  };

  // Handle "I already saved mine" without confirmation
  const handleAlreadySaved = () => {
    onboardingFlow.markKeyAsExported();
  };

  // Handle profile photo save
  const handleSavePhoto = () => {
    const dataUrl = getImageDataUrl();
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
              : onboardingFlow.currentPasskeyInfo?.pfpUrl &&
                  onboardingFlow.currentPasskeyInfo.displayName
                ? t`One of us, one of us!`
                : t`Personalize your account`}
          </div>
        </div>
        {isDragActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 pointer-events-none backdrop-blur-sm">
            <div className="flex flex-col p-12 border-2 border-dashed border-accent-500 rounded-2xl bg-white/90 shadow-2xl items-center transform scale-110 transition-all duration-200">
              <Icon
                name="image"
                className="text-5xl text-accent-500 mb-6"
              />
              <p className="text-xl">{t`Drop your profile photo here`}</p>
              <p className="text-sm text-subtle mt-2">
                {t`PNG, JPG or JPEG • Optimal ratio 1:1`}
              </p>
            </div>
          </div>
        )}
        {onboardingFlow.currentStep === 'key-backup' && (
          <>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-full max-w-[460px] px-4 py-4 text-left text-white">
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
                  <span
                    className="text-white text-sm cursor-pointer underline hover:text-white/80 transition-colors"
                    onClick={handleAlreadySaved}
                  >
                    {t`I already saved mine`}
                  </span>
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
                    error={
                      onboardingFlow.displayName.trim().toLowerCase() ===
                      'everyone'
                    }
                    errorMessage={t`'everyone' is a reserved name.`}
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
                    { maxFileSize: `25MB` }
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
              <div className="w-full max-w-[460px] px-4 py-4 text-center flex flex-row justify-around">
                <FileUpload
                  onFilesSelected={handleFilesSelected}
                  onError={handleFileError}
                  accept={{
                    'image/png': ['.png'],
                    'image/jpeg': ['.jpg', '.jpeg'],
                  }}
                  maxSize={maxImageSize}
                  multiple={false}
                  {...({ onDragActiveChange: setIsDragActive } as any)}
                >
                  <div
                    className={`avatar-upload ${!hasValidFile ? 'empty' : ''}`}
                    style={
                      hasValidFile
                        ? {
                            backgroundImage: `url(${getImageDataUrl() || DefaultImages.UNKNOWN_USER})`,
                          }
                        : {}
                    }
                  >
                    {!hasValidFile && <Icon name="image" size="2xl" className="icon" />}
                  </div>
                </FileUpload>
              </div>

              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="flex flex-col justify-around pl-2 pt-4">
                <Button
                  type="primary-white"
                  disabled={!canSaveFile}
                  className={`px-8 w-full sm:w-auto ${!canSaveFile ? 'btn-disabled-onboarding' : ''}`}
                  onClick={handleSavePhoto}
                >
                  {t`Save Contact Photo`}
                </Button>
                <div className="pt-8 text-center">
                  <span
                    className="text-white text-sm cursor-pointer hover:text-white/80 transition-colors"
                    onClick={handleSavePhoto}
                  >
                    {t`Skip Adding Photo`}
                  </span>
                  <Tooltip
                    id="profile-image-info"
                    content={t`If skipped, you'll get the default profile image and can set it later`}
                    place="bottom"
                    maxWidth={300}
                  >
                    <Icon
                      name="info-circle"
                      className="text-white/80 hover:text-white/60 cursor-pointer ml-2"
                      aria-label={t`If skipped, you'll get the default profile image and can set it later`}
                    />
                  </Tooltip>
                </div>
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
