import { useCallback } from 'react';
import { useModalContext } from '../../../components/context/ModalProvider';

/**
 * Custom hook for managing group editor modal using global modal system
 * Uses global modal system for consistent positioning across all layouts (sidebar open/closed)
 */
export const useGroupEditor = (spaceId: string) => {
  const { openGroupEditor } = useModalContext();

  const openNewGroupEditor = useCallback(() => {
    openGroupEditor(spaceId);
  }, [openGroupEditor, spaceId]);

  const openEditGroupEditor = useCallback(
    (groupName: string) => {
      openGroupEditor(spaceId, groupName);
    },
    [openGroupEditor, spaceId]
  );

  return {
    openNewGroupEditor,
    openEditGroupEditor,
  };
};
