import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import FolderButton from './FolderButton';
import SpaceButton from './SpaceButton';
import { useDragStateContext } from '../../context/DragStateContext';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { useTheme } from '../primitives';
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
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // Long press timer for touch devices to open editor
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = () => {
    if (isTouch) {
      longPressTimer.current = setTimeout(() => {
        onEdit();
      }, 500);
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Calculate aggregate unread stats
  const hasUnread = spaces.some((s) => s.notifs && s.notifs > 0);
  const totalMentionCount = spaces.reduce(
    (sum, s) => sum + (spaceMentionCounts[s.spaceId] || 0),
    0
  );

  // Drag and drop for the folder itself
  const { attributes, listeners, setNodeRef, isDragging } =
    useSortable({
      id: folder.id,
      data: { type: 'folder', targetId: folder.id },
    });

  // Get drop target from context for visual feedback
  const { setIsDragging, dropTarget } = useDragStateContext();

  // Check if this folder is the current drop target
  const isDropTarget = dropTarget?.id === folder.id;
  // Closed folders can wiggle (merge = add to folder)
  // Open folders never wiggle - spaces inside show their own indicators
  const showWiggle = isDropTarget && dropTarget.intent === 'merge' && !isExpanded;
  const showDropBefore = isDropTarget && (dropTarget.intent === 'reorder-before' || (dropTarget.intent === 'merge' && isExpanded));
  const showDropAfter = isDropTarget && dropTarget.intent === 'reorder-after';

  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  // Drag visual feedback - show placeholder or actual content
  const dragStyle: React.CSSProperties = {
    // Don't apply transform - let DragOverlay handle the floating item
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  // Handle click to toggle expand/collapse
  const handleClick = () => {
    onToggleExpand();
  };

  // Handle right-click context menu (desktop only)
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isTouch && onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  };

  // Get folder color for CSS variable
  const folderColor = getFolderColorHex(folder.color, isDarkTheme);

  // Always render full structure, CSS handles expand/collapse animation
  return (
    <>
      {/* Drop indicator - shown above this folder when reordering */}
      {showDropBefore && (
        <div className="flex justify-center py-1">
          <div className="w-12 h-1 bg-accent-500 rounded-full" />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          '--folder-color': folderColor,
        } as React.CSSProperties}
        {...attributes}
        className={`folder-container ${isExpanded ? 'folder-container--expanded' : ''}`}
      >
        {/* Folder button header - draggable and clickable */}
        <div
          {...listeners}
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleExpand();
            }
          }}
          className="folder-header cursor-pointer"
        >
          <FolderButton
            folder={folder}
            hasUnread={hasUnread}
            mentionCount={totalMentionCount}
            isExpanded={isExpanded}
            showWiggle={showWiggle}
          />
        </div>

        {/* Space icons container - uses CSS grid for smooth height animation */}
        <div className="folder-spaces-wrapper">
          <div className="folder-spaces">
            {spaces.map((space) => (
              <SpaceButton
                key={space.spaceId}
                space={space}
                size="regular"
                mentionCount={spaceMentionCounts[space.spaceId]}
                parentFolderId={folder.id}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Drop indicator - shown below this folder when reordering */}
      {showDropAfter && (
        <div className="flex justify-center py-1">
          <div className="w-12 h-1 bg-accent-500 rounded-full" />
        </div>
      )}
    </>
  );
};

export default FolderContainer;
