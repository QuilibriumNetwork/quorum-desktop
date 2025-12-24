/**
 * OfflineBanner - Shows offline status and pending actions count
 *
 * Displays when:
 * - User is offline (shows queued actions count)
 * - User hasn't dismissed it this session
 *
 * Does NOT display when online - action queue processing happens silently
 * and "Syncing Space..." toast handles sync feedback separately.
 *
 * Dismiss behavior:
 * - User can close with X button
 * - Reappears on page refresh (browser) or app restart (Electron)
 *
 * Adds 'offline-banner-visible' class to body to push layout down.
 *
 * See: .agents/tasks/background-action-queue.md
 */

import React, { useEffect, useState } from 'react';
import { t } from '@lingui/core/macro';
import { useActionQueue } from '../context/ActionQueueContext';
import { Icon } from '../primitives';
import './OfflineBanner.scss';

export const OfflineBanner: React.FC = () => {
  const { isOnline, stats } = useActionQueue();
  const [dismissed, setDismissed] = useState(false);

  const showBanner = !isOnline && !dismissed;

  // Add/remove body class to push layout down
  useEffect(() => {
    if (showBanner) {
      document.body.classList.add('offline-banner-visible');
    } else {
      document.body.classList.remove('offline-banner-visible');
    }
    return () => {
      document.body.classList.remove('offline-banner-visible');
    };
  }, [showBanner]);

  // Reset dismissed state when coming back online (so it shows again next time offline)
  useEffect(() => {
    if (isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <div className="offline-banner">
      <span>
        {t`You're offline`}
        {stats.pending > 0 && ` - ${stats.pending} ${t`actions queued`}`}
      </span>
      <button
        className="offline-banner__close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
};
