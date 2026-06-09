import * as React from 'react';
import { Button, Callout, Input, Icon } from '../../primitives';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useSpaceMembers } from '../../../hooks';

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

  const { data: members } = useSpaceMembers({ spaceId: space?.spaceId });

  const channelCount = React.useMemo(
    () =>
      space?.groups?.reduce(
        (total: number, group: any) => total + (group.channels?.length || 0),
        0
      ) ?? 0,
    [space?.groups]
  );
  const memberCount = members?.length ?? 0;

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title text-danger flex items-center gap-2">
            <Icon name="warning" size="lg" />
            <Trans>Delete this Space</Trans>
          </div>
          <div className="pt-2 text-body">
            <Trans>
              This action cannot be undone and will permanently delete this Space and
              all of its channels and messages.
            </Trans>
          </div>

          {space && (
            <div className="mt-6 border border-default rounded-md">
              <div className="p-3 bg-chat rounded">
                <div className="flex flex-col gap-2">
                  <div className="text-label-strong font-bold">
                    {space.spaceName}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name="hashtag" size="xs" />
                    <span className="text-label-strong">
                      {channelCount} {channelCount === 1 ? 'channel' : 'channels'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name="users" size="xs" />
                    <span className="text-label-strong">
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
