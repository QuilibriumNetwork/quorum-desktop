import * as React from 'react';
import Button from '../Button';
import '../../styles/_modal_common.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { Channel } from '../../api/quorumApi';
import { useNavigate, useParams } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const ChannelEditor: React.FunctionComponent<{
  spaceId: string;
  groupName: string;
  channelId?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, channelId, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let { channelId: routeChannelId } = useParams();
  let [channelName, setChannelName] = React.useState<string>(
    space?.groups
      .find((g) => g.groupName === groupName)
      ?.channels.find((c) => c.channelId === channelId)?.channelName || ''
  );
  let [channelTopic, setChannelTopic] = React.useState<string>(
    space?.groups
      .find((g) => g.groupName === groupName)
      ?.channels.find((c) => c.channelId === channelId)?.channelTopic || ''
  );
  let [deleteStatus, setDeleteStatus] = React.useState<boolean>(false);
  let navigate = useNavigate();
  const { updateSpace, createChannel } = useMessageDB();

  const saveChanges = React.useCallback(async () => {
    if (channelId) {
      updateSpace({
        ...space!,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? g.channels.map((c) =>
                    c.channelId === channelId
                      ? {
                          ...c,
                          channelName: channelName,
                          channelTopic: channelTopic,
                          modifiedDate: Date.now(),
                        }
                      : c
                  )
                : g.channels,
          };
        }),
      });
    } else {
      const channelAddress = await createChannel(spaceId);
      updateSpace({
        ...space!,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? [
                    ...g.channels,
                    {
                      channelId: channelAddress,
                      spaceId: spaceId,
                      channelName: channelName,
                      channelTopic: channelTopic,
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                    } as Channel,
                  ]
                : g.channels,
          };
        }),
      });
    }
    dismiss();
  }, [space, channelName, channelTopic]);

  const deleteChannel = React.useCallback(async () => {
    if (channelId) {
      const updatedChannelId =
        space?.defaultChannelId == channelId
          ? (space.groups
              .find((g) => g.channels.find((c) => c.channelId != channelId))
              ?.channels.find((c) => c.channelId != channelId)?.channelId ??
            space.defaultChannelId)
          : space!.defaultChannelId;
      if (routeChannelId == channelId) {
        navigate('/spaces/' + spaceId + '/' + updatedChannelId);
      }
      updateSpace({
        ...space!,
        defaultChannelId: updatedChannelId,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels: g.channels.filter((c) => c.channelId !== channelId),
          };
        }),
      });
      dismiss();
    }
  }, [space, channelName, channelTopic]);

  return (
    <div className="modal-small-container">
      <div className="modal-small-layout">
        <div className="modal-small-content">
          <div className="modal-content-section">
            <div className="modal-content-info">
              <div className="small-caps">
                <Trans>Channel Name</Trans>
              </div>
              <input
                className="w-full quorum-input"
                value={channelName}
                onChange={(e) =>
                  setChannelName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9\-]/gi, '')
                  )
                }
              />
            </div>
            <div className="modal-content-info">
              <div className="small-caps">
                <Trans>Channel Topic</Trans>
              </div>
              <input
                className="w-full quorum-input"
                value={channelTopic}
                onChange={(e) => setChannelTopic(e.target.value)}
              />
            </div>
            <div className="modal-small-actions">
              {channelId && (
                <Button
                  type="danger"
                  onClick={() => {
                    if (!deleteStatus) {
                      setDeleteStatus(true);
                    } else {
                      deleteChannel();
                    }
                  }}
                >
                  {!deleteStatus ? t`Delete Channel` : t`Confirm Deletion`}
                </Button>
              )}
              <Button type="primary" onClick={() => saveChanges()}>
                <Trans>Save Changes</Trans>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelEditor;
