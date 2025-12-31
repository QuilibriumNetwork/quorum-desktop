import { logger } from '@quilibrium/quorum-shared';
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'folderStates';

interface FolderState {
  collapsed: boolean;
}

type FolderStates = Record<string, FolderState>;

/**
 * Hook to manage folder expanded/collapsed states
 * States are stored in localStorage (device-local, not synced)
 */
export const useFolderStates = () => {
  const [folderStates, setFolderStates] = useState<FolderStates>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFolderStates(JSON.parse(stored));
      }
    } catch (e) {
      logger.warn('Failed to load folder states from localStorage:', e);
    }
  }, []);

  // Save to localStorage when states change
  const saveFolderStates = useCallback((states: FolderStates) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
      logger.warn('Failed to save folder states to localStorage:', e);
    }
  }, []);

  // Check if a folder is expanded (default: collapsed)
  const isExpanded = useCallback(
    (folderId: string): boolean => {
      return folderStates[folderId]?.collapsed === false;
    },
    [folderStates]
  );

  // Toggle folder expanded/collapsed state
  const toggleFolder = useCallback(
    (folderId: string) => {
      setFolderStates((prev) => {
        const current = prev[folderId]?.collapsed ?? true; // Default collapsed
        const newStates = {
          ...prev,
          [folderId]: { collapsed: !current },
        };
        saveFolderStates(newStates);
        return newStates;
      });
    },
    [saveFolderStates]
  );

  // Set folder state explicitly
  const setFolderState = useCallback(
    (folderId: string, collapsed: boolean) => {
      setFolderStates((prev) => {
        const newStates = {
          ...prev,
          [folderId]: { collapsed },
        };
        saveFolderStates(newStates);
        return newStates;
      });
    },
    [saveFolderStates]
  );

  // Clean up states for deleted folders
  const cleanupDeletedFolders = useCallback(
    (existingFolderIds: string[]) => {
      setFolderStates((prev) => {
        const existingSet = new Set(existingFolderIds);
        const newStates: FolderStates = {};
        for (const [folderId, state] of Object.entries(prev)) {
          if (existingSet.has(folderId)) {
            newStates[folderId] = state;
          }
        }
        if (Object.keys(newStates).length !== Object.keys(prev).length) {
          saveFolderStates(newStates);
        }
        return newStates;
      });
    },
    [saveFolderStates]
  );

  return {
    isExpanded,
    toggleFolder,
    setFolderState,
    cleanupDeletedFolders,
  };
};
