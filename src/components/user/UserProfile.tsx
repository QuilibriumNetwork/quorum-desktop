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
import { hasPermission, canKickUser } from '../../utils/permissions';
import { t } from '@lingui/core/macro';
import { DefaultImages, truncateAddress } from '../../utils';
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

  // Extract business logic into hooks
  const { addRole, removeRole } = useUserRoleManagement(props.spaceId);
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

  const hasKickPermission = hasPermission(
    currentPasskeyInfo?.address || '',
    'user:kick',
    space || undefined,
    isSpaceOwner
  );

  const canKickThisUser = canKickUser(props.user.address, space || undefined);

  const canKickUsers = hasKickPermission && canKickThisUser;

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
                    <Icon
                      name="close"
                      className="hover:bg-black hover:bg-opacity-30 rounded-full p-1 cursor-pointer mr-1 text-sm align-middle"
                      onClick={() => removeRole(props.user.address, r.roleId)}
                    />
                    <Text className="text-xs inline">{r.displayName}</Text>
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
                      iconName="plus"
                    >
                      {r.roleTag}
                    </Button>
                  </Container>
                ))}
            </Container>
          </Container>
        )}
        {currentPasskeyInfo!.address !== props.user.address && (
          <Container className="bg-surface-3 rounded-b-xl p-3">
            <Container className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
              <Button
                size="small"
                className="justify-center text-center"
                onClick={() => sendMessage(props.user.address)}
              >
                {t`Send Message`}
              </Button>
              {canKickUsers && (
                <Button
                  type="danger"
                  size="small"
                  className="justify-center text-center"
                  onClick={() => kickUser(props.user.address)}
                  disabled={props.user.isKicked}
                >
                  {props.user.isKicked ? t`Kicked!` : t`Kick User`}
                </Button>
              )}
            </Container>
          </Container>
        )}
      </Container>
    </Container>
  );
};

export default UserProfile;
