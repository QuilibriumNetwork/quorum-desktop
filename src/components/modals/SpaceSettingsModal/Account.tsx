import * as React from 'react';
import {
  Button,
  Input,
  Icon,
  Spacer,
  Callout,
  Text,
  Select,
  Switch,
  Flex,
  Tooltip,
} from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';
import { useSpaceLeaving } from '../../../hooks/business/spaces/useSpaceLeaving';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useUserRoleDisplay } from '../../../hooks/business/user/useUserRoleDisplay';
import { useChannelMute } from '../../../hooks/business/channels';
import { Role } from '../../../api/quorumApi';
import type { NotificationTypeId } from '../../../types/notifications';
import { ReactTooltip } from '../../ui';

interface AccountProps {
  spaceId: string;
  spaceName: string;
  displayName: string;
  setDisplayName: (value: string) => void;
  currentPasskeyInfo: {
    pfpUrl?: string;
    address: string;
  } | null;
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  avatarFileError: string | null;
  isAvatarUploading: boolean;
  isAvatarDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  markedForDeletion: boolean;
  markForDeletion: () => void;
  getProfileImageUrl: () => string;
  onSave: () => void;
  isSaving: boolean;
  hasValidationError: boolean;
  displayNameError: string | undefined;
  onClose: () => void;
  roles?: Role[];
  // Notification settings props (passed from parent)
  selectedMentionTypes: NotificationTypeId[];
  setSelectedMentionTypes: (types: NotificationTypeId[]) => void;
  isMentionSettingsLoading: boolean;
}

const Account: React.FunctionComponent<AccountProps> = ({
  spaceId,
  spaceName,
  displayName,
  setDisplayName,
  currentPasskeyInfo,
  fileData,
  currentFile,
  avatarFileError,
  isAvatarUploading,
  isAvatarDragActive,
  getRootProps,
  getInputProps,
  clearFileError,
  markedForDeletion,
  markForDeletion,
  getProfileImageUrl,
  onSave,
  isSaving,
  hasValidationError,
  displayNameError,
  onClose,
  roles,
  selectedMentionTypes,
  setSelectedMentionTypes,
  isMentionSettingsLoading,
}) => {
  const { currentPasskeyInfo: userInfo } = usePasskeysContext();
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  const {
    confirmationStep,
    handleLeaveClick,
    error: leaveError,
  } = useSpaceLeaving();

  // Get current user's roles (including private roles since user is viewing their own account)
  const { userRoles } = useUserRoleDisplay(
    userInfo?.address || '',
    roles,
    true
  );

  // Channel mute settings
  const { showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute } = useChannelMute({
    spaceId,
  });

  // Handler for hide muted channels toggle
  const handleShowMutedToggle = React.useCallback(() => {
    toggleShowMutedChannels();
  }, [toggleShowMutedChannels]);

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">
            <Trans>Account Settings</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>Manage your settings for <strong>{spaceName}</strong>.</Trans>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="text-subtitle-2">
          <Trans>Your Details</Trans>
        </div>
        <div className="text-label-strong pt-1">
          <Trans>Change your avatar and name for this Space</Trans>
        </div>
        <div className="flex items-start gap-4 pt-4">
          {(() => {
            // Determine if there's an avatar to display
            const hasExistingAvatar = currentPasskeyInfo?.pfpUrl && !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER);
            const hasAvatar = (fileData || hasExistingAvatar) && !markedForDeletion;
            const avatarUrl = getProfileImageUrl();
            const showImage = hasAvatar && avatarUrl !== 'var(--unknown-icon)';

            return (
              <>
                <div
                  id="space-profile-avatar-tooltip-target"
                  className={`avatar-upload ${!showImage ? 'empty' : ''}`}
                  style={showImage ? { backgroundImage: `url(${avatarUrl})` } : {}}
                  {...getRootProps()}
                >
                  <input {...getInputProps()} />
                  {!showImage && <Icon name="image" size="2xl" className="icon" />}
                  {showImage && (
                    <Tooltip id="space-profile-avatar-delete" content={t`Delete this image`} place="bottom">
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
                {!isAvatarUploading && !isAvatarDragActive && !showImage && (
                  <ReactTooltip
                    id="space-profile-avatar-tooltip"
                    content={t`Upload an avatar for this Space - PNG or JPG - Optimal ratio 1:1`}
                    place="bottom"
                    className="!w-[400px]"
                    anchorSelect="#space-profile-avatar-tooltip-target"
                  />
                )}
              </>
            );
          })()}
          <div className="flex-1">
            <Input
              className="w-full md:w-80 mt-3 ml-1"
              value={displayName}
              onChange={setDisplayName}
              placeholder={t`Display Name`}
              labelType="static"
              error={hasValidationError}
              errorMessage={displayNameError}
            />
          </div>
        </div>
        <Spacer size="lg" direction="vertical" />
        {avatarFileError && (
          <div className="mb-4">
            <div className="error-label flex items-center justify-between">
              <span>{avatarFileError}</span>
              <Icon
                name="close"
                className="cursor-pointer ml-2 text-sm opacity-70 hover:opacity-100"
                onClick={clearFileError}
              />
            </div>
          </div>
        )}
        {userRoles.length > 0 && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="text-subtitle-2">
              <Trans>Your Roles</Trans>
            </div>
            <div className="flex flex-wrap items-start gap-1 pt-2">
              {userRoles.map((r) => (
                <Text
                  key={'user-role-' + r.roleId}
                  className="inline-flex items-center py-[3px] px-3 rounded-full font-medium text-xs text-center select-none bg-success text-white"
                  style={{
                    background: 'rgb(var(--success))',
                  }}
                >
                  {r.displayName}
                </Text>
              ))}
            </div>
            <Spacer size="lg" direction="vertical" />
          </>
        )}

        {/* Notification Settings */}
        <>
          <Spacer size="md" direction="vertical" borderTop={true} />
          <div className="text-subtitle-2">
            <Trans>Notifications</Trans>
          </div>
          <div className="text-label-strong pt-1">
            <Trans>
              Select which types of notifications you want to receive
            </Trans>
          </div>
          <div className="pt-4">
            <Select
              value={selectedMentionTypes}
              onChange={(value: string | string[]) =>
                setSelectedMentionTypes(value as NotificationTypeId[])
              }
              multiple={true}
              placeholder={t`Select`}
              showSelectAllOption={true}
              selectAllLabel={t`All`}
              clearAllLabel={t`Clear`}
              options={[
                {
                  value: 'mention-you',
                  label: t`@you`,
                  subtitle: t`When someone mentions you directly`,
                },
                {
                  value: 'mention-everyone',
                  label: t`@everyone`,
                  subtitle: t`When someone mentions @everyone`,
                },
                {
                  value: 'mention-roles',
                  label: t`@roles`,
                  subtitle: t`When someone mentions a role you have`,
                  disabled: false,
                },
                {
                  value: 'reply',
                  label: t`Replies`,
                  subtitle: t`When someone replies to your messages`,
                },
              ]}
              size="medium"
              fullWidth={true}
              disabled={isMentionSettingsLoading}
            />
          </div>
          <Flex className="items-center gap-3 mt-4 mb-3">
            <Switch
              value={isSpaceMuted}
              onChange={toggleSpaceMute}
              accessibilityLabel={t`Mute all notifications from this space`}
            />
            <div className="text-label-strong">
              <Trans>Mute this Space</Trans>
            </div>
          </Flex>
          <Flex className="items-center gap-3">
            <Switch
              value={!showMutedChannels}
              onChange={handleShowMutedToggle}
              accessibilityLabel={t`Hide muted channels in list`}
            />
            <div className="text-label-strong">
              <Trans>Hide muted channels</Trans>
            </div>
          </Flex>
          <Spacer size="lg" direction="vertical" borderBottom={true} />
        </>

        {!isSpaceOwner && (
          <>
            <Spacer size="xl" direction="vertical" />
            <Callout variant="error" size="md">
              <div className="text-md">
                <Trans>Leave this space</Trans>
              </div>
              <div className="pt-2 text-sm">
                <Trans>
                  You won't be able to rejoin unless you are re-invited. Your
                  existing messages will NOT be deleted.
                </Trans>
              </div>
              {leaveError && <div className="pt-4 text-sm">{leaveError}</div>}
              <div className="pt-4 pb-2">
                <Button
                  type="danger-outline"
                  className="!w-auto !inline-flex"
                  onClick={() => handleLeaveClick(spaceId, onClose)}
                >
                  {confirmationStep === 0 ? (
                    <Trans>Leave Space</Trans>
                  ) : (
                    <Trans>Click again to confirm</Trans>
                  )}
                </Button>
              </div>
            </Callout>
          </>
        )}
      </div>
    </>
  );
};

export default Account;
