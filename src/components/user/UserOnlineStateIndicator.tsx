import * as React from 'react';

import './UserOnlineStateIndicator.scss';
import { t } from '@lingui/core/macro';

const UserOnlineStateIndicator: React.FunctionComponent<{ user: any }> = (
  props
) => {
  const getStatusString = (status: string) => {
    switch (status) {
      case 'online':
        return t`Online`;
      case 'away':
        return t`Away`;
      case 'busy':
        return t`Busy`;
      case 'offline':
        return t`Offline`;
      default:
        return status;
    }
  };
  return (
    <div className="user-state-indicator">
      <div className={'user-state-' + props.user.state}>
        {getStatusString(props.user.status || props.user.state)}
      </div>
    </div>
  );
};

export default UserOnlineStateIndicator;
