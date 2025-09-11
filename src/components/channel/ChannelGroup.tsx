import * as React from 'react';
import './ChannelGroup.scss';
import { Link, useParams } from 'react-router-dom';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { useModalContext } from '../context/ModalProvider';
import { Icon } from '../primitives';

const ChannelGroup: React.FunctionComponent<{
  group: {
    groupName: string;
    channels: {
      channelId: string;
      channelName: string;
      unreads?: number;
      mentionCount?: number;
      mentions?: string;
      isReadOnly?: boolean;
    }[];
  };
  onEditGroup: (groupName: string) => void;
}> = (props) => {
  const { openChannelEditor } = useModalContext();
  let { spaceId, channelId } = useParams<{
    spaceId: string;
    channelId: string;
  }>();
  let { data: isSpaceOwner } = useSpaceOwner({ spaceId: spaceId! });

  return (
    <div className="channel-group">
      <div className="channel-group-name small-caps flex flex-row justify-between">
        <div
          className={
            'truncate ' + (isSpaceOwner ? 'hover:text-main cursor-pointer' : '')
          }
          onClick={() => {
            if (isSpaceOwner) {
              props.onEditGroup(props.group.groupName);
            }
          }}
        >
          {props.group.groupName}
        </div>
        {isSpaceOwner && (
          <div className="pt-[.15rem]">
            <Icon
              name="plus"
              className="hover:text-main cursor-pointer"
              onClick={() =>
                openChannelEditor(spaceId!, props.group.groupName, '')
              }
              size="xs"
            />
          </div>
        )}
      </div>
      {props.group.channels.map((channel) => (
        <Link
          key={channel.channelName}
          to={`/spaces/${spaceId}/${channel.channelId}`}
        >
          <div className="channel-group-channel">
            <div
              className={
                'channel-group-channel-name flex items-start justify-between' +
                (channel.channelId === channelId ? '-focused' : '') +
                (channel.unreads && channel.unreads > 0
                  ? ' !font-bold !opacity-100'
                  : '')
              }
            >
              <div className="flex-1 min-w-0 flex items-center gap-1">
                {channel.isReadOnly ? (
                  <>
                    <Icon 
                      name="lock" 
                      size="xs" 
                      className="text-subtle" 
                      title="Read-only channel"
                    />
                    <span>{channel.channelName}</span>
                  </>
                ) : (
                  <>
                    <Icon 
                      name="hashtag" 
                      size="xs" 
                      className="text-subtle" 
                    />
                    <span>{channel.channelName}</span>
                  </>
                )}
                {!!channel.mentionCount ? (
                  <span
                    className={
                      'channel-group-channel-name-mentions-' + channel.mentions
                    }
                  >
                    {channel.mentionCount}
                  </span>
                ) : (
                  <></>
                )}
              </div>
              {isSpaceOwner && (
                <div
                  onClick={() => {
                    openChannelEditor(
                      spaceId!,
                      props.group.groupName,
                      channel.channelId
                    );
                  }}
                  className={'channel-configure flex-shrink-0 ml-2'}
                >
                  <Icon name="cog" size="xs" />
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default ChannelGroup;
