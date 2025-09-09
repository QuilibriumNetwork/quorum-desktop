import * as React from 'react';
import { faGear } from '@fortawesome/free-solid-svg-icons';

import './UserStatus.scss';
// import UserOnlineStateIndicator from './UserOnlineStateIndicator'; // TODO: Re-enable when online/offline status is implemented
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { t } from '@lingui/core/macro';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages, truncateAddress } from '../../utils';

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
          <div className="user-status-username w-[164px] text-ellipsis overflow-hidden whitespace-nowrap">
            <span>{props.user.displayName}</span>
          </div>
          <div className="user-status-info w-fit">
            <ClickToCopyContent
              text={props.user.address}
              tooltipText={t`Copy address`}
              tooltipLocation="top"
              iconClassName="text-surface-9 hover:text-surface-10 dark:text-surface-8 dark:hover:text-surface-9"
              textVariant="subtle"
              textSize="xs"
              iconSize="md"
              iconPosition="right"
              copyOnContentClick={true}
              className="flex items-center w-fit"
            >
              {truncateAddress(props.user.address)}
            </ClickToCopyContent>
          </div>
        </div>
        <div className="flex flex-col justify-center pr-2">
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
