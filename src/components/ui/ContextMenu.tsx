import React, { useEffect, useState, useMemo } from 'react';
import { Icon, useTheme } from '../primitives';
import { FloatingPopover, rectAnchor } from './FloatingPopover';
import { UserAvatar } from '../user/UserAvatar';
import SpaceIcon from '../space/SpaceIcon';
import { getFolderColorHex, IconColor } from '../space/IconPicker/types';
import type { IconName, IconVariant } from '../primitives';
import './ContextMenu.scss';

const DEFAULT_MENU_WIDTH = 240;
// The menu opens slightly to the right of the cursor (matches the previous
// hand-rolled OFFSET_RIGHT nudge). flip()/shift() handle the edge cases the
// old estimated-height calculatePosition() did by hand.
const OFFSET_RIGHT = 12;

// Header configuration types
export type HeaderConfig =
  | {
      type: 'user';
      address: string;
      displayName?: string;
      userIcon?: string;
    }
  | {
      type: 'space';
      spaceId: string;
      spaceName: string;
      iconUrl?: string;
    }
  | {
      type: 'folder';
      icon: IconName;
      iconVariant?: IconVariant;
      iconColor: IconColor;
      name: string;
    }
  | {
      type: 'channel';
      channelName: string;
      icon: IconName;
      iconColor?: string;
      iconVariant?: IconVariant;
    }
  | {
      type: 'dm';
      label: string;
    };

// Menu item interface
export interface MenuItem {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
  confirmLabel?: string;
  hidden?: boolean;
  /** When true, renders a separator line above this item */
  separator?: boolean;
}

// Context menu props
export interface ContextMenuProps {
  header?: HeaderConfig;
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  width?: number;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  header,
  items,
  position,
  onClose,
  width = DEFAULT_MENU_WIDTH,
}) => {
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null);

  // Filter out hidden items
  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

  // Virtual reference at the click point, nudged right by OFFSET_RIGHT to match
  // the previous placement. FloatingPopover's flip()/shift() keep the menu in
  // the viewport (the old code estimated height from item count to do this).
  const reference = useMemo(
    () => rectAnchor({ x: position.x + OFFSET_RIGHT, y: position.y }),
    [position.x, position.y]
  );

  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // Reset confirmation after 5 second timeout
  useEffect(() => {
    if (confirmingItem) {
      const timeout = setTimeout(() => {
        setConfirmingItem(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [confirmingItem]);

  const handleItemClick = (item: MenuItem) => {
    if (item.confirmLabel && confirmingItem !== item.id) {
      setConfirmingItem(item.id);
      return;
    }
    item.onClick();
    onClose();
  };

  // Render header based on type
  const renderHeader = () => {
    if (!header) return null;

    switch (header.type) {
      case 'user': {
        const displayName = header.displayName || header.address.slice(0, 8);
        return (
          <div className="context-menu-header">
            <UserAvatar
              userIcon={header.userIcon}
              displayName={displayName}
              address={header.address}
              size={24}
            />
            <span className="context-menu-header-text">
              {displayName}
            </span>
          </div>
        );
      }
      case 'space': {
        return (
          <div className="context-menu-header">
            <SpaceIcon
              selected={false}
              iconUrl={header.iconUrl}
              spaceName={header.spaceName}
              size="small"
              notifs={false}
              noTooltip
              noToggle
              spaceId={header.spaceId}
            />
            <span className="context-menu-header-text">
              {header.spaceName}
            </span>
          </div>
        );
      }
      case 'folder': {
        const folderColor = getFolderColorHex(header.iconColor, isDarkTheme);
        return (
          <div className="context-menu-header">
            <div
              className="context-menu-folder-icon"
              style={{ backgroundColor: folderColor }}
            >
              <Icon name={header.icon || 'folder'} size="sm" variant={header.iconVariant || 'outline'} />
            </div>
            <span className="context-menu-header-text">
              {header.name}
            </span>
          </div>
        );
      }
      case 'channel': {
        return (
          <div className="context-menu-header">
            <Icon
              name={header.icon || 'hashtag'}
              size="sm"
              variant={header.iconVariant || 'outline'}
              style={header.iconColor ? { color: header.iconColor } : undefined}
            />
            <span className="context-menu-header-text truncate-channel-name">
              {header.channelName}
            </span>
          </div>
        );
      }
      case 'dm': {
        return (
          <div className="context-menu-header">
            <div
              className="context-menu-folder-icon"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Icon name="message" size="sm" />
            </div>
            <span className="context-menu-header-text">
              {header.label}
            </span>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <FloatingPopover
      open
      onClose={onClose}
      anchor={reference}
      placement="bottom-start"
      gap={0}
      role="menu"
      // Spaces/folders/DM contacts/channels live in scrollable sidebars; the
      // old code closed the menu on any scroll. closeOnScroll keeps that.
      closeOnScroll
      // .context-menu animates a transform scale on open — position via
      // top/left so the keyframe doesn't fight floating-ui's transform.
      positionViaLayout
      className="context-menu"
      style={{ width }}
    >
      {renderHeader()}

        {visibleItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.separator && <div className="context-menu-separator" />}
            <button
              className={`context-menu-item ${
                item.danger ? 'context-menu-item--danger' : ''
              }`}
              onClick={() => handleItemClick(item)}
            >
              <Icon name={item.icon} size="sm" />
              {confirmingItem === item.id && item.confirmLabel
                ? item.confirmLabel
                : item.label}
            </button>
          </React.Fragment>
        ))}
    </FloatingPopover>
  );
};

export default ContextMenu;
