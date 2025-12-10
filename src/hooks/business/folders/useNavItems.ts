import { useState, useEffect, useMemo } from 'react';
import { Space } from '../../../api/quorumApi';
import { NavItem, UserConfig } from '../../../db/messages';
import { migrateToItems } from '../../../utils/folderUtils';

export interface MappedNavItem {
  item: NavItem;
  /** For folder items, the actual Space objects contained */
  spaces?: (Space & { id: string })[];
}

interface UseNavItemsReturn {
  /** Ordered list of nav items (spaces and folders) */
  navItems: MappedNavItem[];
  /** All spaces that are currently rendered (flat list for mention counts etc.) */
  allSpaces: (Space & { id: string })[];
  /** Set nav items (for drag-and-drop reordering) */
  setNavItems: React.Dispatch<React.SetStateAction<MappedNavItem[]>>;
}

/**
 * Hook to manage navigation items (spaces and folders) from user config
 * Handles migration from legacy spaceIds to items format
 */
export const useNavItems = (
  spaces: Space[],
  config: UserConfig | undefined
): UseNavItemsReturn => {
  const [navItems, setNavItems] = useState<MappedNavItem[]>([]);

  // Create a lookup map for spaces by ID
  const spaceMap = useMemo(() => {
    const map = new Map<string, Space>();
    for (const space of spaces) {
      map.set(space.spaceId, space);
    }
    return map;
  }, [spaces]);

  // Process config into nav items
  useEffect(() => {
    if (!config) {
      setNavItems([]);
      return;
    }

    // Migrate legacy config if needed
    const migratedConfig = migrateToItems(config);
    const items = migratedConfig.items || [];

    // Map items to MappedNavItem with resolved spaces
    const mapped: MappedNavItem[] = items
      .map((item): MappedNavItem | null => {
        if (item.type === 'space') {
          const space = spaceMap.get(item.id);
          if (!space) return null; // Space not found, skip
          return { item };
        } else if (item.type === 'folder') {
          // Resolve spaces in folder
          const folderSpaces = item.spaceIds
            .map((spaceId) => {
              const space = spaceMap.get(spaceId);
              if (!space) return null;
              return { ...space, id: space.spaceId };
            })
            .filter((s): s is Space & { id: string } => s !== null);

          // Skip empty folders (all spaces deleted)
          if (folderSpaces.length === 0) return null;

          return {
            item,
            spaces: folderSpaces,
          };
        }
        return null;
      })
      .filter((item): item is MappedNavItem => item !== null);

    setNavItems(mapped);
  }, [config, spaceMap]);

  // Compute flat list of all spaces for counts/queries
  const allSpaces = useMemo(() => {
    const result: (Space & { id: string })[] = [];
    const seen = new Set<string>();

    for (const navItem of navItems) {
      if (navItem.item.type === 'space') {
        const space = spaceMap.get(navItem.item.id);
        if (space && !seen.has(space.spaceId)) {
          result.push({ ...space, id: space.spaceId });
          seen.add(space.spaceId);
        }
      } else if (navItem.item.type === 'folder' && navItem.spaces) {
        for (const space of navItem.spaces) {
          if (!seen.has(space.spaceId)) {
            result.push(space);
            seen.add(space.spaceId);
          }
        }
      }
    }

    return result;
  }, [navItems, spaceMap]);

  return {
    navItems,
    allSpaces,
    setNavItems,
  };
};
