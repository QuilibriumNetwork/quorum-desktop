import * as React from 'react';
import { Icon, Tooltip, useTheme } from '../primitives';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { useDragStateContext } from '../../context/DragStateContext';
import { formatMentionCount } from '../../utils/formatMentionCount';
import './Folder.scss';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;
  unreadCount: number;
  mentionCount?: number;
  size?: 'small' | 'regular';
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread,
  unreadCount: _unreadCount, // Reserved for future use
  mentionCount = 0,
  size = 'regular',
}) => {
  const isTouch = isTouchDevice();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const backgroundColor = getFolderColorHex(folder.color, isDarkTheme);
  const sizeClass = size === 'small' ? 'folder-button--small' : '';

  // Check if we're in a drag context (will be undefined if not in DragStateProvider)
  let isDragging = false;
  try {
    const dragContext = useDragStateContext();
    isDragging = dragContext.isDragging;
  } catch {
    // Not in drag context, tooltips should work normally
    isDragging = false;
  }

  const buttonElement = (
    <div
      className={`folder-button ${sizeClass} ${hasUnread ? 'folder-button--has-unread' : ''}`}
      style={{ backgroundColor }}
    >
      <Icon
        name={folder.icon || 'folder'}
        color="#ffffff"
        size={size === 'small' ? 'lg' : 'xl'}
      />
      {mentionCount > 0 && (
        <span className="folder-button-mention-bubble">
          {formatMentionCount(mentionCount, 9)}
        </span>
      )}
    </div>
  );

  // Don't show tooltip on touch devices or while dragging
  if (isTouch || isDragging) {
    return buttonElement;
  }

  return (
    <Tooltip
      id={`folder-${folder.id}`}
      content={folder.name}
      place="right"
      highlighted={true}
      showOnTouch={false}
    >
      {buttonElement}
    </Tooltip>
  );
};

export default FolderButton;
