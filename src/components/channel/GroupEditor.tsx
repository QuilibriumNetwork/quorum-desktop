import * as React from 'react';
import Button from '../Button';
import './GroupEditor.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate, useParams } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const GroupEditor: React.FunctionComponent<{
  spaceId: string;
  groupName?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let [group, setGroup] = React.useState<string>(groupName || '');
  let { channelId } = useParams();
  let [deleteStatus, setDeleteStatus] = React.useState<boolean>(false);
  let navigate = useNavigate();
  const { updateSpace } = useMessageDB();

  const saveChanges = React.useCallback(async () => {
    if (
      !space!.groups.find((g) => g.groupName === group) &&
      groupName !== group &&
      group !== ''
    ) {
      if (groupName) {
        updateSpace({
          ...space!,
          groups: space!.groups.map((g) => {
            return {
              ...g,
              groupName: groupName === g.groupName ? group : g.groupName,
            };
          }),
        });
      } else {
        updateSpace({
          ...space!,
          groups: [...space!.groups, { groupName: group, channels: [] }],
        });
      }
    }
    dismiss();
  }, [space, group]);

  const deleteGroup = React.useCallback(async () => {
    if (groupName) {
      const withoutGroup = space!.groups.filter(
        (g) => g.groupName !== groupName
      );
      const updatedChannelId = withoutGroup.find((g) =>
        g.channels.find((c) => c.channelId == space?.defaultChannelId)
      )
        ? space!.defaultChannelId
        : withoutGroup.length > 0 && withoutGroup[0].channels.length > 0
          ? withoutGroup[0].channels[0].channelId
          : space!.defaultChannelId;
      if (
        !withoutGroup.find((g) =>
          g.channels.find((c) => c.channelId == channelId)
        )
      ) {
        navigate('/spaces/' + space?.spaceId + '/' + updatedChannelId);
      }
      updateSpace({
        ...space!,
        defaultChannelId: updatedChannelId,
        groups: space!.groups.filter((g) => g.groupName !== groupName),
      });
    }
    dismiss();
  }, [space, group]);

  return (
    <div className="group-editor flex flex-row min-w-[350px]">
      <div className="flex flex-col grow overflow-y-scroll rounded-xl">
        <div className="group-editor-header">
          <div className="group-editor-text flex flex-col grow px-4">
            <div className="small-caps"><Trans>Group Name</Trans></div>
            <input
              className="w-full quorum-input"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            />
          </div>
        </div>
        <div className="group-editor-content flex flex-col grow">
          <div className="grow flex flex-col">
            <div className="group-editor-editor-actions justify-between">
              {groupName && (
                <Button
                  type="danger"
                  onClick={() => {
                    if (!deleteStatus) {
                      setDeleteStatus(true);
                    } else {
                      deleteGroup();
                    }
                  }}
                >
                  {!deleteStatus ? t`Delete Group` : t`Confirm Deletion`}
                </Button>
              )}
              {!groupName && <div></div>}
              <Button type="primary" onClick={() => saveChanges()}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupEditor;
