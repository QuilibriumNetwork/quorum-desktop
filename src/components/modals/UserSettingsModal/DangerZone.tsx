import * as React from 'react';
import { Button, Callout, Icon, Input } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useDeregisterThisDevice } from '../../../hooks/business/user/useDeregisterThisDevice';
import { wipeLocalAppData } from '../../../services/resetAppData';

const DangerZone: React.FunctionComponent = () => {
  const queryClient = useQueryClient();
  const deregisterThisDevice = useDeregisterThisDevice();
  const [confirmInput, setConfirmInput] = React.useState('');
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  const isConfirmed = confirmInput.trim().toLowerCase() === 'reset';

  const handleResetAppData = async () => {
    setIsResetting(true);
    try {
      // Say goodbye BEFORE anything is destroyed. The device keyset below is
      // the only handle to this device's hub entry and the only key that can
      // revoke its space signing admission, so wiping first strands both and
      // every reset+re-login appends a fresh entry instead of replacing one.
      //
      // The catch is load-bearing: a goodbye that fails (offline, hub down, a
      // bug in here) must never stop the user from resetting — people reset
      // precisely when things are broken. The cost of failing is one stale
      // entry they can remove by hand from another device.
      const outcome = await deregisterThisDevice().catch((err) => {
        console.warn('[Reset] deregistration threw', err);
        return { hub: 'failed', spaces: 'failed' } as const;
      });
      if (outcome.hub !== 'ok') {
        console.warn(
          `[Reset] hub deregistration ${outcome.hub} — this device may stay listed until removed manually`
        );
      }
      if (outcome.spaces !== 'ok') {
        console.warn(
          `[Reset] space revocation ${outcome.spaces} — other members may keep trusting this device's signing key`
        );
      }

      // Clear React Query cache
      queryClient.clear();

      // Both IndexedDB databases (the app's own and the SDK's key store) plus
      // all web storage. Deliberately AFTER the deregistration above, which
      // signs with the master key this destroys.
      //
      // A blocked delete still rejects rather than resolving: treating it as
      // success (the old behavior) silently reloaded on the SAME data, so the
      // reset appeared to do nothing.
      await wipeLocalAppData();

      // Hard reload to clear in-memory state
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset app data:', error);
      setResetError((error as Error)?.message === 'blocked' ? 'blocked' : 'unknown');
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger flex items-center gap-2">
            <Icon name="warning" size="lg" />
            <Trans>Reset App Data</Trans>
          </div>
          <div className="pt-2 text-label">
            <Trans>This will delete all your data from this browser, including your private keys and all direct messages. Direct messages cannot be recovered. Make sure you have exported your private key from the Privacy/Security settings. This action cannot be undone.</Trans>
          </div>
          {resetError && (
            <div className="pt-4">
              <Callout
                variant="error"
                size="sm"
                dismissible
                onClose={() => setResetError(null)}
              >
                {resetError === 'blocked' ? (
                  <Trans>Couldn't reset: Quorum is open in another tab. Close all other Quorum tabs, then try again.</Trans>
                ) : (
                  <Trans>An error occurred while resetting app data. Please try again.</Trans>
                )}
              </Callout>
            </div>
          )}
          <div className="pt-6">
            <Input
              value={confirmInput}
              onChange={setConfirmInput}
              placeholder={t`Type RESET to confirm`}
              variant="bordered"
            />
          </div>
          <div className="pt-4">
            <Button
              type="danger"
              className="!w-auto !inline-flex"
              disabled={!isConfirmed || isResetting}
              onClick={handleResetAppData}
            >
              {isResetting ? (
                <Trans>Resetting...</Trans>
              ) : (
                <Trans>Confirm Reset</Trans>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <div className="modal-content-info"></div>
      </div>
    </>
  );
};

export default DangerZone;
