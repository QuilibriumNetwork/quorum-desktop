import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import type { FileUploadFile } from '@quilibrium/quorum-shared';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ProfilePhotoStep: React.FC<StepProps> = ({ flow }) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const maxImageSize = 25 * 1024 * 1024; // 25MB

  const handleFilesSelected = useCallback(
    (files: FileUploadFile[]) => {
      if (files.length > 0) {
        flow.setProfileImagePreview(files[0].uri);
        setFileError(null);
      }
    },
    [flow.setProfileImagePreview]
  );

  const handleFileError = useCallback(
    (error: Error) => {
      setFileError(error.message);
      flow.setProfileImagePreview(null);
    },
    [flow.setProfileImagePreview]
  );

  const handleContinue = useCallback(() => {
    flow.saveProfilePhoto(flow.profileImagePreview ?? undefined);
  }, [flow.saveProfilePhoto, flow.profileImagePreview]);

  const handleSkip = useCallback(() => {
    flow.saveProfilePhoto(undefined);
  }, [flow.saveProfilePhoto]);

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Add a profile photo`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Help others recognize you with a profile picture.`}
      </p>

      <div className="mb-6">
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
            className={`onboarding-dropzone w-32 h-32 rounded-full flex items-center justify-center overflow-hidden${isDragActive ? ' onboarding-dropzone--active' : ''}`}
            style={
              flow.profileImagePreview
                ? {
                    backgroundImage: `url(${flow.profileImagePreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}
            }
          >
            {!flow.profileImagePreview && (
              <Icon name="camera" size="2xl" className="opacity-40" />
            )}
          </div>
        </FileUpload>
      </div>

      {fileError && (
        <p className="text-sm text-danger mb-4">{fileError}</p>
      )}

      <Button
        type="primary"
        className="w-full max-w-xs mb-3"
        onClick={handleContinue}
      >
        {t`Continue`}
      </Button>

      <span
        className="text-sm opacity-50 underline cursor-pointer"
        onClick={handleSkip}
      >
        {t`Skip for now`}
      </span>
    </div>
  );
};
