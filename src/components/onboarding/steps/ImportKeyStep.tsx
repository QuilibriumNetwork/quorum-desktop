import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload } from '../../primitives';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import type { FileUploadFile } from '@quilibrium/quorum-shared';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

export const ImportKeyStep: React.FC<StepProps> = ({ flow }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFilesSelected = useCallback(
    async (files: FileUploadFile[]) => {
      if (files.length > 0 && files[0].file) {
        await flow.importKeyFile(files[0].file);
      }
    },
    [flow.importKeyFile]
  );

  const handleFileError = useCallback((_error: Error) => {
    // FileUpload handles displaying the error; nothing to reset here
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold mb-2">{t`Import your account key`}</h1>
      <p className="text-sm opacity-60 mb-8 max-w-xs">
        {t`Select or drag your account key file to restore your account.`}
      </p>

      <div className="w-full max-w-xs mb-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onError={handleFileError}
          accept={{ 'application/octet-stream': ['.key'] }}
          multiple={false}
          {...({ onDragActiveChange: setIsDragActive } as any)}
        >
          <div
            className={`onboarding-dropzone${isDragActive ? ' onboarding-dropzone--active' : ''}`}
          >
            <Icon name="upload" size="xl" className="mb-2 opacity-40" />
            <p className="text-sm">
              {t`Drag and drop or`}{' '}
              <span className="text-accent underline cursor-pointer">
                {t`choose file`}
              </span>
            </p>
          </div>
        </FileUpload>
      </div>

      {flow.importError && (
        <div className="mb-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="alert-circle" className="text-danger shrink-0" />
            <p className="text-sm text-danger">{t`Invalid Key File`}</p>
          </div>
          <p className="text-xs opacity-50">{flow.importError}</p>
        </div>
      )}

      <span
        className="text-sm opacity-50 underline cursor-pointer"
        onClick={flow.startNewAccount}
      >
        {t`Create new account instead`}
      </span>
    </div>
  );
};
