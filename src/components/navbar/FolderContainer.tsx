import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import FolderButton from './FolderButton';
import SpaceButton from './SpaceButton';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { useDragStateContext } from '../../context/DragStateContext';
import { getIconColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import './Folder.scss';

interface Space {
  spaceId: string;
  defaultChannelId?: string;
  spaceName: string;
  iconUrl?: string;
  notifs?: number;
}

interface FolderContainerProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onEdit: () => void;
  spaceMentionCounts?: Record<string, number>;
}

const FolderContainer: React.FC<FolderContainerProps> = ({
  folder,
  spaces,
  isExpanded,
  onToggleExpand,
  onContextMenu,
  onEdit,
  spaceMentionCounts = {},
}) => {
  const isTouch = isTouchDevice();

  // Calculate aggregate unread stats
  const hasUnread = spaces.some((s) => s.notifs && s.notifs > 0);
  const totalMentionCount = spaces.reduce(
    (sum, s) => sum + (spaceMentionCounts[s.spaceId] || 0),
    0
  );

  // Drag and drop for the folder itself
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: folder.id,
      data: { type: 'folder', targetId: folder.id },
    });

  // Update global drag state
  const { setIsDragging } = useDragStateContext();
  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  // Drag visual feedback
  const dragStyle: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  // Long press for touch devices (opens editor modal)
  const longPressHandlers = useLongPressWithDefaults({
    delay: 500,
    threshold: 10,
    onLongPress: () => {
      if (isTouch) {
        onEdit();
      }
    },
    onTap: onToggleExpand,
  });

  // Get background color with 50% opacity for expanded state
  const backgroundColor = getIconColorHex(folder.color);
  const expandedBgColor = `${backgroundColor}80`; // 50% opacity

  // Handle right-click context menu (desktop only)
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isTouch && onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  };

  // Collapsed state - just show the folder button
  if (!isExpanded) {
    return (
      <div
        ref={setNodeRef}
        style={dragStyle}
        {...listeners}
        {...attributes}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
        className={longPressHandlers.className || ''}
      >
        <FolderButton
          folder={folder}
          hasUnread={hasUnread}
          unreadCount={spaces.reduce((sum, s) => sum + (s.notifs || 0), 0)}
          mentionCount={totalMentionCount}
        />
      </div>
    );
  }

  // Expanded state - show folder button + space icons
  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      className="folder-container"
    >
      {/* Folder button header - draggable and clickable */}
      <div
        {...listeners}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
        style={{
          ...longPressHandlers.style,
          backgroundColor: expandedBgColor,
          borderRadius: 'var(--rounded-lg)',
          padding: '4px',
        }}
        className={longPressHandlers.className || ''}
      >
        <FolderButton
          folder={folder}
          hasUnread={hasUnread}
          unreadCount={spaces.reduce((sum, s) => sum + (s.notifs || 0), 0)}
          mentionCount={totalMentionCount}
        />
      </div>

      {/* Space icons container */}
      <div
        className="folder-spaces"
        style={{
          backgroundColor: expandedBgColor,
          borderRadius: 'var(--rounded-lg)',
          padding: '8px 4px',
        }}
      >
        {spaces.map((space) => (
          <SpaceButton
            key={space.spaceId}
            space={space}
            size="small"
            mentionCount={spaceMentionCounts[space.spaceId]}
          />
        ))}
      </div>
    </div>
  );
};

export default FolderContainer;
