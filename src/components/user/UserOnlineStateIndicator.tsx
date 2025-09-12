import * as React from 'react';

import './UserOnlineStateIndicator.scss';
import { t } from '@lingui/core/macro';

/**
 * UserOnlineStateIndicator Component
 *
 * TODO: Currently disabled - shows "undefined" for message-based users
 *
 * ISSUE: User objects from messages (via mapSenderToUser) lack state/status properties
 * - UserProfile users: Have state/status from authentication flow
 * - Message users: Only have displayName/userIcon from space members
 *
 * IMPLEMENTATION PLAN: See .readme/tasks/todo/user-status.md
 * - Phase 1: Show current user's WebSocket connection state (online/offline)
 * - Phase 2: Full presence system for all users (requires server changes)
 */

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
