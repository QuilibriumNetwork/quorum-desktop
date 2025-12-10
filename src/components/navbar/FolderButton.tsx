import * as React from 'react';
import { Icon, Tooltip, useTheme } from '../primitives';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { useDragStateContext } from '../../context/DragStateContext';
import { formatMentionCount } from '../../utils/formatMentionCount';
import './Folder.scss';
import './SpaceIcon.scss';

interface FolderButtonProps {
  folder: NavItem & { type: 'folder' };
  hasUnread: boolean;
  unreadCount: number;
  mentionCount?: number;
  size?: 'small' | 'regular';
  isExpanded?: boolean;
}

const FolderButton: React.FC<FolderButtonProps> = ({
  folder,
  hasUnread,
  unreadCount: _unreadCount, // Reserved for future use
  mentionCount = 0,
  size = 'regular',
  isExpanded = false,
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

  // Hide indicators when folder is expanded (spaces inside show their own indicators)
  const showIndicators = !isExpanded;

  const buttonElement = (
    <div className="relative">
      {/* Toggle indicator - reuses SpaceIcon toggle styles */}
      {!isDragging && showIndicators && (
        <div
          className={`space-icon-toggle ${hasUnread ? 'space-icon-toggle--unread' : ''}`}
        />
      )}
      <div
        className={`folder-button ${sizeClass}`}
        style={{ backgroundColor }}
      >
        <Icon
          name={folder.icon || 'folder'}
          color="#ffffff"
          size={size === 'small' ? 'lg' : 'xl'}
        />
        {showIndicators && mentionCount > 0 && (
          <span className="folder-button-mention-bubble">
            {formatMentionCount(mentionCount, 9)}
          </span>
        )}
      </div>
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
