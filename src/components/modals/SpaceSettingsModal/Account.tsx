import * as React from 'react';
import {
  Button,
  Input,
  Icon,
  Spacer,
  Callout,
  Text,
  Select,
} from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { ReactTooltip } from '../../ui';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';
import { useSpaceLeaving } from '../../../hooks/business/spaces/useSpaceLeaving';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useUserRoleDisplay } from '../../../hooks/business/user/useUserRoleDisplay';
import { useDisplayNameValidation } from '../../../hooks/business/validation';
import { Role } from '../../../api/quorumApi';
import type { NotificationTypeId } from '../../../types/notifications';

interface AccountProps {
  spaceId: string;
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
  getProfileImageUrl: () => string;
  onSave: () => void;
  isSaving: boolean;
  hasValidationError: boolean;
  onClose: () => void;
  roles?: Role[];
  // Notification settings props (passed from parent)
  selectedMentionTypes: NotificationTypeId[];
  setSelectedMentionTypes: (types: NotificationTypeId[]) => void;
  isMentionSettingsLoading: boolean;
}

const Account: React.FunctionComponent<AccountProps> = ({
  spaceId,
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
  getProfileImageUrl,
  onSave,
  isSaving,
  hasValidationError,
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
  const { userRoles } = useUserRoleDisplay(userInfo?.address || '', roles, true);

  // Proper display name validation (replaces basic hasValidationError)
  const displayNameValidation = useDisplayNameValidation(displayName);

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">
            <Trans>Account Settings</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>Manage your settings for this Space.</Trans>
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
          <div
            id="space-profile-icon-tooltip-target"
            className={`avatar-upload ${!fileData && (!currentPasskeyInfo?.pfpUrl || currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)) ? 'empty' : ''}`}
            style={
              fileData ||
              (currentPasskeyInfo?.pfpUrl &&
                !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER))
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
                )) && <Icon name="image" size="2xl" className="icon" />}
          </div>
          {!isAvatarUploading && !isAvatarDragActive && (
            <ReactTooltip
              id="space-profile-icon-tooltip"
              content={t`Upload an avatar for this Space - PNG or JPG - Optimal ratio 1:1`}
              place="bottom"
              className="!w-[400px]"
              anchorSelect="#space-profile-icon-tooltip-target"
            />
          )}
          <div className="flex-1">
            <Input
              className="w-full md:w-80 mt-3 ml-1"
              value={displayName}
              onChange={setDisplayName}
              placeholder={t`Display Name`}
              labelType="static"
              error={!!displayNameValidation.error}
              errorMessage={displayNameValidation.error}
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
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2">
          <Trans>Notifications</Trans>
        </div>
        <div className="text-label-strong pt-1">
          <Trans>Select which types of notifications you want to receive</Trans>
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
        <Spacer size="lg" direction="vertical" borderBottom={true} />

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
