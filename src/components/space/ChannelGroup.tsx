import * as React from 'react';
import './ChannelGroup.scss';
import { useParams, useNavigate } from 'react-router-dom';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { useModalContext } from '../context/ModalProvider';
import { Icon } from '../primitives';
import { getIconColorHex, IconColor } from './IconPicker/types';
import { isTouchDevice } from '../../utils/platform';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import ChannelItem from './ChannelItem';
import { useChannelMute } from '../../hooks/business/channels';
import { useOptionalShellState } from '../shell/useShellState';

const ChannelGroup: React.FunctionComponent<{
  group: {
    groupName: string;
    icon?: string;
    iconColor?: string;
    iconVariant?: 'outline' | 'filled';
    channels: {
      channelId: string;
      channelName: string;
      unreads?: number;
      mentionCount?: number;
      mentions?: string;
      isReadOnly?: boolean;
      createdDate?: number;
      icon?: string;
      iconColor?: string;
      iconVariant?: 'outline' | 'filled';
    }[];
  };
  onEditGroup: (groupName: string) => void;
}> = (props) => {
  const { openChannelEditor } = useModalContext();
  const navigate = useNavigate();
  const shell = useOptionalShellState();
  const { spaceId, channelId } = useParams<{
    spaceId: string;
    channelId: string;
  }>();
  const { data: isSpaceOwner } = useSpaceOwner({ spaceId: spaceId! });
  const isTouch = isTouchDevice();

  // Channel mute functionality
  const { isChannelMuted, toggleMute } = useChannelMute({ spaceId: spaceId! });

  // Long press handler for group name (touch devices)
  const groupLongPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: () => {
      if (isTouch && isSpaceOwner) {
        hapticMedium();
        props.onEditGroup(props.group.groupName);
      }
    },
    onTap: () => {
      // On desktop or for space owners, handle the click
      if (!isTouch && isSpaceOwner) {
        props.onEditGroup(props.group.groupName);
      }
    },
    shouldPreventDefault: true,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold
  });

  // Handle channel navigation. Closes the phone drawer (if open) so the user
  // sees the channel they just picked, even when re-tapping the current channel.
  const handleChannelNavigate = React.useCallback((channelId: string) => {
    shell?.closeDrawer();
    navigate(`/spaces/${spaceId}/${channelId}`);
  }, [navigate, spaceId, shell]);

  const handleChannelClick = React.useCallback(() => {
    shell?.closeDrawer();
  }, [shell]);

  return (
    <div className="channel-group">
      <div className="channel-group-name small-caps flex flex-row justify-between">
        <div
          className={
            'min-w-0 overflow-hidden' +
            ((isSpaceOwner && !isTouch) ? ' hover:text-main cursor-pointer' : '') +
            (isTouch ? ' cursor-pointer' : '') +
            (groupLongPressHandlers.className ? ` ${groupLongPressHandlers.className}` : '')
          }
          style={groupLongPressHandlers.style}
          onClick={() => {
            if (!isTouch && isSpaceOwner) {
              props.onEditGroup(props.group.groupName);
            }
          }}
          {...(isTouch ? groupLongPressHandlers : {})}
        >
          {/* Inner wrapper for icon + text with gap - not affected by long press handlers */}
          <div className="flex items-center gap-2 min-w-0">
            {props.group.icon && (
              <Icon
                key={`group-${props.group.groupName}-${props.group.icon}`}
                name={props.group.icon as any}
                size="sm"
                variant={props.group.iconVariant || 'outline'}
                className="flex-shrink-0"
                style={{
                  color: getIconColorHex(props.group.iconColor as IconColor)
                }}
                title={`${props.group.groupName}`}
              />
            )}
            <span className="truncate-group-name flex-shrink min-w-0">{props.group.groupName}</span>
          </div>
        </div>
        {isSpaceOwner && (
          <div className="pt-[.15rem]">
            <Icon
              name="plus"
              className="hover:text-main cursor-pointer"
              onClick={() =>
                openChannelEditor(spaceId!, props.group.groupName, '')
              }
              size="sm"
            />
          </div>
        )}
      </div>
      {props.group.channels.map((channel) => (
        <ChannelItem
          key={channel.channelId}
          channel={channel}
          spaceId={spaceId!}
          currentChannelId={channelId!}
          isSpaceOwner={isSpaceOwner}
          isTouch={isTouch}
          groupName={props.group.groupName}
          isMuted={isChannelMuted(channel.channelId)}
          onChannelClick={handleChannelClick}
          onChannelNavigate={handleChannelNavigate}
          openChannelEditor={openChannelEditor}
          onToggleMute={toggleMute}
        />
      ))}
    </div>
  );
};

export default ChannelGroup;
