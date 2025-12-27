import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Portal, Icon, useTheme } from '../primitives';
import { useClickOutside } from '../../hooks/useClickOutside';
import { UserAvatar } from '../user/UserAvatar';
import SpaceIcon from '../navbar/SpaceIcon';
import { getFolderColorHex, IconColor } from '../space/IconPicker/types';
import { IconName, IconVariant } from '../primitives/Icon/types';
import './ContextMenu.scss';

// Fixed dimensions for viewport edge detection
const DEFAULT_MENU_WIDTH = 240;
const ITEM_HEIGHT = 36; // Approximate height per item
const HEADER_HEIGHT = 44; // Approximate height for header
const SEPARATOR_HEIGHT = 9; // Height for separator (1px line + 8px margin)
const PADDING = 8;
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

function calculatePosition(
  clickX: number,
  clickY: number,
  menuWidth: number,
  menuHeight: number
) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const offsetClickX = clickX + OFFSET_RIGHT;
  const flipX = offsetClickX + menuWidth + PADDING > viewportW;
  const flipY = clickY + menuHeight + PADDING > viewportH;

  return {
    x: flipX ? Math.max(PADDING, clickX - menuWidth) : offsetClickX,
    y: flipY ? Math.max(PADDING, clickY - menuHeight) : clickY,
  };
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  header,
  items,
  position,
  onClose,
  width = DEFAULT_MENU_WIDTH,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null);

  // Filter out hidden items
  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

  // Calculate menu height based on items
  const menuHeight = useMemo(() => {
    const itemsHeight = visibleItems.length * ITEM_HEIGHT;
    const separatorsHeight = visibleItems.filter((item) => item.separator).length * SEPARATOR_HEIGHT;
    const headerHeight = header ? HEADER_HEIGHT : 0;
    return itemsHeight + separatorsHeight + headerHeight + PADDING * 2;
  }, [visibleItems, header]);

  const [adjustedPosition, setAdjustedPosition] = useState(() =>
    calculatePosition(position.x, position.y, width, menuHeight)
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

  // Click outside to close
  useClickOutside(menuRef, onClose, true);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on scroll (with close-once guard)
  useEffect(() => {
    let hasClosed = false;
    const handleScroll = () => {
      if (hasClosed) return;
      hasClosed = true;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, { capture: true });
    return () =>
      window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  // Recalculate position if it changes
  useEffect(() => {
    setAdjustedPosition(
      calculatePosition(position.x, position.y, width, menuHeight)
    );
  }, [position.x, position.y, width, menuHeight]);

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
      default:
        return null;
    }
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          width,
        }}
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
      </div>
    </Portal>
  );
};

export default ContextMenu;
