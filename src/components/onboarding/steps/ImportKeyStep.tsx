import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import type { FileUploadFile } from '@quilibrium/quorum-shared';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ImportKeyStep: React.FC<StepProps> = ({ flow }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleFilesSelected = useCallback(
    async (files: FileUploadFile[]) => {
      if (files.length > 0 && files[0].file) {
        setDropError(null);
        await flow.importKeyFile(files[0].file);
      }
    },
    [flow.importKeyFile]
  );

  const handleFileError = useCallback((error: Error) => {
    setDropError(error.message);
  }, []);

  return (
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`Import your account key`}</h1>
      <p className="onboarding-description">
        {t`Select or drag your account key file to restore your account.`}
      </p>

      <div className="w-full max-w-xs mb-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onError={handleFileError}
          multiple={false}
          maxSize={5 * 1024}
          validator={(file) => file.name?.endsWith('.key') ? null : 'Only .key files are accepted'}
          {...({ onDragActiveChange: setIsDragActive } as any)}
        >
          <div
            className={`onboarding-dropzone${isDragActive ? ' onboarding-dropzone--active' : ''}`}
          >
            <div className="flex flex-col items-center">
              <Icon name="upload" size="xl" className="onboarding-icon mb-2" />
              <p className="text-sm">
                {t`Drag and drop or`}{' '}
                <span className="text-accent underline cursor-pointer">
                  {t`choose file`}
                </span>
              </p>
            </div>
          </div>
        </FileUpload>
      </div>

      <OnboardingInfoLink
        label={t`What is an account key?`}
        content={t`Your account key is a private key file (.key) that proves ownership of your account. You can download it from your account settings. Keep it safe — whoever has it can access your account.`}
      />

      {(flow.importError || dropError) && (
        <div className="mb-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="alert-circle" className="text-danger shrink-0" />
            <p className="text-sm text-danger">{t`Invalid Key File`}</p>
          </div>
          <p className="text-xs onboarding-label-muted">{flow.importError ?? dropError}</p>
        </div>
      )}

      <span
        className="onboarding-link"
        onClick={flow.startNewAccount}
      >
        {t`Create new account instead`}
      </span>
    </div>
  );
};
