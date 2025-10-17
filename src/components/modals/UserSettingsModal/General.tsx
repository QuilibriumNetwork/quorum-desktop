import * as React from 'react';
import { Button, Input, Icon, Spacer } from '../../primitives';
import { t } from '@lingui/core/macro';
import { ClickToCopyContent } from '../../ui';
import { DefaultImages } from '../../../utils';
import { ReactTooltip } from '../../ui';

interface GeneralProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  currentPasskeyInfo: {
    pfpUrl?: string;
    address: string;
  } | null;
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  userIconFileError: string | null;
  isUserIconUploading: boolean;
  isUserIconDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  getProfileImageUrl: () => string;
  onSave: () => void;
  isSaving: boolean;
  validationError?: string;
}

const General: React.FunctionComponent<GeneralProps> = ({
  displayName,
  setDisplayName,
  currentPasskeyInfo,
  fileData,
  currentFile,
  userIconFileError,
  isUserIconUploading,
  isUserIconDragActive,
  getRootProps,
  getInputProps,
  clearFileError,
  getProfileImageUrl,
  onSave,
  isSaving,
  validationError,
}) => {
  return (
    <>
      <div className="modal-content-header-avatar">
        <div
          id="user-icon-tooltip-target"
          className={`avatar-upload ${!fileData && (!currentPasskeyInfo?.pfpUrl || currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)) ? 'empty' : ''}`}
          style={
            fileData ||
            (currentPasskeyInfo?.pfpUrl &&
              !currentPasskeyInfo.pfpUrl.includes(
                DefaultImages.UNKNOWN_USER
              ))
              ? {
                  backgroundImage: `url(${getProfileImageUrl()})`,
                }
              : {}
          }
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          {!fileData &&
            (!currentPasskeyInfo?.pfpUrl ||
              currentPasskeyInfo.pfpUrl.includes(
                DefaultImages.UNKNOWN_USER
              )) && <Icon name="image" className="icon" />}
        </div>
        {!isUserIconUploading && !isUserIconDragActive && (
          <ReactTooltip
            id="user-icon-tooltip"
            content="Upload an avatar for your profile - PNG or JPG - Optimal ratio 1:1"
            place="bottom"
            className="!w-[400px]"
            anchorSelect="#user-icon-tooltip-target"
          />
        )}
        <div className="modal-text-section">
          <Input
            className="w-full md:w-80 modal-input-text"
            value={displayName}
            onChange={setDisplayName}
            label={t`Display Name`}
            labelType="static"
            error={!!validationError}
            errorMessage={validationError}
          />
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        {userIconFileError && (
          <div className="mb-4">
            <div className="error-label flex items-center justify-between">
              <span>{userIconFileError}</span>
              <Icon
                name="times"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearFileError}
              />
            </div>
          </div>
        )}
        <div className="modal-content-info">
          <div className="modal-text-label !text-xs !text-main">{t`Account Address`}</div>
          <div className="pt-2 mb-4 modal-text-small text-main">
            {t`This is your public address and is safe to share with anyone you want to interact with.`}
          </div>
          <div className="modal-input-display text-sm lg:text-base bg-field">
            <div className="break-all flex-1 mr-2">
              {currentPasskeyInfo!.address}
            </div>
            <ClickToCopyContent
              className="flex-shrink-0"
              tooltipText={t`Copy address`}
              text={currentPasskeyInfo!.address}
              tooltipLocation="top"
              iconClassName="text-surface-10"
            >
              <></>
            </ClickToCopyContent>
          </div>
        </div>
      </div>
    </>
  );
};

export default General;