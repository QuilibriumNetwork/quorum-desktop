import * as React from 'react';
import { Button } from '../../primitives';
import { Trans } from '@lingui/react/macro';

interface DangerProps {
  space: any;
  handleDeleteSpace: () => void;
  deleteConfirmationStep: number;
  setDeleteConfirmationStep: (step: number) => void;
}

const Danger: React.FunctionComponent<DangerProps> = ({
  space,
  handleDeleteSpace,
  deleteConfirmationStep,
  setDeleteConfirmationStep,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-xl font-bold text-danger">
            <Trans>Delete this space</Trans>
          </div>
          <div className="pt-2 text-sm text-main">
            Are you sure you want to delete your '
            {space?.spaceName}' space? This action cannot be
            undone and will permanently remove all messages,
            channels, and settings associated with this space.
          </div>
          <div className="pt-6">
            <Button
              type="danger-outline"
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