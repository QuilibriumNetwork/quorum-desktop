import { useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Space } from '../../../api/quorumApi';
import { useDragStateContext } from '../../../context/DragStateContext';
import { useMessageDB } from '../../../components/context/useMessageDB';

interface UseSpaceDragAndDropProps {
  mappedSpaces: (Space & { id: string })[];
  setMappedSpaces: React.Dispatch<
    React.SetStateAction<(Space & { id: string })[]>
  >;
  config: { spaceIds: string[] };
}

interface UseSpaceDragAndDropReturn {
  handleDragStart: (e: DragStartEvent) => void;
  handleDragEnd: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}

export const useSpaceDragAndDrop = ({
  mappedSpaces,
  setMappedSpaces,
  config,
}: UseSpaceDragAndDropProps): UseSpaceDragAndDropReturn => {
  const { setIsDragging } = useDragStateContext();
  const { actionQueueService, keyset } = useMessageDB();

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      setIsDragging(true);
    },
    [setIsDragging]
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setIsDragging(false);

      if (!e.over) return;

      const activeIndex = mappedSpaces.findIndex(
        (space) => space.id === e.active.id
      );
      const overIndex = mappedSpaces.findIndex(
        (space) => space.id === e.over?.id
      );

      if (activeIndex === overIndex) return;

      const sortedSpaces = arrayMove(mappedSpaces, activeIndex, overIndex);
      setMappedSpaces(sortedSpaces);

      // Queue config save in background
      const newConfig = {
        ...config,
        spaceIds: sortedSpaces.map((space) => space.spaceId),
      };
      actionQueueService.enqueue(
        'save-user-config',
        { config: newConfig },
        `config:space-order` // Dedup key
      );
    },
    [mappedSpaces, setMappedSpaces, config, actionQueueService, setIsDragging]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return {
    handleDragStart,
    handleDragEnd,
    sensors,
  };
};
