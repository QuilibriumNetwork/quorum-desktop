import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { t } from '@lingui/core/macro';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import type { FileUploadFile } from '@quilibrium/quorum-shared';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ProfilePhotoStep: React.FC<StepProps> = ({ flow }) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleProcessImage = useCallback(async (file: File): Promise<File> => {
    const result = await processAvatarImage(file);
    return result.file;
  }, []);

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
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`Add a profile photo`}</h1>
      <p className="onboarding-description">
        {t`Help others recognize you with a profile picture.`}
      </p>

      <div className="mb-8">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onError={handleFileError}
          accept={{
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif'],
            'image/heic': ['.heic'],
            'image/heif': ['.heif'],
          }}
          maxSize={FILE_SIZE_LIMITS.MAX_INPUT_SIZE}
          multiple={false}
          onProcessImage={handleProcessImage}
          {...({ onDragActiveChange: setIsDragActive } as any)}
        >
          <div
            className={`onboarding-avatar-dropzone${isDragActive ? ' onboarding-dropzone--active' : ''}`}
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
              <Icon name={isDragActive ? 'upload' : 'image'} size="2xl" className="onboarding-icon" />
            )}
          </div>
        </FileUpload>
      </div>

      {fileError && (
        <p className="text-sm text-danger mb-4">{fileError}</p>
      )}

      <Button
        type="primary"
        className="onboarding-action"
        onClick={handleContinue}
      >
        {t`Continue`}
      </Button>

      <Button
        type="secondary"
        className="onboarding-action"
        onClick={handleSkip}
      >
        {t`Skip for now`}
      </Button>
    </div>
  );
};
