import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Flex, Icon } from '../primitives';
// import UserOnlineStateIndicator from './UserOnlineStateIndicator'; // TODO: Re-enable when online/offline status is implemented
import { ClickToCopyContent } from '../ui';
import './UserProfile.scss';
import { createChannelPermissionChecker, getRoleColorHex, logger } from '@quilibrium/quorum-shared';
import type { Role } from '@quilibrium/quorum-shared';
import {
  useUserRoleManagement,
  useUserProfileActions,
  useUserRoleDisplay,
} from '../../hooks';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../context/useMessageDB';
import { useModals } from '../context/ModalProvider';
import { useMutedUsers } from '../../hooks/queries/mutedUsers';
import { t } from '@lingui/core/macro';
import { getAddressSuffix } from '../../utils';
import { UserAvatar } from './UserAvatar';
import { ResolvedName } from './ResolvedName';
import {
  resolveMemberName,
  resolveSpaceMemberName,
} from '../../utils/resolveMemberName';
import { useUserNote, buildUserNoteKey } from '../../hooks/queries/userNotes';
import { useUserPublicProfile } from '../../hooks/business/user/useUserPublicProfile';
import { useQueryClient } from '@tanstack/react-query';
import { buildConfigKey } from '../../hooks/queries/config/buildConfigKey';
import { buildConfigFetcher } from '../../hooks/queries/config/buildConfigFetcher';
import { validateUserNote, MAX_USER_NOTE_LENGTH } from '../../hooks/business/validation';

const UserProfile: React.FunctionComponent<{
  spaceId?: string;
  roles?: Role[];
  canEditRoles?: boolean;
  user: any;
  dismiss?: () => void;
}> = (props) => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const { openMuteUser, openKickUser } = useModals();

  // Extract business logic into hooks
  const { addRole, removeRole, loadingRoles } = useUserRoleManagement(props.spaceId);
  const { sendMessage } = useUserProfileActions({
    dismiss: props.dismiss,
  });
  const { userRoles, availableRoles } = useUserRoleDisplay(
    props.user.address,
    props.roles,
    props.canEditRoles || currentPasskeyInfo?.address === props.user.address // Space owners and users viewing their own profile see all roles including private ones
  );

  // Permission checking
  const { data: isSpaceOwner } = useSpaceOwner({
    spaceId: props.spaceId || '',
  });
  const { data: space } = useQuery({
    queryKey: ['space', props.spaceId],
    queryFn: async () => {
      if (!props.spaceId) return null;
      return await messageDB.getSpace(props.spaceId);
    },
    enabled: !!props.spaceId,
  });

  // Check if this user is muted
  const { data: mutedUsers } = useMutedUsers({ spaceId: props.spaceId || '' });
  const isUserMuted = mutedUsers?.some(m => m.targetUserId === props.user.address) ?? false;

  // Permission checks
  // Only space owners can kick users (requires owner's ED448 key - protocol-level enforcement)
  const canKickUsers = isSpaceOwner ?? false;

  // Check if current user can mute (requires user:mute permission via role)
  const canMuteUsers = React.useMemo(() => {
    if (!currentPasskeyInfo?.address || !space || !props.spaceId) return false;

    const permissionChecker = createChannelPermissionChecker({
      userAddress: currentPasskeyInfo.address,
      isSpaceOwner: isSpaceOwner ?? false,
      space: space,
      channel: undefined, // UserProfile is space-level, not channel-specific
    });

    return permissionChecker.canMuteUser();
  }, [currentPasskeyInfo?.address, space, props.spaceId, isSpaceOwner]);

  // Check if viewing own profile
  const isOwnProfile = currentPasskeyInfo?.address === props.user.address;

  const { data: userNoteData } = useUserNote({ targetAddress: props.user.address });
  const queryClient = useQueryClient();

  // QNS verified name ("name.q"). Enriched member paths (message senders, DM
  // header) already pass `primaryUsername`. The member-list sidebar uses the
  // raw roster (no per-member public-profile fetch, to avoid a roster-wide
  // fetch storm), so it arrives without it. Fall back to a single on-demand
  // public-profile fetch — only when the profile is actually open and the name
  // isn't already present — so every surface shows the handle without the storm.
  const needsUsernameFetch = !props.user.primaryUsername && !isOwnProfile;
  const { data: openedUserPublicProfile } = useUserPublicProfile(
    props.user.address,
    { enabled: needsUsernameFetch }
  );
  const primaryUsername =
    props.user.primaryUsername ||
    openedUserPublicProfile?.primary_username ||
    undefined;
  // Global name (for the space resolver's custom-vs-default comparison).
  const globalDisplayName =
    (props.user.globalDisplayName as string | undefined) ||
    openedUserPublicProfile?.display_name ||
    undefined;

  const resolvedName = props.spaceId
    ? resolveSpaceMemberName({
        address: props.user.address,
        displayName: props.user.displayName,
        primaryUsername,
        globalDisplayName,
      })
    : resolveMemberName({
        address: props.user.address,
        displayName: props.user.displayName,
        primaryUsername,
      });

  // Bio resolution for the visible card:
  //   1. Per-space override on SpaceMember (props.user.bio) wins when set.
  //   2. For the current user's own profile, fall back to UserConfig.bio
  //      (the global bio) so deleting the per-space override reveals the
  //      global one again instead of leaving an empty section.
  //   3. For other members, useMembersWithPublicProfileFallback already
  //      surfaces their public-profile bio when their per-space override
  //      is empty AND they've opted into public profile.
  //
  // Subscribed via useQuery (not a getQueryData snapshot) so the card
  // re-renders if the global bio changes while it's open (e.g. user saves
  // global settings in another modal). Same key as useConfig + useUserSettings,
  // so all three paths share one cached value.
  const { data: ownConfig } = useQuery({
    queryKey: buildConfigKey({ userAddress: currentPasskeyInfo?.address ?? '' }),
    queryFn: buildConfigFetcher({
      messageDB,
      userAddress: currentPasskeyInfo?.address ?? '',
    }),
    enabled: isOwnProfile && !!currentPasskeyInfo?.address,
    networkMode: 'always',
  });
  const resolvedBio = (props.user.bio as string | undefined) || ownConfig?.bio;
  const [noteValue, setNoteValue] = React.useState('');
  const [noteCharCount, setNoteCharCount] = React.useState(0);
  const [isNoteFocused, setIsNoteFocused] = React.useState(false);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [noteError, setNoteError] = React.useState('');

  React.useEffect(() => {
    const existing = userNoteData?.note ?? '';
    setNoteValue(existing);
    setNoteCharCount(existing.length);
    setIsNoteOpen(!!existing);
  }, [userNoteData?.note]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_USER_NOTE_LENGTH) {
      setNoteValue(val);
      setNoteCharCount(val.length);
    }
  };

  const handleNoteBlur = async () => {
    setIsNoteFocused(false);
    const noteKey = buildUserNoteKey({ targetAddress: props.user.address });
    if (!noteValue.trim()) {
      setIsNoteOpen(false);
      try {
        await messageDB.deleteUserNote(props.user.address);
        queryClient.setQueryData(noteKey, null);
        // Write tombstone so deletion propagates to other devices on next sync
        if (currentPasskeyInfo?.address) {
          const config = await messageDB.getUserConfig({ address: currentPasskeyInfo.address });
          if (config) {
            config.deletedUserNoteAddresses = [
              ...(config.deletedUserNoteAddresses ?? []),
              props.user.address,
            ];
            await messageDB.saveUserConfig(config);
          }
        }
      } catch (err) {
        logger.error('Failed to delete user note', err);
      }
      return;
    }
    const errors = validateUserNote(noteValue);
    if (errors.length > 0) {
      setNoteError(errors[0]);
      return;
    }
    setNoteError('');
    try {
      await messageDB.saveUserNote(props.user.address, noteValue);
      queryClient.setQueryData(noteKey, { targetAddress: props.user.address, note: noteValue.trim(), updatedAt: Date.now() });
    } catch (err) {
      logger.error('Failed to save user note', err);
    }
  };

  return (
    <div
      className="user-profile"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      {props.dismiss && (
        <div
          className="absolute right-3 top-3 cursor-pointer text-subtle hover:text-main z-10"
          onClick={props.dismiss}
        >
          <Icon name="close" />
        </div>
      )}
      <div
        className={
          'user-profile-header ' +
          (currentPasskeyInfo!.address === props.user.address &&
          userRoles.length === 0 &&
          !props.canEditRoles
            ? 'rounded-b-xl'
            : '')
        }
      >
        <UserAvatar
          userIcon={props.user.userIcon}
          displayName={props.user.displayName}
          address={props.user.address}
          size={44}
          className="user-profile-icon"
        />
        <div className="user-profile-text">
          <div className="user-profile-username">
            <ResolvedName resolved={resolvedName} />
          </div>
          <Flex className="py-1 text-subtle">
            <span className="text-xs text-subtle">
              {getAddressSuffix(props.user.address)}
            </span>
            <ClickToCopyContent
              className="ml-2"
              tooltipText={t`Copy address`}
              text={props.user.address}
              tooltipLocation="top"
              iconClassName="text-xs text-subtle hover:text-surface-7"
            >
              <></>
            </ClickToCopyContent>
          </Flex>
          <div className="user-profile-state">
            {/* TODO: Re-enable when online/offline status is implemented
                See .agents/tasks/todo/user-status.md for implementation plan
                Phase 1: Show current user's connection state
                Phase 2: Show all users' online/offline status via presence system
            <UserOnlineStateIndicator user={props.user} />
            */}
          </div>
        </div>
      </div>

      <div>
        {(userRoles.length > 0 || props.canEditRoles) && (
          <div
            className={
              'p-2 pb-4 ' +
              (currentPasskeyInfo!.address !== props.user.address
                ? ''
                : 'rounded-b-xl')
            }
          >
            <div className="user-profile-content-section-header">
              <span className="text-sm">Roles</span>
            </div>
            <div className="user-profile-roles">
              {!props.canEditRoles &&
                userRoles.map((r) => (
                  <span
                    key={'user-profile-role-' + r.roleId}
                    className={'user-profile-role-tag'}
                    style={{ backgroundColor: getRoleColorHex(r.color) }}
                  >
                    {r.displayName}
                  </span>
                ))}
              {props.canEditRoles &&
                userRoles.map((r) => (
                  <span
                    key={'user-profile-role-' + r.roleId}
                    className={'user-profile-role-tag'}
                    style={{ backgroundColor: getRoleColorHex(r.color) }}
                  >
                    {loadingRoles.has(r.roleId) ? (
                      <span className="text-xs">{t`Removing...`}</span>
                    ) : (
                      <>
                        <Icon
                          name="close"
                          className="hover:bg-black hover:bg-opacity-30 rounded-full p-1 cursor-pointer mr-1 text-sm align-middle"
                          onClick={() => removeRole(props.user.address, r.roleId)}
                        />
                        <span className="text-xs inline">{r.displayName}</span>
                      </>
                    )}
                  </span>
                ))}
              {props.canEditRoles &&
                availableRoles.map((r) => (
                  <div
                    key={'user-profile-add-role-' + r.roleId}
                  >
                    <Button
                      onClick={() => {
                        addRole(props.user.address, r.roleId);
                      }}
                      type="subtle"
                      size="small"
                      iconName={loadingRoles.has(r.roleId) ? undefined : "plus"}
                      disabled={loadingRoles.has(r.roleId)}
                      className="user-profile-role-add-button"
                    >
                      {loadingRoles.has(r.roleId) ? t`Adding...` : r.roleTag}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}
        {resolvedBio && (
          <div className="user-profile-bio-section">
            <div className="user-profile-bio-label">{t`About`}</div>
            <p className="user-profile-bio-text">{resolvedBio}</p>
          </div>
        )}
        {!isOwnProfile && (
          isNoteOpen ? (
            <div className="user-profile-note-section">
              <div className="user-profile-note-label">
                <strong>{t`Note`}</strong>{' '}<span className="font-normal">{t`(only visible to you)`}</span>
              </div>
              <textarea
                className="user-profile-note-textarea"
                placeholder={t`Add a personal note...`}
                value={noteValue}
                maxLength={MAX_USER_NOTE_LENGTH}
                onChange={handleNoteChange}
                onFocus={() => setIsNoteFocused(true)}
                onBlur={handleNoteBlur}
                autoFocus={!noteValue}
              />
              {noteError && (
                <div className="user-profile-note-error">{noteError}</div>
              )}
              {isNoteFocused && !noteError && (
                <div className="user-profile-note-char-count">
                  {noteCharCount}/{MAX_USER_NOTE_LENGTH}
                </div>
              )}
            </div>
          ) : (
            <div className="user-profile-note-trigger">
              <span
                className="user-profile-note-add-link"
                onClick={() => setIsNoteOpen(true)}
              >
                <Icon name="notes" size="sm" />
                {t`Add a note`}
              </span>
            </div>
          )
        )}
        {/* Action buttons section - shown when viewing others OR when you have moderation permissions */}
        {(!isOwnProfile || canMuteUsers || canKickUsers) && (
          <div className="bg-surface-3 rounded-b-xl p-3">
            {/* Send Message - only when viewing others' profiles */}
            {!isOwnProfile && (
              <Button
                size="small"
                iconName="message"
                className="w-full justify-center text-center"
                onClick={() => sendMessage(props.user.address)}
              >
                {t`Send Message`}
              </Button>
            )}

            {/* Moderation buttons - based on permissions */}
            {/* Mute: on own profile only show Unmute if muted (prevent self-muting), Kick: hidden on own profile */}
            {((canMuteUsers && (!isOwnProfile || isUserMuted)) || (canKickUsers && !isOwnProfile)) && (
              <div className={`${!isOwnProfile ? 'mt-2 ' : ''}grid gap-1 sm:gap-2 ${
                canMuteUsers && (!isOwnProfile || isUserMuted) && canKickUsers && !isOwnProfile
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1'
              }`}>
                {canMuteUsers && (!isOwnProfile || isUserMuted) && (
                  <Button
                    type="secondary"
                    size="small"
                    iconName={isUserMuted ? 'volume' : 'volume-off'}
                    className="justify-center text-center"
                    onClick={() => {
                      openMuteUser({
                        address: props.user.address,
                        displayName: props.user.displayName,
                        userIcon: props.user.userIcon,
                        isUnmuting: isUserMuted,
                      });
                      props.dismiss?.();
                    }}
                  >
                    {isUserMuted ? t`Unmute` : t`Mute`}
                  </Button>
                )}
                {canKickUsers && !isOwnProfile && (
                  <Button
                    type="danger"
                    size="small"
                    iconName="ban"
                    className="justify-center text-center"
                    onClick={() => {
                      openKickUser({
                        address: props.user.address,
                        displayName: props.user.displayName,
                        userIcon: props.user.userIcon,
                      });
                      props.dismiss?.();
                    }}
                    disabled={props.user.isKicked}
                  >
                    {props.user.isKicked ? t`Kicked!` : t`Kick`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
