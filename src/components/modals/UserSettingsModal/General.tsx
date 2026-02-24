import * as React from 'react';
import { Input, Icon, Spacer, Tooltip, TextArea, Select } from '../../primitives';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ClickToCopyContent } from '../../ui';
import { DefaultImages } from '../../../utils';
import { ReactTooltip } from '../../ui';
import { SpaceTag } from '../../space/SpaceTag';
import { BroadcastSpaceTag } from '../../../api/quorumApi';
import { SelectOption } from '../../primitives/Select/types';

interface EligibleSpaceTag {
  spaceId: string;
  spaceName: string;
  iconUrl?: string;
  spaceTag: BroadcastSpaceTag;
}

interface GeneralProps {
  displayName: string;
  setDisplayName: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  bioErrors: string[];
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
  markedForDeletion: boolean;
  markForDeletion: () => void;
  getProfileImageUrl: () => string;
  onSave: () => void;
  isSaving: boolean;
  validationError?: string;
  spaceTagId: string | undefined;
  setSpaceTagId: (id: string | undefined) => void;
  eligibleSpaceTags: EligibleSpaceTag[];
}

const General: React.FunctionComponent<GeneralProps> = ({
  displayName,
  setDisplayName,
  bio,
  setBio,
  bioErrors,
  currentPasskeyInfo,
  fileData,
  currentFile,
  userIconFileError,
  isUserIconUploading,
  isUserIconDragActive,
  getRootProps,
  getInputProps,
  clearFileError,
  markedForDeletion,
  markForDeletion,
  getProfileImageUrl,
  onSave,
  isSaving,
  validationError,
  spaceTagId,
  setSpaceTagId,
  eligibleSpaceTags,
}) => {
  // Determine if there's an image to display (new upload or existing, not marked for deletion)
  const hasImage = (() => {
    if (markedForDeletion) return false;
    if (fileData && currentFile) return true;
    if (currentPasskeyInfo?.pfpUrl && !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)) return true;
    return false;
  })();
  return (
    <>
      <div className="modal-content-header-avatar">
        <div
          id="user-icon-tooltip-target"
          className={`avatar-upload ${!hasImage ? 'empty' : ''}`}
          style={hasImage ? { backgroundImage: `url(${getProfileImageUrl()})` } : {}}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          {!hasImage && <Icon name="image" size="2xl" className="icon" />}
          {hasImage && (
            <Tooltip id="user-avatar-delete" content={t`Delete this image`} place="bottom">
              <button
                type="button"
                className="image-upload-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  markForDeletion();
                }}
                aria-label={t`Delete this image`}
              >
                <Icon name="trash" size="sm" />
              </button>
            </Tooltip>
          )}
        </div>
        {!isUserIconUploading && !isUserIconDragActive && !hasImage && (
          <ReactTooltip
            id="user-icon-tooltip"
            content={t`Upload an avatar for your profile - PNG or JPG - Optimal ratio 1:1`}
            place="bottom"
            className="!w-[400px]"
            anchorSelect="#user-icon-tooltip-target"
          />
        )}
        <div className="modal-text-section">
          <Input
            className="w-full md:w-80"
            value={displayName}
            onChange={setDisplayName}
            placeholder={t`Display name`}
            labelType="static"
            error={!!validationError}
            errorMessage={validationError}
          />
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2">
          <Trans>Bio</Trans>
        </div>
        {/* Bio is local-only for now - not synced across devices. See .agents/tasks/add-user-bio-field.md for future sync work */}
        <div className="pt-2 text-label mb-4">
          <Trans>
            This bio will be visible to others when they view your profile.
          </Trans>
        </div>
        <div className="w-full mb-2">
          <TextArea
            value={bio}
            onChange={setBio}
            placeholder={t`Tell us about yourself...`}
            rows={3}
            variant="filled"
            className="w-full"
            error={bioErrors.length > 0}
            errorMessage={
              bioErrors.length > 0
                ? bioErrors.join('. ')
                : undefined
            }
          />
        </div>
        <Spacer size="md" direction="vertical" borderTop={true} />
        {userIconFileError && (
          <div className="mb-4">
            <div className="error-label flex items-center justify-between">
              <span>{userIconFileError}</span>
              <Icon
                name="close"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearFileError}
              />
            </div>
          </div>
        )}
        <div className="modal-content-info">
          <div className="text-subtitle-2">{t`Account Address`}</div>
          <div className="pt-2 mb-4 text-label">
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
        {/* Space Tag selector */}
        {eligibleSpaceTags.length > 0 && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="text-subtitle-2">
              <Trans>Space Tag</Trans>
            </div>
            <div className="pt-2 text-label mb-4">
              <Trans>
                Display a tag from one of your Spaces next to your username in messages.
              </Trans>
            </div>
            <Select
              value={spaceTagId ?? ''}
              options={[
                { value: '', label: t`None` },
                ...eligibleSpaceTags.map((s): SelectOption => ({
                  value: s.spaceId,
                  label: s.spaceName,
                  avatar: s.iconUrl,
                  displayName: s.spaceName,
                })),
              ]}
              onChange={(val) => {
                const v = val as string;
                setSpaceTagId(v === '' ? undefined : v);
              }}
              size="medium"
              variant="bordered"
              className="w-full md:w-80"
            />
            {spaceTagId && (() => {
              const selected = eligibleSpaceTags.find(s => s.spaceId === spaceTagId);
              return selected ? (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-label">
                    <Trans>Preview:</Trans>
                  </span>
                  <SpaceTag tag={selected.spaceTag} size="md" />
                </div>
              ) : null;
            })()}
          </>
        )}
      </div>
    </>
  );
};

export default General;