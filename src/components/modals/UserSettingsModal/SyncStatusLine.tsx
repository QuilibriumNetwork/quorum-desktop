import * as React from 'react';
import { t } from '@lingui/core/macro';
import { readLastPublish } from '../../../utils/lastPublish';

/**
 * Shows a line under the sync toggle ONLY when publishing is failing.
 * Silence means sync is fine.
 *
 * A "Last synced N ago" line was built first and deliberately removed. It read
 * as a health indicator but reported the last time this device had something to
 * PUBLISH, not the last time it talked to the server — pulls happen on open,
 * pushes only when something changes. So a healthy device that had not changed
 * a setting in three days announced "Last synced 3 days ago", which is
 * indistinguishable from three days broken. Reporting success was worse than
 * saying nothing.
 *
 * The record is still written for every outcome, success included. It is the
 * instrument later work is verified with, and its payloadBytes readings are how
 * the unknown server size limit gets settled. Only the display is failures-only.
 *
 * Known limit: someone who never opens Settings never sees this. A more visible
 * surface (a toast) was considered and deliberately deferred.
 */
const SyncStatusLine: React.FunctionComponent<{ allowSync: boolean }> = ({
  allowSync,
}) => {
  const [last, setLast] = React.useState(() => readLastPublish());

  // localStorage fires no event for same-tab writes, so a failure occurring
  // while this panel is open would not appear, and a recovery would not clear.
  React.useEffect(() => {
    setLast(readLastPublish());
    const id = setInterval(() => setLast(readLastPublish()), 2000);
    return () => clearInterval(id);
  }, [allowSync]);

  // Sync off is a setting working as asked, not a fault, and any stored failure
  // predates the switch. The toggle above already says everything there is.
  if (!allowSync || !last) return null;

  const message = failureMessage(last.outcome);
  if (!message) return null;

  return (
    <div className="text-xs mb-3 ml-14 -mt-2 text-warning" role="alert">
      {message}
    </div>
  );
};

/**
 * Present tense throughout: the record always describes the most recent attempt,
 * so a stored failure means publishing is failing now, however old it is.
 * Returns null for every outcome that is not a fault.
 */
function failureMessage(outcome: string): string | null {
  switch (outcome) {
    case 'held':
      return t`Waiting for Spaces to finish syncing before this device publishes again.`;
    case 'rejected':
      return t`Sync is failing: the server refused your settings. Your changes are saved on this device.`;
    case 'timeout':
      return t`Sync is failing: the request timed out. It will keep retrying.`;
    case 'no-keys':
      return t`Can't sync: no key is available on this device.`;
    default:
      // 'published' and 'off' are not faults, and neither is an unknown value
      // written by a newer build.
      return null;
  }
}

export default SyncStatusLine;
