import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import FolderButton from './FolderButton';
import SpaceButton from './SpaceButton';
import { useDragStateContext } from '../../context/DragStateContext';
import { getFolderColorHex } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
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
  onSpaceContextMenu?: (spaceId: string, spaceName: string, iconUrl: string | undefined, e: React.MouseEvent, hasNotifications: boolean) => void;
  onEdit: () => void;
  spaceMentionCounts?: Record<string, number>;
}

const FolderContainer: React.FC<FolderContainerProps> = ({
  folder,
  spaces,
  isExpanded,
  onToggleExpand,
  onContextMenu,
  onSpaceContextMenu,
  onEdit,
  spaceMentionCounts = {},
}) => {
  const isTouch = isTouchDevice();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // Long press timer for touch devices to open editor
  // Uses touch events (not pointer events) to avoid conflicts with dnd-kit
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = React.useRef<{ x: number; y: number } | null>(null);
  const { threshold: MOVEMENT_THRESHOLD, delay: LONG_PRESS_DELAY } = TOUCH_INTERACTION_TYPES.DRAG_AND_DROP;

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTouch && e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        hapticMedium(); // Haptic feedback for long-press
        onEdit();
        clearLongPressTimer();
      }, LONG_PRESS_DELAY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long-press if user moves significantly (they want to drag)
    if (touchStartPos.current && longPressTimer.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > MOVEMENT_THRESHOLD) {
        clearLongPressTimer();
      }
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
  };

  // Cancel long-press timer when drag starts (drag activates at 150ms, long-press at 500ms)
  const { attributes, listeners, setNodeRef, isDragging } =
    useSortable({
      id: folder.id,
      data: { type: 'folder', targetId: folder.id },
    });

  React.useEffect(() => {
    if (isDragging) {
      clearLongPressTimer();
    }
  }, [isDragging]);

  // Calculate aggregate unread stats
  const hasUnread = spaces.some((s) => s.notifs && s.notifs > 0);
  const totalMentionCount = spaces.reduce(
    (sum, s) => sum + (spaceMentionCounts[s.spaceId] || 0),
    0
  );

  // Get drop target from context for visual feedback
  const { setIsDragging, dropTarget, activeItem } = useDragStateContext();

  // Check if this folder is the current drop target
  const isDropTarget = dropTarget?.id === folder.id;
  // Closed folders can wiggle ONLY when a space is being dragged (merge = add to folder)
  // Never wiggle when a folder is being dragged (folders can't merge)
  // Open folders never wiggle - spaces inside show their own indicators
  const isDraggingSpace = activeItem?.type === 'space';
  const showWiggle = isDropTarget && dropTarget.intent === 'merge' && !isExpanded && isDraggingSpace;
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
          touchAction: 'none',
        } as React.CSSProperties}
        {...attributes}
        {...listeners}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`folder-container ${isExpanded ? 'folder-container--expanded' : ''}`}
      >
        {isDragging ? (
          // Placeholder shown while dragging - reuse SpaceIcon placeholder styles
          <div className="space-icon-drag-placeholder" />
        ) : (
          <>
            {/* Folder button header - clickable */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
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
                    onContextMenu={onSpaceContextMenu ? (e) => {
                      const hasNotifications = (space.notifs || 0) > 0 || (spaceMentionCounts[space.spaceId] || 0) > 0;
                      onSpaceContextMenu(space.spaceId, space.spaceName, space.iconUrl, e, hasNotifications);
                    } : undefined}
                  />
                ))}
              </div>
            </div>
          </>
        )}
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
