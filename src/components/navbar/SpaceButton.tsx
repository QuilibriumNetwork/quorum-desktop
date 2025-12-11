import * as React from 'react';
import { useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';
import SpaceIcon from './SpaceIcon';
import { useSortable } from '@dnd-kit/sortable';
import { useDragStateContext } from '../../context/DragStateContext';

interface Space {
  spaceId: string;
  defaultChannelId?: string;
  spaceName: string;
  iconUrl?: string;
  notifs?: number;
}

type SpaceButtonProps = {
  space: Space;
  mentionCount?: number;
  size?: 'small' | 'regular';
  parentFolderId?: string; // If this space is inside a folder
};

const SpaceButton: React.FunctionComponent<SpaceButtonProps> = ({ space, mentionCount, size = 'regular', parentFolderId }) => {
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId: string }>();

  // Drag and drop functionality - platform-specific
  const { attributes, listeners, setNodeRef, isDragging } =
    useSortable({
      id: space.spaceId,
      data: { type: 'space', targetId: space.spaceId, parentFolderId },
    });

  // Get drop target from context for visual feedback
  const { setIsDragging, dropTarget, activeItem } = useDragStateContext();

  // Check if this space is the current drop target
  const isDropTarget = dropTarget?.id === space.spaceId;
  // Spaces inside folders never wiggle - only show reorder indicators
  // Standalone spaces can wiggle ONLY when another space is dragged (merge = create folder)
  // Never wiggle when a folder is being dragged (folders can't merge with spaces)
  const isInsideFolder = !!parentFolderId;
  const isDraggingSpace = activeItem?.type === 'space';
  const showWiggle = isDropTarget && dropTarget.intent === 'merge' && !isInsideFolder && isDraggingSpace;
  const showDropBefore = isDropTarget && (dropTarget.intent === 'reorder-before' || (dropTarget.intent === 'merge' && isInsideFolder));
  const showDropAfter = isDropTarget && dropTarget.intent === 'reorder-after';

  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  // Drag visual feedback - show placeholder or actual content
  const style: React.CSSProperties = {
    // Don't apply transform - let DragOverlay handle the floating item
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  // Navigation
  const isSelected = currentSpaceId === space.spaceId;
  const navigationUrl = `/spaces/${space.spaceId}/${space.defaultChannelId || '00000000-0000-0000-0000-000000000000'}`;

  return (
    <>
      {/* Drop indicator - shown above this item when reordering */}
      {showDropBefore && (
        <div className="flex justify-center py-1">
          <div className="w-12 h-1 bg-accent-500 rounded-full" />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        role="link"
        tabIndex={0}
        className={`block cursor-pointer ${showWiggle ? 'drop-target-wiggle' : ''}`}
        onClick={() => navigate(navigationUrl)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(navigationUrl);
          }
        }}
      >
        {isDragging ? (
          // Placeholder shown while dragging
          <div className={`space-icon-drag-placeholder space-icon-${size}`} />
        ) : (
          <SpaceIcon
            notifs={Boolean(space.notifs && space.notifs > 0)}
            selected={isSelected}
            size={size}
            iconUrl={space.iconUrl}
            spaceName={space.spaceName}
            spaceId={space.spaceId}
            highlightedTooltip={true}
            mentionCount={mentionCount}
          />
        )}
      </div>
      {/* Drop indicator - shown below this item when reordering */}
      {showDropAfter && (
        <div className="flex justify-center py-1">
          <div className="w-12 h-1 bg-accent-500 rounded-full" />
        </div>
      )}
    </>
  );
};

export default SpaceButton;
