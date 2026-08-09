import * as React from 'react';
import { t } from '@lingui/core/macro';
import dayjs from '../../../utils/dayjs';
import { readLastPublish, type LastPublish } from '../../../utils/lastPublish';

/**
 * One line under the sync toggle saying what the last publish attempt did.
 *
 * Without it, "sync is on" and "sync has been silently failing since Tuesday"
 * look identical: every outcome writes the local row and the UI looks right
 * either way. The record itself is device-local — see utils/lastPublish.
 */
const SyncStatusLine: React.FunctionComponent<{ allowSync: boolean }> = ({
  allowSync,
}) => {
  const [last, setLast] = React.useState<LastPublish | null>(() =>
    readLastPublish()
  );

  // localStorage fires no event for same-tab writes, so a save made while this
  // panel is open would otherwise show a stale line until it is reopened. The
  // panel is short-lived and the read is a single parse, so polling it is
  // cheaper than threading the record through the config layer.
  React.useEffect(() => {
    setLast(readLastPublish());
    const id = setInterval(() => setLast(readLastPublish()), 2000);
    return () => clearInterval(id);
  }, [allowSync]);

  // Trust the toggle over the record here: turning sync on or off is instant,
  // but no record exists until the next save, so the line would contradict the
  // switch the user just flipped.
  if (!allowSync) {
    return (
      <StatusText>{t`Not syncing. Changes stay on this device.`}</StatusText>
    );
  }

  if (!last) return <StatusText>{t`Not synced yet.`}</StatusText>;

  const when = dayjs(last.at).fromNow();

  switch (last.outcome) {
    case 'published':
      return <StatusText>{t`Last synced ${when}.`}</StatusText>;
    case 'held':
      return (
        <StatusText warn>
          {t`Waiting for Spaces to finish syncing before this device publishes again.`}
        </StatusText>
      );
    case 'rejected':
      return (
        <StatusText warn>
          {t`Last sync was refused by the server ${when}. Your changes are saved on this device.`}
        </StatusText>
      );
    case 'timeout':
      return (
        <StatusText warn>{t`Last sync timed out ${when}. Will retry.`}</StatusText>
      );
    case 'no-keys':
      return (
        <StatusText warn>{t`Can't sync: no key available on this device.`}</StatusText>
      );
    case 'off':
      // The record says off but the toggle says on, so a save has not run since
      // it was switched. Say nothing has synced rather than guessing.
      return <StatusText>{t`Not synced yet.`}</StatusText>;
    default:
      return null;
  }
};

const StatusText: React.FunctionComponent<{
  children: React.ReactNode;
  warn?: boolean;
}> = ({ children, warn }) => (
  <div
    className={`text-xs mb-3 ml-14 -mt-2 ${warn ? 'text-warning' : 'text-subtle'}`}
    role={warn ? 'alert' : undefined}
  >
    {children}
  </div>
);

export default SyncStatusLine;
