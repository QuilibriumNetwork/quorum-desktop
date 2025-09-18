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
      isPinned?: boolean;
      pinnedAt?: number;
      createdDate?: number;
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

  // Sort channels: pinned first (newest pin on top), then unpinned (by creation date)
  const sortedChannels = React.useMemo(() => {
    return [...props.group.channels].sort((a, b) => {
      // Pinned channels go first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Among pinned: newer pins first (DESC)
      if (a.isPinned && b.isPinned) {
        return (b.pinnedAt || 0) - (a.pinnedAt || 0);
      }
      
      // Among unpinned: maintain original order (ASC by createdDate)
      return (a.createdDate || 0) - (b.createdDate || 0);
    });
  }, [props.group.channels]);

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
      {sortedChannels.map((channel) => (
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
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {/* Icon stack with base icon + optional pin overlay */}
                <div className="channel-icon-container">
                  <Icon
                    name={channel.isReadOnly ? "lock" : "hashtag"}
                    size="xs"
                    className="text-subtle"
                    title={channel.isReadOnly ? "Read-only channel" : undefined}
                  />
                  {channel.isPinned && isSpaceOwner && (
                    <div className="channel-pin-overlay">
                      <Icon
                        name="thumbtack"
                        className="pin-icon text-strong"
                        title="Pinned channel"
                      />
                    </div>
                  )}
                </div>
                <span title={channel.isPinned ? 'Pinned channel' : undefined}>
                  {channel.channelName}
                </span>
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
