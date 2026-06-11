import React, { useState, useCallback } from 'react';
import { Button, Icon, FileUpload, Input } from '../../primitives';
import { OnboardingInfoLink } from '../OnboardingInfoLink';
import { t } from '@lingui/core/macro';
import type { UseUnifiedOnboardingFlowReturn } from '../../../hooks/business/user/useUnifiedOnboardingFlow';
import type { FileUploadFile } from '@quilibrium/quorum-shared';
import {
  cleanHexKeyInput,
  isValidEd448HexKey,
  ED448_PRIVATE_KEY_HEX_LENGTH,
} from '../../../utils/privateKey';

interface StepProps {
  flow: UseUnifiedOnboardingFlowReturn;
}

// Import methods. 'phrase' (24-word recovery phrase) is intentionally not built
// yet — see candidates.md #31b (parked on a lead-dev product call). The mode
// switch is structured so it can be added without reworking this component.
type ImportMode = 'file' | 'paste';

export const ImportKeyStep: React.FC<StepProps> = ({ flow }) => {
  const [mode, setMode] = useState<ImportMode>('file');
  const [isDragActive, setIsDragActive] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // Paste-key state
  const [hexInput, setHexInput] = useState('');
  const [showKey, setShowKey] = useState(false);

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

  const cleanHex = cleanHexKeyInput(hexInput);
  const isHexValid = isValidEd448HexKey(cleanHex);

  // Live validation message (only once the user has typed something).
  const hexValidationMessage = (() => {
    if (hexInput.length === 0) return null;
    if (!/^[0-9a-f]*$/.test(cleanHex)) {
      return t`Key contains non-hexadecimal characters.`;
    }
    if (cleanHex.length !== ED448_PRIVATE_KEY_HEX_LENGTH) {
      return t`Key must be ${ED448_PRIVATE_KEY_HEX_LENGTH} characters (${cleanHex.length}/${ED448_PRIVATE_KEY_HEX_LENGTH}).`;
    }
    return null;
  })();

  const handlePasteSubmit = useCallback(async () => {
    if (!isHexValid) return;
    setDropError(null);
    // The SDK's importKeyFile reads the file as UTF-8 text and accepts a
    // 114-char hex string directly, so wrap the validated hex in a File and
    // reuse the exact same import path as the file upload.
    const file = new File([cleanHex], 'imported.key', { type: 'text/plain' });
    await flow.importKeyFile(file);
    // Don't leave the key sitting in component state after a successful handoff.
    setHexInput('');
    setShowKey(false);
  }, [cleanHex, isHexValid, flow.importKeyFile]);

  const switchMode = useCallback((next: ImportMode) => {
    setMode(next);
    setDropError(null);
    // Clear any pasted key when leaving paste mode.
    if (next !== 'paste') {
      setHexInput('');
      setShowKey(false);
    }
  }, []);

  return (
    <div className="onboarding-step-body">
      <h1 className="onboarding-title">{t`Import your account key`}</h1>
      <p className="onboarding-description">
        {t`Restore your account from your private key — upload the key file or paste the key directly.`}
      </p>

      {/* Mode toggle: upload a .key file or paste the raw key */}
      <div className="onboarding-segmented mb-4" role="tablist" aria-label={t`Import method`}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'file'}
          className={`onboarding-segmented__option${mode === 'file' ? ' onboarding-segmented__option--active' : ''}`}
          onClick={() => switchMode('file')}
        >
          {t`Upload file`}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'paste'}
          className={`onboarding-segmented__option${mode === 'paste' ? ' onboarding-segmented__option--active' : ''}`}
          onClick={() => switchMode('paste')}
        >
          {t`Paste key`}
        </button>
      </div>

      {mode === 'file' && (
        <div className="w-full max-w-xs mb-6">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            onError={handleFileError}
            multiple={false}
            maxSize={5 * 1024}
            validator={(file: FileUploadFile) =>
              file.name?.endsWith('.key') ? null : 'Only .key files are accepted'
            }
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
      )}

      {mode === 'paste' && (
        <div className="onboarding-input-wrapper">
          <span className="text-xs onboarding-label-muted mb-1">{t`Private key (hex)`}</span>
          <Input
            variant="filled"
            type={showKey ? 'text' : 'password'}
            value={hexInput}
            onChange={setHexInput}
            placeholder={t`Paste your private key`}
            error={!!hexValidationMessage}
            errorMessage={hexValidationMessage ?? undefined}
            className="font-mono"
            accessibilityLabel={t`Private key (hex)`}
            rightIcon={
              <button
                type="button"
                className="onboarding-input-reveal"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? t`Hide key` : t`Show key`}
              >
                <Icon name={showKey ? 'eye-off' : 'eye'} size="sm" />
              </button>
            }
          />

          <Button
            type="primary"
            className="onboarding-action mt-3"
            disabled={!isHexValid}
            onClick={handlePasteSubmit}
          >
            {t`Import account`}
          </Button>
        </div>
      )}

      <OnboardingInfoLink
        label={t`What is an account key?`}
        content={t`Your account key is a private key that proves ownership of your account. You can download it as a file (.key) or copy it from your account settings. Keep it safe — whoever has it can access your account.`}
      />

      {(flow.importError || dropError) && (
        <div className="mb-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="alert-circle" className="text-danger shrink-0" />
            <p className="text-sm text-danger">{t`Could not import key`}</p>
          </div>
          <p className="text-xs onboarding-label-muted">{flow.importError ?? dropError}</p>
        </div>
      )}

      <span className="onboarding-link" onClick={flow.startNewAccount}>
        {t`Create new account instead`}
      </span>
    </div>
  );
};
