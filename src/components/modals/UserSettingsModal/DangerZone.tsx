import * as React from 'react';
import { Button, Callout, Input } from '../../primitives';
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

      // Delete IndexedDB database
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('quorum_db');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });

      // Clear all localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Hard reload to clear in-memory state
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset app data:', error);
      setResetError('unknown');
    }
  };

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger">
            <Trans>Reset App Data</Trans>
          </div>
          <div className="pt-2 text-body">
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
                <Trans>An error occurred while resetting app data. Please try again.</Trans>
              </Callout>
            </div>
          )}
          <div className="pt-6">
            <div className="pb-2 text-body">
              <Trans>Type <strong>RESET</strong> to confirm</Trans>
            </div>
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
