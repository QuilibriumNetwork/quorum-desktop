import * as React from 'react';
import { Button, Callout, Icon, Input } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useQueryClient } from '@tanstack/react-query';

const DangerZone: React.FunctionComponent = () => {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = React.useState('');
  const [resetError, setResetError] = React.useState<string | null>(null);

  const isConfirmed = confirmInput.trim().toLowerCase() === 'reset';

  const handleResetAppData = async () => {
    try {
      // Clear React Query cache
      queryClient.clear();

      // Delete IndexedDB database. A blocked delete means another tab still
      // holds the DB open — treating it as success (the old behavior) silently
      // reloaded on the SAME data, so the reset appeared to do nothing. Reject
      // so the user is told to close other tabs instead.
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('quorum_db');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
      });

      // Clear all localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Hard reload to clear in-memory state
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset app data:', error);
      setResetError((error as Error)?.message === 'blocked' ? 'blocked' : 'unknown');
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
              disabled={!isConfirmed}
              onClick={handleResetAppData}
            >
              <Trans>Confirm Reset</Trans>
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
