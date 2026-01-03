import * as React from 'react';
import {
  Button,
  Select,
  Switch,
  Input,
  Icon,
  Tooltip,
  Spacer,
  TextArea,
} from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Channel, Group } from '../../../api/quorumApi';
import { isFeatureEnabled } from '../../../utils/platform';
import { validateSpaceName } from '../../../hooks/business/validation';
import { ReactTooltip } from '../../ui';

interface GeneralProps {
  space: any;
  spaceName: string;
  setSpaceName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  descriptionErrors: string[];
  maxDescriptionLength: number;
  fixes?: {
    id: string;
    message: string;
    actionLabel: string;
    onFix: () => void;
    loading?: boolean;
  }[];
  iconData: ArrayBuffer | undefined;
  currentIconFile: File | undefined;
  iconFileError: string | null;
  isIconUploading: boolean;
  isIconDragActive: boolean;
  getIconRootProps: () => any;
  getIconInputProps: () => any;
  clearIconFileError: () => void;
  iconMarkedForDeletion: boolean;
  markIconForDeletion: () => void;
  bannerData: ArrayBuffer | undefined;
  currentBannerFile: File | undefined;
  bannerFileError: string | null;
  isBannerUploading: boolean;
  isBannerDragActive: boolean;
  getBannerRootProps: () => any;
  getBannerInputProps: () => any;
  clearBannerFileError: () => void;
  bannerMarkedForDeletion: boolean;
  markBannerForDeletion: () => void;
  defaultChannel: Channel | undefined;
  setDefaultChannel: (channel: Channel) => void;
  getChannelGroups: any;
  isRepudiable: boolean;
  setIsRepudiable: (value: boolean) => void;
  saveEditHistory: boolean;
  setSaveEditHistory: (value: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  hasValidationError: boolean;
}

const General: React.FunctionComponent<GeneralProps> = ({
  space,
  spaceName,
  setSpaceName,
  description,
  setDescription,
  descriptionErrors,
  maxDescriptionLength,
  fixes,
  iconData,
  currentIconFile,
  iconFileError,
  isIconUploading,
  isIconDragActive,
  getIconRootProps,
  getIconInputProps,
  clearIconFileError,
  iconMarkedForDeletion,
  markIconForDeletion,
  bannerData,
  currentBannerFile,
  bannerFileError,
  isBannerUploading,
  isBannerDragActive,
  getBannerRootProps,
  getBannerInputProps,
  clearBannerFileError,
  bannerMarkedForDeletion,
  markBannerForDeletion,
  defaultChannel,
  setDefaultChannel,
  getChannelGroups,
  isRepudiable,
  setIsRepudiable,
  saveEditHistory,
  setSaveEditHistory,
  onSave,
  isSaving,
  hasValidationError,
}) => {
  // Feature flag: only show edit history toggle if enabled via environment variable
  const showEditHistoryToggle = isFeatureEnabled('ENABLE_EDIT_HISTORY');

  // Determine if there's an icon to display (new upload or existing, not marked for deletion)
  const hasIcon = (iconData && currentIconFile) || (space?.iconUrl && !iconMarkedForDeletion);
  const iconImageUrl = iconData && currentIconFile
    ? `url(data:${currentIconFile.type};base64,${Buffer.from(iconData).toString('base64')})`
    : space?.iconUrl ? `url(${space.iconUrl})` : '';

  // Determine if there's a banner to display (new upload or existing, not marked for deletion)
  const hasBanner = (bannerData && currentBannerFile) || (space?.bannerUrl && !bannerMarkedForDeletion);
  const bannerImageUrl = bannerData && currentBannerFile
    ? `url(data:${currentBannerFile.type};base64,${Buffer.from(bannerData).toString('base64')})`
    : space?.bannerUrl ? `url(${space.bannerUrl})` : '';

  return (
    <>
      <div className="modal-content-header-avatar">
        <div
          id="space-icon-tooltip-target"
          className={`avatar-upload ${!hasIcon ? 'empty' : ''}`}
          style={hasIcon ? { backgroundImage: iconImageUrl } : {}}
          {...getIconRootProps()}
        >
          <input {...getIconInputProps()} />
          {!hasIcon && (
            <Icon name="image" size="2xl" className="icon" />
          )}
          {hasIcon && (
            <Tooltip id="space-icon-delete" content={t`Delete this image`} place="bottom">
              <button
                type="button"
                className="image-upload-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  markIconForDeletion();
                }}
                aria-label={t`Delete this image`}
              >
                <Icon name="trash" size="sm" />
              </button>
            </Tooltip>
          )}
        </div>
        {!isIconUploading && !isIconDragActive && !hasIcon && (
          <ReactTooltip
            id="space-icon-tooltip"
            content={t`Upload an icon for your Space - PNG or JPG - Optimal ratio 1:1`}
            place="bottom"
            className="!w-[400px]"
            anchorSelect="#space-icon-tooltip-target"
          />
        )}
        <Input
          className="w-full modal-input-text"
          value={spaceName}
          onChange={setSpaceName}
          placeholder={t`Space name`}
          labelType="static"
          error={hasValidationError}
          errorMessage={validateSpaceName(spaceName)}
        />
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">
          <Trans>Space Description</Trans>
        </div>
        <div className="w-full mb-2">
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder={t`Describe what this Space is about...`}
            rows={3}
            variant="filled"
            className="w-full space-description-text"
            error={descriptionErrors.length > 0}
            errorMessage={
              descriptionErrors.length > 0
                ? descriptionErrors.join('. ')
                : undefined
            }
          />
        </div>
        <div className="text-label mb-4 max-w-[500px]">
          <Trans>
            This description will be visible on invites and shown to people when
            they look up or join your Space using an invite link.
          </Trans>
        </div>
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2">
          <Trans>Space Banner</Trans>
        </div>
        <div className="modal-content-info">
          <div
            id="space-banner-tooltip-target"
            className={
              'modal-banner-editable ' +
              (hasBanner ? '' : 'border-2 border-dashed border-accent-200')
            }
            style={hasBanner ? { backgroundImage: bannerImageUrl } : {}}
            {...getBannerRootProps()}
          >
            <input {...getBannerInputProps()} />
            {hasBanner && (
              <Tooltip id="space-banner-delete" content={t`Delete this image`} place="top">
                <button
                  type="button"
                  className="image-upload-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    markBannerForDeletion();
                  }}
                  aria-label={t`Delete this image`}
                >
                  <Icon name="trash" size="sm" />
                </button>
              </Tooltip>
            )}
          </div>
          {!isBannerUploading && !isBannerDragActive && !hasBanner && (
            <ReactTooltip
              id="space-banner-tooltip"
              content={t`Upload a banner for your Space - PNG or JPG - Optimal ratio 3:1`}
              place="top"
              className="!w-[400px]"
              anchorSelect="#space-banner-tooltip-target"
            />
          )}
          {(iconFileError || bannerFileError) && (
            <div className="mt-4 space-y-2">
              {iconFileError && (
                <div className="error-label flex items-center justify-between">
                  <span>{iconFileError}</span>
                  <Icon
                    name="close"
                    className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                    onClick={clearIconFileError}
                  />
                </div>
              )}
              {bannerFileError && (
                <div className="error-label flex items-center justify-between">
                  <span>{bannerFileError}</span>
                  <Icon
                    name="close"
                    className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                    onClick={clearBannerFileError}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">
          <Trans>Default Channel</Trans>
        </div>
        <div className="modal-content-info">
          <Select
            fullWidth
            groups={getChannelGroups}
            value={defaultChannel?.channelId || ''}
            onChange={(channelId: string) => {
              const channel = space?.groups
                ?.flatMap((g: Group) => g.channels)
                ?.find((c: Channel) => c.channelId === channelId);
              if (channel) {
                setDefaultChannel(channel);
              }
            }}
            placeholder={t`Select default channel`}
            style={{ textAlign: 'left' }}
          />
        </div>
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">
          <Trans>Privacy Settings</Trans>
        </div>
        <div className="modal-content-info">
          <div className="flex flex-row items-center gap-3 mb-3">
            <Switch
              onChange={() => setIsRepudiable(!isRepudiable)}
              value={!isRepudiable}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                <Trans>Require Message Signing</Trans>
              </div>
              <Tooltip
                id="repudiability-tooltip"
                content={t`When messages are signed, senders confirm they come from their key. When messages aren't signed, senders have plausible deniability. This setting applies to all messages in this Space.`}
                place="bottom"
                className="!w-[400px]"
                maxWidth={400}
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                />
              </Tooltip>
            </div>
          </div>
          {showEditHistoryToggle && (
            <>
            <div className="flex flex-row items-center gap-3">
              <Switch
                onChange={() => setSaveEditHistory(!saveEditHistory)}
                value={saveEditHistory}
              />
              <div className="flex flex-row items-center">
                <div className="text-label-strong">
                  <Trans>Save Edit History</Trans>
                </div>
                <Tooltip
                  id="save-edit-history-tooltip"
                  content={t`When enabled, all previous versions of edited messages will be saved. When disabled, only the current edited version is kept.`}
                  place="bottom"
                  className="!w-[400px]"
                  maxWidth={400}
                >
                  <Icon
                    name="info-circle"
                    className="text-main hover:text-strong cursor-pointer ml-2"
                  />
                </Tooltip>
              </div>
            </div>
            </>
          )}
        </div>
        {/* Fixes section (hidden if none) */}
        {fixes && fixes.length > 0 && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="text-subtitle-2 mb-2">
              <Trans>Fixes</Trans>
            </div>
            <div className="modal-content-info">
              <div className="flex flex-col gap-2">
                {fixes.map((fix) => (
                  <div
                    key={fix.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-md border"
                  >
                    <div className="text-sm" style={{ lineHeight: 1.3 }}>
                      {fix.message}
                    </div>
                    <Button
                      type="secondary"
                      size="small"
                      className="whitespace-nowrap"
                      onClick={fix.onFix}
                      disabled={!!fix.loading}
                    >
                      {fix.loading ? t`Fixing...` : fix.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default General;
