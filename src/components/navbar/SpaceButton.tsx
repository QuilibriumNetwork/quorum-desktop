import * as React from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
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
};

const SpaceButton: React.FunctionComponent<SpaceButtonProps> = ({ space }) => {
  const { spaceId: currentSpaceId } = useParams<{ spaceId: string }>();

  // Drag and drop functionality - platform-specific
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: space.spaceId,
      data: { targetId: space.spaceId },
    });

  // Update global drag state for tooltip coordination
  const { setIsDragging } = useDragStateContext();
  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  // Drag visual feedback
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    pointerEvents: isDragging ? 'none' : ('auto' as any),
  };

  // Navigation
  const isSelected = currentSpaceId === space.spaceId;
  const navigationUrl = `/spaces/${space.spaceId}/${space.defaultChannelId || '00000000-0000-0000-0000-000000000000'}`;

  return (
    <Link
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="block"
      to={navigationUrl}
    >
      <SpaceIcon
        notifs={Boolean(space.notifs && space.notifs > 0)}
        selected={isSelected}
        size="regular"
        iconUrl={space.iconUrl}
        spaceName={space.spaceName}
        spaceId={space.spaceId}
        highlightedTooltip={true}
      />
    </Link>
  );
};

export default SpaceButton;
