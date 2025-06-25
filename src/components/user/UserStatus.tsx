import * as React from 'react';
import { faEdit, faGear } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '../Tooltip';
import TooltipButton from '../TooltipButton';
import UserProfile from './UserProfile';

import './UserStatus.scss';
import UserOnlineStateIndicator from './UserOnlineStateIndicator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';

type UserStatusProps = {
  user: any;
  setAuthState: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
  setIsUserSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const UserStatus: React.FunctionComponent<UserStatusProps> = (props) => {
  let [isMenuExpanded, setIsMenuExpanded] = React.useState<boolean>(false);
  let [isProfileEditorOpen, setIsProfileEditorOpen] =
    React.useState<boolean>(false);

  return (
    <>
      {isProfileEditorOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <UserProfile
              setUser={props.setUser}
              editMode={true}
              user={props.user}
              dismiss={() => setIsProfileEditorOpen(false)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsProfileEditorOpen(false)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      {isMenuExpanded ? (
        <>
          <div
            className="invisible-dismissal"
            onClick={() => setIsMenuExpanded(false)}
          />
          <Tooltip
            variant="light"
            className="user-status-menu bottom-[24px] w-[200px] !p-[2px]"
            arrow="none"
            visible={isMenuExpanded}
          >
            <TooltipButton
              text={t`Edit Profile`}
              icon={faEdit}
              onClick={() => {
                setIsMenuExpanded(false);
                setIsProfileEditorOpen(true);
              }}
            />
          </Tooltip>
        </>
      ) : (
        <></>
      )}
      <div onClick={() => setIsMenuExpanded(true)} className="user-status">
        <div
          className="user-status-icon"
          style={{
            backgroundImage:
              props.user.userIcon &&
              !props.user.userIcon.includes('unknown.png')
                ? `url(${props.user.userIcon})`
                : 'var(--unknown-icon)',
          }}
        />
        <div className="user-status-text">
          <div className="user-status-username w-[164px] text-ellipsis overflow-hidden">
            {props.user.displayName}
          </div>
          <div className="user-status-info">
            <UserOnlineStateIndicator user={props.user} />
          </div>
        </div>
        <div className="flex flex-col justify-around pr-2">
          <FontAwesomeIcon
            onClick={(e) => {
              props.setIsUserSettingsOpen(true);
              e.stopPropagation();
            }}
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.1)] hover:text-text-base"
            icon={faGear}
          />
        </div>
      </div>
    </>
  );
};

export default UserStatus;
