import * as React from 'react';
import { Button, Select, Switch, Input, Icon, Tooltip, Spacer } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ReactTooltip } from '../../ui';
import { Channel } from '../../../api/quorumApi';

interface GeneralProps {
  space: any;
  spaceName: string;
  setSpaceName: (value: string) => void;
  fixes?: { id: string; message: string; actionLabel: string; onFix: () => void; loading?: boolean }[];
  iconData: ArrayBuffer | undefined;
  currentIconFile: File | undefined;
  iconFileError: string | null;
  isIconUploading: boolean;
  isIconDragActive: boolean;
  getIconRootProps: () => any;
  getIconInputProps: () => any;
  clearIconFileError: () => void;
  bannerData: ArrayBuffer | undefined;
  currentBannerFile: File | undefined;
  bannerFileError: string | null;
  isBannerUploading: boolean;
  isBannerDragActive: boolean;
  getBannerRootProps: () => any;
  getBannerInputProps: () => any;
  clearBannerFileError: () => void;
  defaultChannel: Channel | undefined;
  setDefaultChannel: (channel: Channel) => void;
  getChannelGroups: any;
  isRepudiable: boolean;
  setIsRepudiable: (value: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
  hasValidationError: boolean;
}

const General: React.FunctionComponent<GeneralProps> = ({
  space,
  spaceName,
  setSpaceName,
  fixes,
  iconData,
  currentIconFile,
  iconFileError,
  isIconUploading,
  isIconDragActive,
  getIconRootProps,
  getIconInputProps,
  clearIconFileError,
  bannerData,
  currentBannerFile,
  bannerFileError,
  isBannerUploading,
  isBannerDragActive,
  getBannerRootProps,
  getBannerInputProps,
  clearBannerFileError,
  defaultChannel,
  setDefaultChannel,
  getChannelGroups,
  isRepudiable,
  setIsRepudiable,
  onSave,
  isSaving,
  hasValidationError,
}) => {
  return (
    <>
      <div className="modal-content-header-avatar">
        <div
          id="space-icon-tooltip-target"
          className={`avatar-upload ${!iconData && !space?.iconUrl ? 'empty' : ''}`}
          style={
            (iconData && currentIconFile) || space?.iconUrl
              ? {
                  backgroundImage:
                    iconData != undefined && currentIconFile
                      ? 'url(data:' +
                        currentIconFile.type +
                        ';base64,' +
                        Buffer.from(iconData).toString(
                          'base64'
                        ) +
                        ')'
                      : `url(${space?.iconUrl})`,
                }
              : {}
          }
          {...getIconRootProps()}
        >
          <input {...getIconInputProps()} />
          {!iconData && !space?.iconUrl && (
            <Icon name="image" size="2xl" className="icon" />
          )}
        </div>
        {!isIconUploading && !isIconDragActive && (
          <ReactTooltip
            id="space-icon-tooltip"
            content="Upload an avatar for this Space - PNG or JPG - Optimal ratio 1:1"
            place="bottom"
            className="!w-[400px]"
            anchorSelect="#space-icon-tooltip-target"
          />
        )}
        <div className="modal-text-section">
          <Input
            className="w-full md:w-80 modal-input-text"
            value={spaceName}
            onChange={setSpaceName}
            label={t`Space Name`}
            labelType="static"
            error={hasValidationError}
            errorMessage={hasValidationError ? t`Space name is required` : undefined}
          />
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="modal-text-label">
          <Trans>Space Banner</Trans>
        </div>
        <div className="modal-content-info">
          <div
            id="space-banner-tooltip-target"
            className={
              'modal-banner-editable ' +
              (space?.bannerUrl || currentBannerFile
                ? ''
                : 'border-2 border-dashed border-accent-200')
            }
            style={{
              backgroundImage:
                bannerData != undefined && currentBannerFile
                  ? 'url(data:' +
                    currentBannerFile.type +
                    ';base64,' +
                    Buffer.from(bannerData).toString('base64') +
                    ')'
                  : `url(${space?.bannerUrl})`,
            }}
            {...getBannerRootProps()}
          >
            <input {...getBannerInputProps()} />
          </div>
          {!isBannerUploading && !isBannerDragActive && (
            <ReactTooltip
              id="space-banner-tooltip"
              content="Upload a banner for this Space - PNG or JPG - Optimal ratio 16:9"
              place="bottom"
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
        <div className="modal-text-label">
          <Trans>Default Channel</Trans>
        </div>
        <div className="modal-content-info">
          <Select
            fullWidth
            groups={getChannelGroups}
            value={defaultChannel?.channelId || ''}
            onChange={(channelId: string) => {
              const channel = space?.groups
                .flatMap((g) => g.channels)
                .find((c) => c.channelId === channelId);
              if (channel) {
                setDefaultChannel(channel);
              }
            }}
            placeholder={t`Select default channel`}
            style={{ textAlign: 'left' }}
          />
        </div>
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="modal-text-label">
          <Trans>Privacy Settings</Trans>
        </div>
        <div className="modal-content-info">
          <div className="flex flex-row justify-between">
            <div className="flex flex-row items-center">
              <div className="modal-text-small text-main">
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
            <Switch
              onChange={() => setIsRepudiable(!isRepudiable)}
              value={!isRepudiable}
            />
          </div>
        </div>
        {/* Fixes section (hidden if none) */}
        {fixes && fixes.length > 0 && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="modal-text-label">
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
                    <Button type="secondary" size="small" className="whitespace-nowrap" onClick={fix.onFix} disabled={!!fix.loading}>
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