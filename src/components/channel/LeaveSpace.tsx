import * as React from 'react';
import Button from '../Button';
import './LeaveSpace.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';
import { Trans } from '@lingui/react/macro';

const LeaveSpace: React.FunctionComponent<{
  spaceId: string;
  dismiss: () => void;
}> = ({ spaceId, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let navigate = useNavigate();
  const { deleteSpace } = useMessageDB();

  const leaveSpace = React.useCallback(async () => {
    deleteSpace(space!.spaceId);
    navigate('/messages');
    dismiss();
  }, [space]);

  return (
    <div className="leave-space flex flex-row">
      <div className="flex flex-col grow overflow-y-scroll rounded-xl">
        <div className="leave-space-header">
          <div className="leave-space-text flex flex-col grow px-4">
            <div className="text-xl py-2">
              <Trans>Leave Space</Trans>
            </div>
            <div>
              <Trans>
                Are you sure you want to leave {space?.spaceName}? You won't be
                able to rejoin unless you are re-invited.
              </Trans>
            </div>
          </div>
        </div>
        <div className="leave-space-content flex flex-col grow">
          <div className="grow flex flex-col justify-end">
            <div className="leave-space-editor-actions justify-between">
              <Button type="primary" onClick={() => dismiss()}>
                <Trans>Cancel</Trans>
              </Button>
              {<div></div>}
              {
                <Button type="danger" onClick={() => leaveSpace()}>
                  <Trans>Leave Space</Trans>
                </Button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveSpace;
