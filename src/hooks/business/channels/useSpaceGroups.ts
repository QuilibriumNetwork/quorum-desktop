import { useMemo } from 'react';
import { Space, Group } from '../../../api/quorumApi';

/**
 * Custom hook for space groups data processing and rendering logic
 * Handles groups iteration and data preparation for rendering
 */
export const useSpaceGroups = (space: Space | undefined) => {
  const groups = useMemo<Group[]>(() => {
    return space?.groups || [];
  }, [space?.groups]);

  const hasGroups = groups.length > 0;
  const groupCount = groups.length;

  return {
    groups,
    hasGroups,
    groupCount,
  };
};
