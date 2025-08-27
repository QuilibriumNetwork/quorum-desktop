import * as React from 'react';
import { faGear } from '@fortawesome/free-solid-svg-icons';

import './UserStatus.scss';
import UserOnlineStateIndicator from './UserOnlineStateIndicator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages } from '../../utils';

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
  return (
    <>
      <div className="user-status">
        <div
          className="user-status-icon"
          style={{
            backgroundImage:
              props.user.userIcon &&
              !props.user.userIcon.includes(DefaultImages.UNKNOWN_USER)
                ? `url(${props.user.userIcon})`
                : 'var(--unknown-icon)',
          }}
        />
        <div className="user-status-text">
          <div className="flex flex-row user-status-username w-[164px] text-ellipsis overflow-hidden">
            <span>{props.user.displayName}</span>
            <ClickToCopyContent
              className="ml-4"
              tooltipText={t`Copy address`}
              text={props.user.address}
              tooltipLocation="top"
              iconClassName="text-surface-10"
            >
              <></>
            </ClickToCopyContent>
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
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.1)] hover:text-main cursor-pointer"
            icon={faGear}
          />
        </div>
      </div>
    </>
  );
};

export default UserStatus;
