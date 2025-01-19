import * as React from 'react';
import './ChannelGroup.scss';
import { Link, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';

const ChannelGroup: React.FunctionComponent<{
  group: {
    groupName: string;
    channels: {
      channelId: string;
      channelName: string;
      unreads?: number;
      mentionCount?: number;
      mentions?: string;
    }[];
  };
  setIsGroupEditorOpen: React.Dispatch<
    React.SetStateAction<
      | {
          groupName?: string;
        }
      | undefined
    >
  >;
  setIsChannelEditorOpen: React.Dispatch<
    React.SetStateAction<
      | {
          groupName: string;
          channelId?: string;
        }
      | undefined
    >
  >;
}> = (props) => {
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
            'truncate ' +
            (isSpaceOwner ? 'hover:text-white cursor-pointer' : '')
          }
          onClick={() => {
            if (isSpaceOwner) {
              props.setIsGroupEditorOpen({ groupName: props.group.groupName });
            }
          }}
        >
          {props.group.groupName}
        </div>
        {isSpaceOwner && (
          <div className="pt-[.15rem] pr-2">
            <FontAwesomeIcon
              className="hover:text-white cursor-pointer"
              onClick={() =>
                props.setIsChannelEditorOpen({
                  groupName: props.group.groupName,
                })
              }
              size={'2xs'}
              icon={faPlus}
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
                'channel-group-channel-name' +
                (channel.channelId === channelId ? '-focused' : '') +
                (channel.unreads && channel.unreads > 0
                  ? ' !font-bold !opacity-100'
                  : '')
              }
            >
              #{channel.channelName}
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
              {isSpaceOwner && (
                <div
                  onClick={(e) => {
                    props.setIsChannelEditorOpen({
                      groupName: props.group.groupName,
                      channelId: channel.channelId,
                    });
                  }}
                  className={'channel-configure float-right'}
                >
                  <FontAwesomeIcon size={'2xs'} icon={faGear} />
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
