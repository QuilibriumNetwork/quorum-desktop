import * as React from 'react';

import './UserOnlineStateIndicator.scss';

const UserOnlineStateIndicator: React.FunctionComponent<{ user: any }> = (
  props
) => {
  return (
    <div className="user-state-indicator">
      <div className={'user-state-' + props.user.state}>
        {props.user.status || props.user.state}
      </div>
    </div>
  );
};

export default UserOnlineStateIndicator;
