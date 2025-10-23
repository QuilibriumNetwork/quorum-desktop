import * as React from 'react';

import './UserStatus.scss';
// import UserOnlineStateIndicator from './UserOnlineStateIndicator'; // TODO: Re-enable when online/offline status is implemented
import { Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { ClickToCopyContent } from '../ui';
import { DefaultImages, truncateAddress } from '../../utils';
import { UserAvatar } from './UserAvatar';

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
        <UserAvatar
          userIcon={props.user.userIcon}
          displayName={props.user.displayName}
          address={props.user.address}
          size={32}
          className="user-status-icon"
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
              iconSize="xs"
              iconPosition="right"
              copyOnContentClick={true}
              className="flex items-center w-fit"
            >
              {truncateAddress(props.user.address)}
            </ClickToCopyContent>
          </div>
        </div>
        <div className="flex flex-col justify-center pr-2">
          <Icon
            name="settings"
            variant="filled"
            onClick={(e) => {
              props.setIsUserSettingsOpen(true);
              e.stopPropagation();
            }}
            className="text-subtle hover:text-main cursor-pointer"
          />
        </div>
      </div>
    </>
  );
};

export default UserStatus;
