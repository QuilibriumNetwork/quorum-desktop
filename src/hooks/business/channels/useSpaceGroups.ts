import { useMemo } from 'react';

/**
 * Custom hook for space groups data processing and rendering logic
 * Handles groups iteration and data preparation for rendering
 */
export const useSpaceGroups = (space: any) => {
  const groups = useMemo(() => {
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