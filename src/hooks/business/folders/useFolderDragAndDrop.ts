import { useCallback } from 'react';
import {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { useDragStateContext } from '../../../context/DragStateContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { NavItem, UserConfig } from '../../../db/messages';
import {
  createFolder,
  deriveSpaceIds,
  findFolderContainingSpace,
  canCreateFolder,
  canAddToFolder,
  migrateToItems,
  MAX_FOLDERS,
  MAX_SPACES_PER_FOLDER,
  DROP_ZONE_TOP_THRESHOLD,
  DROP_ZONE_BOTTOM_THRESHOLD,
  FOLDER_MODAL_OPEN_DELAY_MS,
} from '../../../utils/folderUtils';
import { isTouchDevice } from '../../../utils/platform';
import { showWarning } from '../../../utils/toast';
import { buildConfigKey } from '../../queries';

/**
 * Drag scenario types for folder operations
 */
type DragScenario =
  | 'SPACE_TO_SPACE' // Create folder from two standalone spaces
  | 'SPACE_TO_FOLDER' // Add standalone space to folder
  | 'SPACE_TO_FOLDER_SPACE' // Add standalone space to folder (dropped on space inside)
  | 'FOLDER_SPACE_TO_FOLDER' // Move space from folder A to folder B
  | 'FOLDER_SPACE_TO_SPACE' // Create new folder from folder space + standalone space
  | 'SPACE_OUT_OF_FOLDER' // Remove space from folder (becomes standalone)
  | 'FOLDER_REORDER' // Reorder folders in list
  | 'SPACE_REORDER_STANDALONE' // Reorder standalone spaces
  | 'SPACE_REORDER_IN_FOLDER' // Reorder spaces within a folder
  | 'INVALID'; // Invalid drop target

interface DragInfo {
  id: string;
  type: 'space' | 'folder';
  parentFolderId?: string; // If space is inside a folder
}

interface UseFolderDragAndDropProps {
  config: UserConfig | undefined;
  onFolderCreated?: (folderId: string) => void;
}

interface UseFolderDragAndDropReturn {
  handleDragStart: (e: DragStartEvent) => void;
  handleDragMove: (e: DragMoveEvent) => void;
  handleDragEnd: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}

/**
 * Parse drag data to understand what is being dragged
 */
function parseDragInfo(
  id: string,
  items: NavItem[]
): DragInfo | null {
  // Check if it's a folder
  const folder = items.find(
    (item) => item.type === 'folder' && item.id === id
  );
  if (folder) {
    return { id, type: 'folder' };
  }

  // Check if it's a standalone space
  const standaloneSpace = items.find(
    (item) => item.type === 'space' && item.id === id
  );
  if (standaloneSpace) {
    return { id, type: 'space' };
  }

  // Check if it's a space inside a folder
  const parentFolder = findFolderContainingSpace(items, id);
  if (parentFolder) {
    return { id, type: 'space', parentFolderId: parentFolder.id };
  }

  return null;
}

/**
 * Detect the drag scenario based on active and over elements and drop intent
 *
 * dropIntent:
 * - 'merge': dropped on center of target -> create folder / add to folder
 * - 'reorder-before' / 'reorder-after': dropped on edge -> reorder items
 */
function detectScenario(
  active: DragInfo,
  over: DragInfo,
  _items: NavItem[],
  dropIntent: 'merge' | 'reorder-before' | 'reorder-after' | null
): DragScenario {
  const activeInFolder = !!active.parentFolderId;
  const overInFolder = !!over.parentFolderId;
  const isMerge = dropIntent === 'merge';

  // Folder being dragged - always reorder (can't merge folders)
  if (active.type === 'folder') {
    if (over.type === 'folder' || over.type === 'space') {
      return 'FOLDER_REORDER';
    }
    return 'INVALID';
  }

  // Space being dragged
  if (active.type === 'space') {
    // From standalone space
    if (!activeInFolder) {
      // Dropping on a folder
      if (over.type === 'folder') {
        if (isMerge) {
          return 'SPACE_TO_FOLDER'; // Add to folder
        } else {
          return 'FOLDER_REORDER'; // Reorder around the folder
        }
      }
      // Dropping on another standalone space
      if (over.type === 'space' && !overInFolder) {
        if (isMerge) {
          return 'SPACE_TO_SPACE'; // Create folder from two spaces
        } else {
          return 'SPACE_REORDER_STANDALONE'; // Just reorder
        }
      }
      // Dropping on a space inside a folder
      if (over.type === 'space' && overInFolder) {
        if (isMerge) {
          return 'SPACE_TO_FOLDER_SPACE'; // Add to that folder
        } else {
          return 'SPACE_TO_FOLDER_SPACE'; // Insert at position in folder
        }
      }
      return 'SPACE_REORDER_STANDALONE';
    }

    // From inside a folder
    if (activeInFolder) {
      // Dropping on a different folder
      if (over.type === 'folder' && over.id !== active.parentFolderId) {
        if (isMerge) {
          return 'FOLDER_SPACE_TO_FOLDER'; // Move to that folder
        } else {
          return 'SPACE_OUT_OF_FOLDER'; // Remove from current folder, reorder at top level
        }
      }
      // Dropping on a standalone space
      if (over.type === 'space' && !overInFolder) {
        if (isMerge) {
          return 'FOLDER_SPACE_TO_SPACE'; // Create new folder with both
        } else {
          return 'SPACE_OUT_OF_FOLDER'; // Remove from folder and reorder
        }
      }
      // Dropping on a space inside a folder
      if (over.type === 'space' && overInFolder) {
        if (over.parentFolderId === active.parentFolderId) {
          return 'SPACE_REORDER_IN_FOLDER'; // Reorder within same folder
        }
        // Different folder
        if (isMerge) {
          return 'FOLDER_SPACE_TO_FOLDER'; // Move to that folder
        } else {
          return 'FOLDER_SPACE_TO_FOLDER'; // Insert at position in that folder
        }
      }
      // Dropping outside
      return 'SPACE_OUT_OF_FOLDER';
    }
  }

  return 'INVALID';
}

export const useFolderDragAndDrop = ({
  config,
  onFolderCreated,
}: UseFolderDragAndDropProps): UseFolderDragAndDropReturn => {
  const { setIsDragging, setActiveItem, dropTarget, setDropTarget } = useDragStateContext();
  const { saveConfig, keyset } = useMessageDB();
  const queryClient = useQueryClient();

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      setIsDragging(true);
      // Track the active drag item for DragOverlay rendering
      const data = e.active.data.current as { type: 'space' | 'folder' } | undefined;
      if (data) {
        setActiveItem({ id: String(e.active.id), type: data.type });
      }
    },
    [setIsDragging, setActiveItem]
  );

  const handleDragMove = useCallback(
    (e: DragMoveEvent) => {
      if (!e.over || !config) {
        setDropTarget(null);
        return;
      }

      const activeId = String(e.active.id);
      const overId = String(e.over.id);

      // Don't show drop target on self
      if (activeId === overId) {
        setDropTarget(null);
        return;
      }

      const overData = e.over.data.current as { type: 'space' | 'folder'; parentFolderId?: string } | undefined;
      if (!overData) {
        setDropTarget(null);
        return;
      }

      // Get the over element's bounding rect
      const overRect = e.over.rect;
      // Get the pointer position from the collision
      const pointerY = e.active.rect.current.translated?.top ?? 0;
      const activeHeight = e.active.rect.current.translated?.height ?? 48;
      const pointerCenter = pointerY + activeHeight / 2;

      // Calculate zones: top 25% = reorder-before, middle 50% = merge, bottom 25% = reorder-after
      const topThreshold = overRect.top + overRect.height * DROP_ZONE_TOP_THRESHOLD;
      const bottomThreshold = overRect.top + overRect.height * DROP_ZONE_BOTTOM_THRESHOLD;

      let intent: 'merge' | 'reorder-before' | 'reorder-after';

      if (pointerCenter < topThreshold) {
        intent = 'reorder-before';
      } else if (pointerCenter > bottomThreshold) {
        intent = 'reorder-after';
      } else {
        intent = 'merge';
      }

      setDropTarget({
        id: overId,
        type: overData.type,
        intent,
        parentFolderId: overData.parentFolderId,
      });
    },
    [config, setDropTarget]
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      // Capture drop intent before clearing state
      const currentDropIntent = dropTarget?.intent ?? null;

      setIsDragging(false);
      setActiveItem(null);
      setDropTarget(null);

      if (!e.over || !config || !keyset) {
        return;
      }

      const activeId = String(e.active.id);
      const overId = String(e.over.id);

      if (activeId === overId) {
        return;
      }

      // Ensure config has items format
      const workingConfig = migrateToItems(config);
      const items = workingConfig.items || [];

      // Parse what's being dragged and what it's over
      const activeInfo = parseDragInfo(activeId, items);
      const overInfo = parseDragInfo(overId, items);

      if (!activeInfo || !overInfo) {
        return;
      }

      const scenario = detectScenario(activeInfo, overInfo, items, currentDropIntent);

      let newItems: NavItem[] = items;
      let createdFolderId: string | null = null;

      switch (scenario) {
        case 'SPACE_TO_SPACE': {
          // Create folder from two standalone spaces
          if (!canCreateFolder(items)) {
            showWarning(`Maximum ${MAX_FOLDERS} folders reached`);
            return;
          }

          const activeIdx = items.findIndex(
            (i) => i.type === 'space' && i.id === activeId
          );
          const overIdx = items.findIndex(
            (i) => i.type === 'space' && i.id === overId
          );

          if (activeIdx === -1 || overIdx === -1) return;

          // Create folder with both spaces
          const folder = createFolder('Spaces', [overId, activeId]);
          createdFolderId = folder.id;

          // Remove both spaces from items, insert folder at over position
          const minIdx = Math.min(activeIdx, overIdx);
          newItems = items.filter(
            (i) => !(i.type === 'space' && (i.id === activeId || i.id === overId))
          );
          newItems.splice(minIdx, 0, folder);
          break;
        }

        case 'SPACE_TO_FOLDER':
        case 'SPACE_TO_FOLDER_SPACE': {
          // Add standalone space to folder
          const targetFolderId =
            scenario === 'SPACE_TO_FOLDER'
              ? overId
              : overInfo.parentFolderId;

          if (!targetFolderId) return;

          const folder = items.find(
            (i) => i.type === 'folder' && i.id === targetFolderId
          );
          if (!folder || folder.type !== 'folder') return;

          if (!canAddToFolder(folder)) {
            showWarning(`Maximum ${MAX_SPACES_PER_FOLDER} spaces per folder`);
            return;
          }

          // Remove space from standalone items
          newItems = items.filter(
            (i) => !(i.type === 'space' && i.id === activeId)
          );

          // Add space to folder
          newItems = newItems.map((item) => {
            if (item.type === 'folder' && item.id === targetFolderId) {
              return {
                ...item,
                spaceIds: [...item.spaceIds, activeId],
                modifiedDate: Date.now(),
              };
            }
            return item;
          });
          break;
        }

        case 'FOLDER_SPACE_TO_FOLDER': {
          // Move space from folder A to folder B
          const sourceFolderId = activeInfo.parentFolderId;
          const targetFolderId =
            overInfo.type === 'folder'
              ? overId
              : overInfo.parentFolderId;

          if (!sourceFolderId || !targetFolderId) return;
          if (sourceFolderId === targetFolderId) return;

          const targetFolder = items.find(
            (i) => i.type === 'folder' && i.id === targetFolderId
          );
          if (!targetFolder || targetFolder.type !== 'folder') return;

          if (!canAddToFolder(targetFolder)) {
            showWarning(`Maximum ${MAX_SPACES_PER_FOLDER} spaces per folder`);
            return;
          }

          const now = Date.now();
          newItems = items
            .map((item) => {
              if (item.type === 'folder' && item.id === sourceFolderId) {
                // Remove from source
                const newSpaceIds = item.spaceIds.filter((id) => id !== activeId);
                // If folder becomes empty, it will be removed below
                return {
                  ...item,
                  spaceIds: newSpaceIds,
                  modifiedDate: now,
                };
              }
              if (item.type === 'folder' && item.id === targetFolderId) {
                // Add to target
                return {
                  ...item,
                  spaceIds: [...item.spaceIds, activeId],
                  modifiedDate: now,
                };
              }
              return item;
            })
            // Remove empty folders
            .filter(
              (item) => !(item.type === 'folder' && item.spaceIds.length === 0)
            );
          break;
        }

        case 'FOLDER_SPACE_TO_SPACE': {
          // Create new folder from folder space + standalone space
          if (!canCreateFolder(items)) {
            showWarning(`Maximum ${MAX_FOLDERS} folders reached`);
            return;
          }

          const sourceFolderId = activeInfo.parentFolderId;
          if (!sourceFolderId) return;

          const overIdx = items.findIndex(
            (i) => i.type === 'space' && i.id === overId
          );
          if (overIdx === -1) return;

          // Create folder with both spaces
          const folder = createFolder('Spaces', [overId, activeId]);
          createdFolderId = folder.id;

          const now = Date.now();
          // Remove active from source folder, remove over from standalone
          newItems = items
            .map((item) => {
              if (item.type === 'folder' && item.id === sourceFolderId) {
                return {
                  ...item,
                  spaceIds: item.spaceIds.filter((id) => id !== activeId),
                  modifiedDate: now,
                };
              }
              return item;
            })
            .filter(
              (item) =>
                !(item.type === 'space' && item.id === overId) &&
                !(item.type === 'folder' && item.spaceIds.length === 0)
            );

          // Insert folder at over position
          newItems.splice(overIdx, 0, folder);
          break;
        }

        case 'SPACE_OUT_OF_FOLDER': {
          // Remove space from folder, becomes standalone
          const sourceFolderId = activeInfo.parentFolderId;
          if (!sourceFolderId) return;

          const folderIdx = items.findIndex(
            (i) => i.type === 'folder' && i.id === sourceFolderId
          );
          if (folderIdx === -1) return;

          const now = Date.now();
          // Remove from folder
          newItems = items
            .map((item) => {
              if (item.type === 'folder' && item.id === sourceFolderId) {
                return {
                  ...item,
                  spaceIds: item.spaceIds.filter((id) => id !== activeId),
                  modifiedDate: now,
                };
              }
              return item;
            })
            // Remove empty folders
            .filter(
              (item) => !(item.type === 'folder' && item.spaceIds.length === 0)
            );

          // Find where to insert the standalone space
          const overIdx = newItems.findIndex((i) => {
            if (i.type === 'space' && i.id === overId) return true;
            if (i.type === 'folder' && i.id === overId) return true;
            return false;
          });

          // Insert as standalone space after the over item
          const insertIdx = overIdx === -1 ? newItems.length : overIdx + 1;
          newItems.splice(insertIdx, 0, { type: 'space', id: activeId });
          break;
        }

        case 'FOLDER_REORDER': {
          // Simple reorder of top-level items
          const activeIdx = items.findIndex((i) => i.id === activeId);
          const overIdx = items.findIndex((i) => i.id === overId);

          if (activeIdx === -1 || overIdx === -1) return;

          newItems = arrayMove(items, activeIdx, overIdx);
          break;
        }

        case 'SPACE_REORDER_STANDALONE': {
          // Reorder standalone spaces
          const activeIdx = items.findIndex(
            (i) => i.type === 'space' && i.id === activeId
          );
          const overIdx = items.findIndex(
            (i) => i.type === 'space' && i.id === overId
          );

          if (activeIdx === -1 || overIdx === -1) return;

          newItems = arrayMove(items, activeIdx, overIdx);
          break;
        }

        case 'SPACE_REORDER_IN_FOLDER': {
          // Reorder within a folder
          const folderId = activeInfo.parentFolderId;
          if (!folderId) return;

          newItems = items.map((item) => {
            if (item.type === 'folder' && item.id === folderId) {
              const activeIdx = item.spaceIds.indexOf(activeId);
              const overIdx = item.spaceIds.indexOf(overId);
              if (activeIdx === -1 || overIdx === -1) return item;

              return {
                ...item,
                spaceIds: arrayMove(item.spaceIds, activeIdx, overIdx),
                modifiedDate: Date.now(),
              };
            }
            return item;
          });
          break;
        }

        case 'INVALID':
        default:
          return;
      }

      // Save the updated config
      const derivedSpaceIds = deriveSpaceIds(newItems);

      const newConfig: UserConfig = {
        ...workingConfig,
        items: newItems,
        spaceIds: derivedSpaceIds,
      };

      // Optimistically update React Query cache for instant UI feedback
      if (config.address) {
        queryClient.setQueryData(
          buildConfigKey({ userAddress: config.address }),
          newConfig
        );
      }

      // Persist to DB (and sync to server)
      saveConfig({ config: newConfig, keyset });

      // Open folder editor modal for newly created folders
      if (createdFolderId && onFolderCreated) {
        setTimeout(() => {
          onFolderCreated(createdFolderId!);
        }, FOLDER_MODAL_OPEN_DELAY_MS);
      }
    },
    [config, keyset, saveConfig, setIsDragging, setActiveItem, dropTarget, setDropTarget, queryClient, onFolderCreated]
  );

  // Configure sensors with touch support
  const isTouch = isTouchDevice();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isTouch
        ? { delay: 200, tolerance: 5 }
        : { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  return {
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    sensors,
  };
};
