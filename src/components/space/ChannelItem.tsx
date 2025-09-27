import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../primitives';
import { getIconColorHex, IconColor } from './IconPicker/types';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticLight, hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';

interface Channel {
  channelId: string;
  channelName: string;
  unreads?: number;
  mentionCount?: number;
  mentions?: string;
  isReadOnly?: boolean;
  isPinned?: boolean;
  pinnedAt?: number;
  createdDate?: number;
  icon?: string;
  iconColor?: string;
}

interface ChannelItemProps {
  channel: Channel;
  spaceId: string;
  currentChannelId: string;
  isSpaceOwner: boolean;
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  groupName: string;
  onChannelClick?: () => void;
  onChannelNavigate: (channelId: string) => void;
  closeLeftSidebar: () => void;
  openChannelEditor: (spaceId: string, groupName: string, channelId: string) => void;
}

const ChannelContent: React.FC<{
  channel: Channel;
  currentChannelId: string;
  isSpaceOwner: boolean;
  isTouch: boolean;
  spaceId: string;
  groupName: string;
  openChannelEditor: (spaceId: string, groupName: string, channelId: string) => void;
}> = ({ channel, currentChannelId, isSpaceOwner, isTouch, spaceId, groupName, openChannelEditor }) => (
  <div className="channel-group-channel">
    <div
      className={
        'channel-group-channel-name flex items-start justify-between' +
        (channel.channelId === currentChannelId
          ? ' channel-group-channel-name-focused'
          : '') +
        (channel.unreads && channel.unreads > 0
          ? ' !font-bold !opacity-100'
          : '')
      }
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* Icon stack with base icon + optional pin overlay */}
        <div className="channel-icon-container">
          <Icon
            key={`channel-${channel.channelId}`}
            name={(channel.icon as any) || "hashtag"}
            size="xs"
            style={{
              color: getIconColorHex(channel.iconColor as IconColor)
            }}
            title={`${channel.channelName}`}
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
      {isSpaceOwner && !isTouch && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openChannelEditor(spaceId, groupName, channel.channelId);
          }}
          className={'channel-configure flex-shrink-0 ml-2'}
        >
          <Icon name="cog" size="xs" />
        </div>
      )}
    </div>
  </div>
);

const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  spaceId,
  currentChannelId,
  isSpaceOwner,
  isTouch,
  isMobile,
  isTablet,
  groupName,
  onChannelClick,
  onChannelNavigate,
  closeLeftSidebar,
  openChannelEditor,
}) => {
  // Create long press handlers within the component (proper hook usage)
  const longPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: () => {
      if (isTouch && isSpaceOwner) {
        hapticMedium();
        openChannelEditor(spaceId, groupName, channel.channelId);
      }
    },
    onTap: () => {
      // Navigate to channel and close sidebar on mobile/tablet
      if (isTouch) {
        hapticLight();
      }
      onChannelNavigate(channel.channelId);
      if (isMobile || isTablet) {
        closeLeftSidebar();
      }
    },
    shouldPreventDefault: true,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold
  });

  const channelContent = (
    <ChannelContent
      channel={channel}
      currentChannelId={currentChannelId}
      isSpaceOwner={isSpaceOwner}
      isTouch={isTouch}
      spaceId={spaceId}
      groupName={groupName}
      openChannelEditor={openChannelEditor}
    />
  );

  if (isTouch) {
    return (
      <div
        {...longPressHandlers}
        className={`cursor-pointer ${longPressHandlers.className || ''}`}
        style={longPressHandlers.style}
      >
        {channelContent}
      </div>
    );
  }

  return (
    <Link
      to={`/spaces/${spaceId}/${channel.channelId}`}
      onClick={onChannelClick}
    >
      {channelContent}
    </Link>
  );
};

export default ChannelItem;