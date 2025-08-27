import * as React from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import SpaceIcon from './SpaceIcon';
import './SpaceButton.scss';
import { useSortable } from '@dnd-kit/sortable';

type SpaceButtonProps = { space: any };

const SpaceButton: React.FunctionComponent<SpaceButtonProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: props.space.spaceId,
      data: { targetId: props.space.spaceId },
    });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    pointerEvents: isDragging ? 'none' : ('auto' as any),
  };

  let { spaceId } = useParams<{ spaceId: string }>();
  return (
    <Link
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="space-button"
      to={`/spaces/${props.space.spaceId}/${props.space.defaultChannelId || '00000000-0000-0000-0000-000000000000'}`}
    >
      <SpaceIcon
        notifs={props.space.notifs}
        selected={spaceId == props.space.spaceId}
        size="regular"
        iconUrl={props.space.iconUrl}
        spaceName={props.space.spaceName}
        spaceId={props.space.spaceId}
        highlightedTooltip={true}
      />
    </Link>
  );
};

export default SpaceButton;
