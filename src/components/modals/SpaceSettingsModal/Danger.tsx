import * as React from 'react';
import { Button, Callout } from '../../primitives';
import { Trans } from '@lingui/react/macro';

interface DangerProps {
  space: any;
  handleDeleteSpace: () => void;
  deleteConfirmationStep: number;
  setDeleteConfirmationStep: (step: number) => void;
  deleteError: string | null;
  clearDeleteError: () => void;
}

const Danger: React.FunctionComponent<DangerProps> = ({
  space,
  handleDeleteSpace,
  deleteConfirmationStep,
  setDeleteConfirmationStep,
  deleteError,
  clearDeleteError,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger">
            <Trans>Delete this space</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>This action cannot be undone and will permanently remove all the Space settings. To delete the Space, you must first delete all Channels.</Trans>
          </div>
          {deleteError && (
            <div className="pt-4">
              <Callout
                variant="error"
                size="sm"
                dismissible
                onClose={clearDeleteError}
              >
                {deleteError === 'channels-exist' ? (
                  <Trans>Cannot delete Space with channels. Please delete all channels first.</Trans>
                ) : (
                  <Trans>An error occurred while deleting the Space. Please try again.</Trans>
                )}
              </Callout>
            </div>
          )}
          <div className="pt-6">
            <Button
              type="danger"
              className="!w-auto !inline-flex"
              onClick={() => {
                if (deleteConfirmationStep === 0) {
                  setDeleteConfirmationStep(1);
                  // Reset confirmation after 5 seconds
                  setTimeout(
                    () => setDeleteConfirmationStep(0),
                    5000
                  );
                } else {
                  handleDeleteSpace();
                }
              }}
            >
              {deleteConfirmationStep === 0 ? (
                <Trans>Delete Space</Trans>
              ) : (
                <Trans>Click again to confirm</Trans>
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

export default Danger;