import { useState, useEffect } from 'react';
import { Space } from '../../../api/quorumApi';

interface UseSpaceOrderingReturn {
  mappedSpaces: (Space & { id: string })[];
  setMappedSpaces: React.Dispatch<React.SetStateAction<(Space & { id: string })[]>>;
}

export const useSpaceOrdering = (
  spaces: Space[], 
  config: { spaceIds: string[] }
): UseSpaceOrderingReturn => {
  const [mappedSpaces, setMappedSpaces] = useState<(Space & { id: string })[]>([]);

  useEffect(() => {
    const processSpaces = async () => {
      const spaceSet = config.spaceIds;
      let dedupeList: { [spaceId: string]: boolean } = {};
      
      // Deduplicate space IDs
      for (const id of spaceSet) {
        if (!dedupeList[id]) {
          dedupeList[id] = true;
        }
      }

      // Map ordered space IDs to actual space objects
      const orderedSpaces = Object.keys(dedupeList)
        .map((spaceId) => {
          const space = spaces.find((sp) => sp.spaceId === spaceId);
          if (!space) {
            return undefined;
          }
          return { ...space, id: space.spaceId };
        })
        .filter((space): space is Space & { id: string } => space !== undefined);
      
      setMappedSpaces(orderedSpaces);
    };

    processSpaces();
  }, [config.spaceIds, spaces]);

  return {
    mappedSpaces,
    setMappedSpaces,
  };
};