import * as React from 'react';
import { Button, Callout, Input } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface DangerProps {
  space: any;
  handleDeleteSpace: () => void;
  deleteError: string | null;
  clearDeleteError: () => void;
}

const Danger: React.FunctionComponent<DangerProps> = ({
  space,
  handleDeleteSpace,
  deleteError,
  clearDeleteError,
}) => {
  const [confirmInput, setConfirmInput] = React.useState('');
  const isConfirmed = confirmInput.trim().toLowerCase() === 'delete';

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger">
            <Trans>Delete this space</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>
              This action cannot be undone and will permanently delete this Space and
              all of its channels and messages.
            </Trans>
          </div>
          {deleteError && (
            <div className="pt-4">
              <Callout
                variant="error"
                size="sm"
                dismissible
                onClose={clearDeleteError}
              >
                <Trans>An error occurred while deleting the Space. Please try again.</Trans>
              </Callout>
            </div>
          )}
          <div className="pt-6">
            <Input
              value={confirmInput}
              onChange={setConfirmInput}
              placeholder={t`Type DELETE to confirm`}
              variant="bordered"
            />
          </div>
          <div className="pt-4">
            <Button
              type="danger"
              className="!w-auto !inline-flex"
              disabled={!isConfirmed}
              onClick={handleDeleteSpace}
            >
              <Trans>Delete Space</Trans>
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
