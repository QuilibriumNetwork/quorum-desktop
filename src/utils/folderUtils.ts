import { NavItem, UserConfig } from '../db/messages';

/**
 * Folder utility functions for managing space folders in the navbar
 */

// Maximum limits for folders and spaces per folder
export const MAX_FOLDERS = 20;
export const MAX_SPACES_PER_FOLDER = 50;

/**
 * Extract all space IDs from items (flattens folders)
 * Used for backwards compatibility - derives spaceIds from items
 */
export const deriveSpaceIds = (items: NavItem[]): string[] => {
  const spaceIds: string[] = [];
  for (const item of items) {
    if (item.type === 'space') {
      spaceIds.push(item.id);
    } else if (item.type === 'folder') {
      spaceIds.push(...item.spaceIds);
    }
  }
  return spaceIds;
};

/**
 * Validate and clean items array
 * - Removes duplicate space IDs
 * - Enforces max folder count (20)
 * - Enforces max spaces per folder (50)
 * - Removes empty folders
 */
export const validateItems = (items: NavItem[]): NavItem[] => {
  const seen = new Set<string>();
  const validItems: NavItem[] = [];
  let folderCount = 0;

  for (const item of items) {
    if (item.type === 'space') {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        validItems.push(item);
      }
    } else if (item.type === 'folder') {
      if (folderCount >= MAX_FOLDERS) continue; // Max 20 folders

      // Dedupe spaces within folder
      const uniqueSpaces = item.spaceIds.filter(id => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, MAX_SPACES_PER_FOLDER); // Max 50 spaces per folder

      if (uniqueSpaces.length > 0) {
        validItems.push({ ...item, spaceIds: uniqueSpaces });
        folderCount++;
      }
      // Empty folders are auto-deleted (not added to validItems)
    }
  }

  return validItems;
};

/**
 * Migrate legacy spaceIds to items format
 * Only migrates if items doesn't already exist
 */
export const migrateToItems = (config: UserConfig): UserConfig => {
  if (config.items) return config; // Already migrated

  const items: NavItem[] = (config.spaceIds || []).map(id => ({
    type: 'space' as const,
    id,
  }));

  return {
    ...config,
    items,
    // Keep spaceIds for backwards compatibility
  };
};

/**
 * Create a new folder with given spaces
 */
export const createFolder = (
  name: string,
  spaceIds: string[],
  icon?: string,
  color?: string
): NavItem & { type: 'folder' } => {
  const now = Date.now();
  return {
    type: 'folder',
    id: crypto.randomUUID(),
    name,
    spaceIds,
    icon: icon as any,
    color: color as any,
    createdDate: now,
    modifiedDate: now,
  };
};

/**
 * Find the folder containing a specific space ID
 * Returns null if space is standalone or not found
 */
export const findFolderContainingSpace = (
  items: NavItem[],
  spaceId: string
): (NavItem & { type: 'folder' }) | null => {
  for (const item of items) {
    if (item.type === 'folder' && item.spaceIds.includes(spaceId)) {
      return item;
    }
  }
  return null;
};

/**
 * Check if adding a folder would exceed the limit
 */
export const canCreateFolder = (items: NavItem[]): boolean => {
  const folderCount = items.filter(item => item.type === 'folder').length;
  return folderCount < MAX_FOLDERS;
};

/**
 * Check if adding a space to a folder would exceed the limit
 */
export const canAddToFolder = (folder: NavItem & { type: 'folder' }): boolean => {
  return folder.spaceIds.length < MAX_SPACES_PER_FOLDER;
};
