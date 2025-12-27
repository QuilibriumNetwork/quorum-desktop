import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../primitives';
import { getIconColorHex, IconColor } from './IconPicker/types';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { hapticLight, hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { formatMentionCount } from '../../utils/formatMentionCount';
import ContextMenu, { MenuItem, HeaderConfig } from '../ui/ContextMenu';
import { t } from '@lingui/core/macro';

interface Channel {
  channelId: string;
  channelName: string;
  unreads?: number;
  mentionCount?: number;
  isReadOnly?: boolean;
  isPinned?: boolean;
  pinnedAt?: number;
  createdDate?: number;
  icon?: string;
  iconColor?: string;
  iconVariant?: 'outline' | 'filled';
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
  isMuted?: boolean;
  onChannelClick?: () => void;
  onChannelNavigate: (channelId: string) => void;
  closeLeftSidebar: () => void;
  openChannelEditor: (
    spaceId: string,
    groupName: string,
    channelId: string
  ) => void;
  onToggleMute?: (channelId: string) => Promise<void>;
  onTogglePin?: (channelId: string, isPinned: boolean) => Promise<void>;
}

const ChannelContent: React.FC<{
  channel: Channel;
  currentChannelId: string;
  isSpaceOwner: boolean;
  isTouch: boolean;
  spaceId: string;
  groupName: string;
  openChannelEditor: (
    spaceId: string,
    groupName: string,
    channelId: string
  ) => void;
}> = ({
  channel,
  currentChannelId,
  isSpaceOwner,
  isTouch,
  spaceId,
  groupName,
  openChannelEditor,
}) => (
  <div className="channel">
    <div
      className={
        'channel-name flex items-center justify-between' +
        (channel.channelId === currentChannelId ? ' channel-name-focused' : '')
      }
    >
      <div className="flex-1 min-w-0 flex items-center gap-2 relative">
        {/* Unread dot positioned absolutely to the left without affecting layout */}
        {!!channel.unreads && (
          <div className="channel-unread-dot" title="Unread messages" />
        )}
        {/* Icon stack with base icon + optional pin overlay */}
        <div className="channel-icon-container">
          <Icon
            key={`channel-${channel.channelId}`}
            name={(channel.icon as any) || 'hashtag'}
            size="sm"
            variant={channel.iconVariant || 'outline'}
            style={{
              color: getIconColorHex(channel.iconColor as IconColor),
            }}
            title={`${channel.channelName}`}
          />
          {channel.isPinned && isSpaceOwner && (
            <div className="channel-pin-overlay">
              <Icon
                name="pin"
                variant="filled"
                className="pin-icon text-subtle hover:text-main"
                title="Pinned channel"
              />
            </div>
          )}
        </div>
        <span
          className="truncate-channel-name flex-shrink min-w-0"
          title={channel.isPinned ? 'Pinned channel' : undefined}
        >
          {channel.channelName}
        </span>
        {!!channel.mentionCount && (
          <span className="channel-mentions-bubble">
            {formatMentionCount(channel.mentionCount)}
          </span>
        )}
      </div>
      {isSpaceOwner && !isTouch && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openChannelEditor(spaceId, groupName, channel.channelId);
          }}
          className={
            'channel-configure flex-shrink-0 ml-2 flex items-center justify-center'
          }
        >
          <Icon
            name="settings"
            size="sm"
            variant="filled"
            className="text-subtle hover:text-main"
          />
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
  isMuted = false,
  onChannelClick,
  onChannelNavigate,
  closeLeftSidebar,
  openChannelEditor,
  onToggleMute,
  onTogglePin,
}) => {
  const navigate = useNavigate();

  // Context menu state
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Track last touch position for long press context menu
  const lastTouchPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Open context menu at given position
  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenuPosition({ x, y });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  // Handle right-click for desktop
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY);
    },
    [openContextMenu]
  );

  // Build context menu header
  const contextMenuHeader: HeaderConfig = {
    type: 'channel',
    channelName: channel.channelName,
    icon: (channel.icon as any) || 'hashtag',
    iconColor: getIconColorHex(channel.iconColor as IconColor),
    iconVariant: channel.iconVariant || 'outline',
  };

  // Build context menu items (role-aware)
  const contextMenuItems: MenuItem[] = [];

  // Space owners get Channel Settings option
  if (isSpaceOwner) {
    contextMenuItems.push({
      id: 'channel-settings',
      icon: 'settings',
      label: t`Channel Settings`,
      onClick: () => openChannelEditor(spaceId, groupName, channel.channelId),
    });

    // Pin/Unpin option (owners only)
    contextMenuItems.push({
      id: 'toggle-pin',
      icon: channel.isPinned ? 'pin-off' : 'pin',
      label: channel.isPinned ? t`Unpin Channel` : t`Pin Channel`,
      onClick: async () => {
        if (onTogglePin) {
          await onTogglePin(channel.channelId, !channel.isPinned);
        }
      },
    });
  }

  // Everyone gets Mute/Unmute option
  contextMenuItems.push({
    id: 'toggle-mute',
    icon: isMuted ? 'bell' : 'bell-off',
    label: isMuted ? t`Unmute Channel` : t`Mute Channel`,
    onClick: async () => {
      if (onToggleMute) {
        await onToggleMute(channel.channelId);
      }
    },
  });

  // Create long press handlers within the component (proper hook usage)
  const longPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    onLongPress: () => {
      // Open context menu for all users on long press (not just owners)
      if (isTouch) {
        hapticMedium();
        // Use the stored touch position from onTouchStart
        openContextMenu(lastTouchPosition.current.x, lastTouchPosition.current.y);
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
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
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

  // Muted channel styling (60% opacity)
  const mutedClassName = isMuted ? 'channel-item-muted' : '';

  // Wrap the original onTouchStart to capture position
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        lastTouchPosition.current = { x: touch.clientX, y: touch.clientY };
      }
      // Call the original handler
      longPressHandlers.onTouchStart(e);
    },
    [longPressHandlers]
  );

  if (isTouch) {
    return (
      <>
        <div
          {...longPressHandlers}
          onTouchStart={handleTouchStart}
          className={`cursor-pointer ${longPressHandlers.className || ''} ${mutedClassName}`}
          style={longPressHandlers.style}
        >
          {channelContent}
        </div>
        {contextMenuPosition && (
          <ContextMenu
            header={contextMenuHeader}
            items={contextMenuItems}
            position={contextMenuPosition}
            onClose={closeContextMenu}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        className={`cursor-pointer ${mutedClassName}`}
        onClick={() => {
          onChannelClick?.();
          navigate(`/spaces/${spaceId}/${channel.channelId}`);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChannelClick?.();
            navigate(`/spaces/${spaceId}/${channel.channelId}`);
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {channelContent}
      </div>
      {contextMenuPosition && (
        <ContextMenu
          header={contextMenuHeader}
          items={contextMenuItems}
          position={contextMenuPosition}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
};

export default ChannelItem;
