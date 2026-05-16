import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Flex, Icon } from '../primitives';
// import UserOnlineStateIndicator from './UserOnlineStateIndicator'; // TODO: Re-enable when online/offline status is implemented
import { ClickToCopyContent } from '../ui';
import './UserProfile.scss';
import { createChannelPermissionChecker, logger } from '@quilibrium/quorum-shared';
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
import { useUserNote, buildUserNoteKey } from '../../hooks/queries/userNotes';
import { useQueryClient } from '@tanstack/react-query';
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
  const [noteValue, setNoteValue] = React.useState('');
  const [noteCharCount, setNoteCharCount] = React.useState(0);
  const [isNoteFocused, setIsNoteFocused] = React.useState(false);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);

  React.useEffect(() => {
    const existing = userNoteData?.note ?? '';
    logger.debug('[UserNote] useEffect fired — userNoteData:', userNoteData, '→ existing:', existing);
    setNoteValue(existing);
    setNoteCharCount(existing.length);
    if (existing) setIsNoteOpen(true);
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
    logger.debug('[UserNote] handleNoteBlur — noteValue:', JSON.stringify(noteValue));
    if (!noteValue.trim()) {
      logger.debug('[UserNote] empty — collapsing and deleting');
      setIsNoteOpen(false);
      try {
        await messageDB.deleteUserNote(props.user.address);
        logger.debug('[UserNote] deleteUserNote done — setting cache to undefined');
        queryClient.setQueryData(noteKey, undefined);
        logger.debug('[UserNote] cache after delete:', queryClient.getQueryData(noteKey));
      } catch (err) {
        logger.error('[UserNote] Failed to delete user note', err);
      }
      return;
    }
    const errors = validateUserNote(noteValue);
    if (errors.length > 0) {
      logger.debug('[UserNote] validation errors:', errors);
      return;
    }
    try {
      await messageDB.saveUserNote(props.user.address, noteValue);
      const newData = { targetAddress: props.user.address, note: noteValue.trim(), updatedAt: Date.now() };
      logger.debug('[UserNote] saveUserNote done — setting cache to:', newData);
      queryClient.setQueryData(noteKey, newData);
    } catch (err) {
      logger.error('[UserNote] Failed to save user note', err);
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
            <span>{props.user.displayName}</span>
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
                  >
                    {r.displayName}
                  </span>
                ))}
              {props.canEditRoles &&
                userRoles.map((r) => (
                  <span
                    key={'user-profile-role-' + r.roleId}
                    className={'user-profile-role-tag'}
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
        {!isOwnProfile && (
          isNoteOpen ? (
            <div className="user-profile-note-section">
              <div className="user-profile-note-label">
                {t`Note — only visible to you`}
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
              {isNoteFocused && (
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
                {t`+ Add a note`}
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
