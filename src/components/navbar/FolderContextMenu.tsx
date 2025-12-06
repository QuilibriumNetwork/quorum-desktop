import React, { useRef, useEffect, useState } from 'react';
import { t } from '@lingui/core/macro';
import { Portal, Icon, Text, FlexRow } from '../primitives';
import { useClickOutside } from '../../hooks/useClickOutside';
import { NavItem } from '../../db/messages';
import './FolderContextMenu.scss';

// Fixed dimensions for viewport edge detection
const MENU_WIDTH = 180;
const MENU_HEIGHT = 100;
const PADDING = 8;

export interface FolderContextMenuProps {
  folder: NavItem & { type: 'folder' };
  position: { x: number; y: number };
  onClose: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
}

const OFFSET_RIGHT = 12; // $s-3 = 12px

function calculatePosition(clickX: number, clickY: number) {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const offsetClickX = clickX + OFFSET_RIGHT;
  const flipX = offsetClickX + MENU_WIDTH + PADDING > viewportW;
  const flipY = clickY + MENU_HEIGHT + PADDING > viewportH;

  return {
    x: flipX ? Math.max(PADDING, clickX - MENU_WIDTH) : offsetClickX,
    y: flipY ? Math.max(PADDING, clickY - MENU_HEIGHT) : clickY,
  };
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  folder,
  position,
  onClose,
  onOpenSettings,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(() =>
    calculatePosition(position.x, position.y)
  );

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

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [onClose]);

  // Recalculate position if it changes
  useEffect(() => {
    setAdjustedPosition(calculatePosition(position.x, position.y));
  }, [position.x, position.y]);

  const handleSettingsClick = () => {
    onOpenSettings();
    onClose();
  };

  const handleDeleteClick = () => {
    onDelete();
    onClose();
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        className="folder-context-menu"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {/* Folder name header */}
        <div className="folder-context-menu-header">
          <FlexRow align="center" gap={2}>
            <Icon name="folder" size="sm" />
            <Text weight="medium">{folder.name}</Text>
          </FlexRow>
        </div>

        <button
          className="folder-context-menu-item"
          onClick={handleSettingsClick}
        >
          <FlexRow align="center" gap={2}>
            <Icon name="settings" size="sm" />
            <Text size="sm">{t`Folder Settings`}</Text>
          </FlexRow>
        </button>

        <button
          className="folder-context-menu-item folder-context-menu-item--danger"
          onClick={handleDeleteClick}
        >
          <FlexRow align="center" gap={2}>
            <Icon name="trash" size="sm" />
            <Text size="sm">{t`Delete Folder`}</Text>
          </FlexRow>
        </button>
      </div>
    </Portal>
  );
};

export default FolderContextMenu;
