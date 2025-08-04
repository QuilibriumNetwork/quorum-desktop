import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Container, FlexRow, Text, Icon } from '../primitives';
import UserOnlineStateIndicator from './UserOnlineStateIndicator';
import ClickToCopyContent from '../ClickToCopyContent';
import './UserProfile.scss';
import { Role } from '../../api/quorumApi';
import {
  useUserRoleManagement,
  useUserProfileActions,
  useUserRoleDisplay,
} from '../../hooks';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../utils';

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

  // Extract business logic into hooks
  const { addRole, removeRole } = useUserRoleManagement(props.spaceId);
  const { sendMessage, kickUser } = useUserProfileActions({
    dismiss: props.dismiss,
    setKickUserAddress: props.setKickUserAddress,
  });
  const { userRoles, availableRoles } = useUserRoleDisplay(
    props.user.address,
    props.roles
  );

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
          <Icon name="times" />
        </Container>
      )}
      <Container className="user-profile-header">
        <Container
          className="user-profile-icon"
          style={{
            backgroundImage:
              props.user.userIcon &&
              !props.user.userIcon.includes(DefaultImages.UNKNOWN_USER)
                ? `url(${props.user.userIcon})`
                : 'var(--unknown-icon)',
          }}
        />
        <Container className="user-profile-text">
          <Container className="user-profile-username break-words">
            <Text>{props.user.displayName}</Text>
          </Container>
          <FlexRow className="py-1 text-subtle">
            <Text className="text-xs w-[140px] truncate text-subtle">
              {props.user.address}
            </Text>
            <ClickToCopyContent
              className="ml-2"
              tooltipText={t`Copy address`}
              text={props.user.address}
              tooltipLocation="top"
              iconClassName="text-subtle hover:text-surface-7"
            >
              <></>
            </ClickToCopyContent>
          </FlexRow>
          <Container className="user-profile-state">
            <UserOnlineStateIndicator user={props.user} />
          </Container>
        </Container>
      </Container>

      <Container>
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
                  className={'message-name-mentions-role inline-block mr-2'}
                >
                  {r.displayName}
                </Text>
              ))}
            {props.canEditRoles &&
              userRoles.map((r) => (
                <Text
                  key={'user-profile-role-' + r.roleId}
                  className={'message-name-mentions-role inline-block mr-2'}
                >
                  <Icon
                    name="times"
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
                  className="w-full sm:w-auto sm:inline-block mb-2"
                >
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      addRole(props.user.address, r.roleId);
                    }}
                    type="secondary"
                    size="small"
                  >
                    + {r.roleTag}
                  </Button>
                </Container>
              ))}
          </Container>
        </Container>
        {currentPasskeyInfo!.address !== props.user.address && (
          <Container className="bg-surface-3 rounded-b-xl p-3">
            <Container className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2">
              <Button
                size="small"
                className="justify-center text-center rounded text-main"
                onClick={() => sendMessage(props.user.address)}
              >
                {t`Send Message`}
              </Button>
              {props.canEditRoles && (
                <Button
                  type="danger"
                  size="small"
                  className="justify-center text-center rounded text-main"
                  onClick={() => kickUser(props.user.address)}
                >
                  {t`Kick User`}
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
