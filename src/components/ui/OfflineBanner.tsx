/**
 * OfflineBanner - Shows offline status and pending actions count
 *
 * Displays when:
 * - User is offline
 * - There are pending actions syncing
 *
 * See: .agents/tasks/background-action-queue.md
 */

import React from 'react';
import { t } from '@lingui/core/macro';
import { useActionQueue } from '../context/ActionQueueContext';
import './OfflineBanner.scss';

export const OfflineBanner: React.FC = () => {
  const { isOnline, stats } = useActionQueue();

  // Don't show anything if online and no pending actions
  if (isOnline && stats.pending === 0) return null;

  if (!isOnline) {
    return (
      <div className="offline-banner offline-banner--offline">
        <span className="offline-banner__text">{t`You're offline`}</span>
        {stats.pending > 0 && (
          <span className="offline-banner__count">
            {' '}
            - {stats.pending} {t`actions queued`}
          </span>
        )}
      </div>
    );
  }

  // Online but syncing
  if (stats.pending > 0) {
    return (
      <div className="offline-banner offline-banner--syncing">
        <span className="offline-banner__text">
          {t`Syncing`} ({stats.pending} {t`pending`})
        </span>
      </div>
    );
  }

  return null;
};
