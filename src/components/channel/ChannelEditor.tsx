import * as React from 'react';
import Button from '../Button';
import './ChannelEditor.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { Channel } from '../../api/quorumApi';
import { useNavigate, useParams } from 'react-router';

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
    <div className="channel-editor flex flex-row min-w-[350px]">
      <div className="flex flex-col grow overflow-y-scroll rounded-xl">
        <div className="channel-editor-header">
          <div className="channel-editor-text flex flex-col grow px-4">
            <div className="small-caps">Channel Name</div>
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
        </div>
        <div className="channel-editor-content flex flex-col grow">
          <div className="channel-editor-content-section-header small-caps">
            Channel Topic
          </div>
          <div className="channel-editor-info">
            <input
              className="w-full quorum-input"
              value={channelTopic}
              onChange={(e) => setChannelTopic(e.target.value)}
            />
          </div>
          <div className="grow flex flex-col justify-end mt-4">
            <div className="channel-editor-editor-actions justify-between">
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
                  {!deleteStatus ? 'Delete Channel' : 'Confirm Deletion'}
                </Button>
              )}
              {!channelId && <div></div>}
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

export default ChannelEditor;
