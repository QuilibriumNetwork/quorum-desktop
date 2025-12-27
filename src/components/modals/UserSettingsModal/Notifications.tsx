import * as React from 'react';
import { Switch, Icon, Tooltip, Callout } from '../../primitives';
import { t } from '@lingui/core/macro';

interface NotificationsProps {
  notificationsEnabled: boolean;
  handleNotificationToggle: (enabled: boolean) => void;
  isNotificationSupported: boolean;
  permissionStatus: string;
  showRevokeMessage: boolean;
}

const Notifications: React.FunctionComponent<NotificationsProps> = ({
  notificationsEnabled,
  handleNotificationToggle,
  isNotificationSupported,
  permissionStatus,
  showRevokeMessage,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">{t`Notifications`}</div>
          <div className="pt-2 text-body">
            {t`Manage desktop notification preferences for new messages.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="modal-content-info">
          <div className="flex flex-row items-center gap-3 pb-2">
            <Switch
              value={notificationsEnabled}
              onChange={handleNotificationToggle}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Desktop Notifications`}
              </div>
              <Tooltip
                id="settings-notifications-tooltip"
                content={t`Show desktop notifications when you receive new messages while Quorum is in the background. Your browser will ask for permission when you enable this feature.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                />
              </Tooltip>
            </div>
          </div>

          {!isNotificationSupported && (
            <div className="pt-2 text-sm text-warning">
              {t`Desktop notifications are not supported in this browser.`}
            </div>
          )}

          {permissionStatus === 'denied' && (
            <div
              className="pt-2 text-sm"
              style={{ color: 'var(--color-text-danger)' }}
            >
              {t`Notifications are blocked. Please enable them in your browser settings.`}
            </div>
          )}

          {showRevokeMessage && (
            <div className="pt-2 text-sm text-warning">
              {t`To disable notifications, please change the setting in your browser settings. Notifications cannot be disabled programmatically.`}
            </div>
          )}

          <Callout variant="info" className="mt-8">
            {t`You can manage your Space mention notifications in each Space's settings.`}
          </Callout>
        </div>
      </div>
    </>
  );
};

export default Notifications;