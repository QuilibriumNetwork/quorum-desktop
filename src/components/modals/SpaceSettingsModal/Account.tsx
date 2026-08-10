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
  TextArea,
} from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { useSpace } from '../../../hooks';
import { useSpaceOwner } from '../../../hooks/queries/spaceOwner/useSpaceOwner';
import { useSpaceLeaving } from '../../../hooks/business/spaces/useSpaceLeaving';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useUserRoleDisplay } from '../../../hooks/business/user/useUserRoleDisplay';
import { useChannelMute } from '../../../hooks/business/channels';
import { MAX_BIO_INPUT_CHARS } from '../../../hooks/business/validation';
import { getIconColorHex, IconColor } from '../../space/IconPicker/types';
import type { Role } from '@quilibrium/quorum-shared';
import { getRoleColorHex } from '@quilibrium/quorum-shared';
import type { SpaceNotificationTypeId } from '../../../types/notifications';
import { ReactTooltip } from '../../ui';
import { useMemberIdentity } from '../../../identity';
import { hasReservedQnsSuffix } from '@quilibrium/quorum-shared';

interface AccountProps {
  spaceId: string;
  spaceName: string;
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
  avatarFileError: string | null;
  isAvatarUploading: boolean;
  isAvatarDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  markedForDeletion: boolean;
  markForDeletion: () => void;
  getProfileImageUrl: () => string;
  currentMember: unknown;
  onSave: () => void;
  isSaving: boolean;
  hasValidationError: boolean;
  displayNameError: string | undefined;
  onClose: () => void;
  roles?: Role[];
  // Notification settings props (passed from parent)
  selectedMentionTypes: SpaceNotificationTypeId[];
  setSelectedMentionTypes: (types: SpaceNotificationTypeId[]) => void;
  isMentionSettingsLoading: boolean;
}

const Account: React.FunctionComponent<AccountProps> = ({
  spaceId,
  spaceName,
  displayName,
  setDisplayName,
  bio,
  setBio,
  bioErrors,
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
  currentMember,
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
  // Your own identity, for the per-space name placeholder below — resolved
  // via the SAME module every other migrated surface uses, scoped to THIS
  // space so the placeholder promises exactly what an empty override field
  // resolves to. `enrich` is redundant-but-harmless here: the ambient
  // <IdentityScopeProvider> (mounted by SpaceSettingsModal, one level up)
  // already auto-fetches `selfAddress`'s own public profile, and `request()`
  // dedupes. No `useUserPublicProfile` call needed any more — this replaces
  // it AND `utils/resolveSelfName`'s `selfNamePlaceholder`.
  const selfIdentity = useMemberIdentity(userInfo?.address ?? '', {
    spaceId,
    enrich: true,
  });
  // Fix round 1 (Phase D rows 19-21): `useMemberIdentity` returns the RAW
  // `MemberIdentity` — unlike `useResolvedMemberName`, it is NOT run through
  // shared's `resolveIdentity`, so its own forged-".q" guard
  // (`presentUnreserved`, quorum-shared/src/utils/resolveDisplayName.ts:51-55,
  // applied to every tier at resolveDisplayName.ts:109-113) never sees these
  // values. Re-applying the SAME exported `hasReservedQnsSuffix` here (not a
  // reimplementation) restores that guard for this call site. Switching to
  // `useResolvedMemberName` instead was considered and rejected: its
  // terminal fallback is `resolveIdentity`'s own truncated address, which
  // would silently replace this field's deliberate instructional-copy
  // fallback (see the placeholder's own comment below) with an address —
  // a UX regression `useMemberIdentity` avoids by exposing the tiers
  // separately.
  const selfPlaceholderName = React.useMemo(() => {
    const qns = (selfIdentity.qnsName ?? '').trim();
    if (qns && !hasReservedQnsSuffix(qns)) return `${qns}.q`;
    const global = (selfIdentity.globalName ?? '').trim();
    if (global && !hasReservedQnsSuffix(global)) return global;
    return null;
  }, [selfIdentity.qnsName, selfIdentity.globalName]);
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

  // Space data (for per-channel notifications list)
  const { data: space } = useSpace({ spaceId });

  // Channel mute settings
  const {
    showMutedChannels,
    toggleShowMutedChannels,
    isSpaceMuted,
    toggleSpaceMute,
    isChannelMuted,
    toggleMute,
  } = useChannelMute({
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
          <div className="text-title flex items-center gap-2">
            <Icon name="user" size="lg" />
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
        <div className="text-label pt-1">
          <Trans>Override your display name, avatar, and bio for this Space. Other Spaces and your global profile are unaffected.</Trans>
        </div>
        <div className="flex items-start gap-4 pt-4">
          {(() => {
            // Determine if there's an avatar to display
            const hasExistingAvatar = currentPasskeyInfo?.pfpUrl && !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER);
            const hasAvatar = (fileData || hasExistingAvatar) && !markedForDeletion;
            const avatarUrl = getProfileImageUrl();
            const showImage = hasAvatar && avatarUrl !== 'var(--unknown-icon)';

            // The revert control ("Use my main avatar") only makes sense when a
            // per-space OVERRIDE exists — either a fresh upload staged in this
            // session, or a stored non-empty per-space user_icon. When merely
            // FOLLOWING the global avatar (no override), showing a "remove"
            // control is the misleading affordance this effort removes: there is
            // nothing per-space to revert. (Follow-global design.)
            const hasFreshUpload = !!fileData;
            const perSpaceIcon = (currentMember as { user_icon?: string })?.user_icon;
            const hasStoredOverride =
              !!perSpaceIcon && !perSpaceIcon.includes(DefaultImages.UNKNOWN_USER);
            const hasOverride =
              (hasFreshUpload || hasStoredOverride) && !markedForDeletion;

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
                  {showImage && hasOverride && (
                    <Tooltip id="space-profile-avatar-delete" content={t`Use my main avatar`} place="bottom">
                      <button
                        type="button"
                        className="image-upload-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markForDeletion();
                        }}
                        aria-label={t`Use my main avatar`}
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
              placeholder={
                // A placeholder here is a PROMISE (see the old
                // resolveSelfName.ts): what an empty per-space field
                // actually resolves to. Same ladder every other migrated
                // surface uses — QNS name, then global name, then (since
                // this is the ONE place instructing an empty field, not
                // rendering a member) the caller's instructional copy
                // rather than the resolver's own truncated-address fallback.
                selfPlaceholderName || t`Your name in this Space`
              }
              labelType="static"
              error={!!displayNameError}
              errorMessage={displayNameError}
            />
          </div>
        </div>
        <Spacer size="md" direction="vertical" />
        <div className="text-subtitle-2 mb-3">
          <Trans>Bio</Trans>
        </div>
        <div className="w-full mb-2">
          <TextArea
            value={bio}
            onChange={setBio}
            placeholder={t`Tell people about yourself in this Space...`}
            rows={3}
            variant="filled"
            className="w-full"
            maxLength={MAX_BIO_INPUT_CHARS}
            error={bioErrors.length > 0}
            errorMessage={
              bioErrors.length > 0
                ? bioErrors.join('. ')
                : undefined
            }
          />
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
                  className="inline-flex items-center py-[3px] px-3 rounded-full font-medium text-xs text-center select-none text-white"
                  style={{
                    backgroundColor: getRoleColorHex(r.color),
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

          <Flex className="items-center gap-3 mt-4">
            <Switch
              value={!isSpaceMuted}
              onChange={toggleSpaceMute}
              accessibilityLabel={t`Notifications for this Space`}
            />
            <div className="text-label-strong">
              <Trans>Space notifications</Trans>
            </div>
          </Flex>

          <div
            className={`mt-3 ${
              isSpaceMuted ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div className="text-label">
              <Trans>Notify me for:</Trans>
            </div>
            <div className="pt-2">
              <Select
                value={selectedMentionTypes}
                onChange={(value: string | string[]) =>
                  setSelectedMentionTypes(value as SpaceNotificationTypeId[])
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
                disabled={isSpaceMuted || isMentionSettingsLoading}
              />
            </div>

            {space?.groups?.some((g) => g.channels.length > 0) && (
              <div className="flex flex-col gap-4 pt-5">
                {space.groups
                  .filter((group) => group.channels.length > 0)
                  .map((group) => (
                    <div
                      key={group.groupName}
                      className="flex flex-col gap-2"
                    >
                      <div className="small-caps font-bold text-subtle">
                        {group.groupName}
                      </div>
                      {group.channels.map((channel) => (
                        <Flex
                          key={channel.channelId}
                          className="items-center gap-3"
                        >
                          <Switch
                            value={!isChannelMuted(channel.channelId)}
                            onChange={() => toggleMute(channel.channelId)}
                            disabled={isSpaceMuted}
                            accessibilityLabel={t`Notifications for ${channel.channelName}`}
                          />
                          <Flex className="items-center gap-2 min-w-0">
                            <Icon
                              name={(channel.icon as any) || 'hashtag'}
                              size="sm"
                              variant={channel.iconVariant || 'outline'}
                              style={{
                                color: getIconColorHex(
                                  channel.iconColor as IconColor
                                ),
                              }}
                            />
                            <div className="text-label-strong truncate">
                              {channel.channelName}
                            </div>
                          </Flex>
                        </Flex>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Sidebar display preference: independent of mute state above. */}
          <Spacer
            spaceBefore="lg"
            spaceAfter="md"
            border
            direction="vertical"
          />
          <Flex className="items-center gap-3">
            <Switch
              value={!showMutedChannels}
              onChange={handleShowMutedToggle}
              accessibilityLabel={t`Hide muted channels from sidebar`}
            />
            <div className="text-label-strong">
              <Trans>Hide muted channels from sidebar</Trans>
            </div>
          </Flex>
          <Spacer size="lg" direction="vertical" borderBottom={true} />
        </>

        {!isSpaceOwner && (
          <>
            <Spacer size="xl" direction="vertical" />
            <Callout variant="error" size="md">
              <div className="text-md">
                <Trans>Leave this Space</Trans>
              </div>
              <div className="pt-2 text-sm">
                {/* See LeaveSpaceModal for why the old "unless you are
                    re-invited" claim was wrong: a public invite link survives
                    leaving and still works. */}
                <Trans>
                  You'll need an invite to rejoin, though a public invite link
                  will still work if this Space has one. Your existing messages
                  will NOT be deleted.
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
