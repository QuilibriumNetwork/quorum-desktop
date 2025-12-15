import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Container, FlexRow, Text, Icon } from '../primitives';
// import UserOnlineStateIndicator from './UserOnlineStateIndicator'; // TODO: Re-enable when online/offline status is implemented
import { ClickToCopyContent } from '../ui';
import './UserProfile.scss';
import { Role } from '../../api/quorumApi';
import {
  useUserRoleManagement,
  useUserProfileActions,
  useUserRoleDisplay,
} from '../../hooks';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../context/useMessageDB';
import { useModals } from '../context/ModalProvider';
import { canKickUser } from '../../utils/permissions';
import { createChannelPermissionChecker } from '../../utils/channelPermissions';
import { useMutedUsers } from '../../hooks/queries/mutedUsers';
import { t } from '@lingui/core/macro';
import { truncateAddress } from '../../utils';
import { UserAvatar } from './UserAvatar';

const UserProfile: React.FunctionComponent<{
  spaceId?: string;
  roles?: Role[];
  canEditRoles?: boolean;
  user: any;
  dismiss?: () => void;
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
}> = (props) => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const { messageDB } = useMessageDB();
  const { openMuteUser } = useModals();

  // Extract business logic into hooks
  const { addRole, removeRole, loadingRoles } = useUserRoleManagement(props.spaceId);
  const { sendMessage, kickUser } = useUserProfileActions({
    dismiss: props.dismiss,
    setKickUserAddress: props.setKickUserAddress,
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
  // Only space owners can kick users (requires owner's ED448 key)
  const canKickThisUser = canKickUser(props.user.address, space || undefined);
  const canKickUsers = isSpaceOwner && canKickThisUser;

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

  return (
    <Container
      className="user-profile"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      {props.dismiss && (
        <Container
          className="absolute right-3 top-3 cursor-pointer text-subtle hover:text-main z-10"
          onClick={props.dismiss}
        >
          <Icon name="close" />
        </Container>
      )}
      <Container
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
        <Container className="user-profile-text">
          <Container className="user-profile-username break-words">
            <Text>{props.user.displayName}</Text>
          </Container>
          <FlexRow className="py-1 text-subtle">
            <Text className="text-xs text-subtle">
              {truncateAddress(props.user.address)}
            </Text>
            <ClickToCopyContent
              className="ml-2"
              tooltipText={t`Copy address`}
              text={props.user.address}
              tooltipLocation="top"
              iconClassName="text-xs text-subtle hover:text-surface-7"
            >
              <></>
            </ClickToCopyContent>
          </FlexRow>
          <Container className="user-profile-state">
            {/* TODO: Re-enable when online/offline status is implemented
                See .agents/tasks/todo/user-status.md for implementation plan
                Phase 1: Show current user's connection state
                Phase 2: Show all users' online/offline status via presence system
            <UserOnlineStateIndicator user={props.user} />
            */}
          </Container>
        </Container>
      </Container>

      <Container>
        {(userRoles.length > 0 || props.canEditRoles) && (
          <Container
            className={
              'p-2 pb-4 ' +
              (currentPasskeyInfo!.address !== props.user.address
                ? ''
                : 'rounded-b-xl')
            }
          >
            <Container className="user-profile-content-section-header">
              <Text className="text-sm">Roles</Text>
            </Container>
            <Container className="user-profile-roles">
              {!props.canEditRoles &&
                userRoles.map((r) => (
                  <Text
                    key={'user-profile-role-' + r.roleId}
                    className={'user-profile-role-tag'}
                  >
                    {r.displayName}
                  </Text>
                ))}
              {props.canEditRoles &&
                userRoles.map((r) => (
                  <Text
                    key={'user-profile-role-' + r.roleId}
                    className={'user-profile-role-tag'}
                  >
                    {loadingRoles.has(r.roleId) ? (
                      <Text className="text-xs">{t`Removing...`}</Text>
                    ) : (
                      <>
                        <Icon
                          name="close"
                          className="hover:bg-black hover:bg-opacity-30 rounded-full p-1 cursor-pointer mr-1 text-sm align-middle"
                          onClick={() => removeRole(props.user.address, r.roleId)}
                        />
                        <Text className="text-xs inline">{r.displayName}</Text>
                      </>
                    )}
                  </Text>
                ))}
              {props.canEditRoles &&
                availableRoles.map((r) => (
                  <Container
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
                  </Container>
                ))}
            </Container>
          </Container>
        )}
        {/* Action buttons section - shown when viewing others OR when you have moderation permissions */}
        {(!isOwnProfile || canMuteUsers || canKickUsers) && (
          <Container className="bg-surface-3 rounded-b-xl p-3">
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
              <Container className={`${!isOwnProfile ? 'mt-2 ' : ''}grid gap-1 sm:gap-2 ${
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
                    onClick={() => kickUser(props.user.address)}
                    disabled={props.user.isKicked}
                  >
                    {props.user.isKicked ? t`Kicked!` : t`Kick`}
                  </Button>
                )}
              </Container>
            )}
          </Container>
        )}
      </Container>
    </Container>
  );
};

export default UserProfile;
