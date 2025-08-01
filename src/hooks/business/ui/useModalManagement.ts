import { useState, useCallback } from 'react';

interface UseModalManagementReturn {
  createSpaceVisible: boolean;
  showCreateSpaceModal: () => void;
  hideCreateSpaceModal: () => void;
}

export const useModalManagement = (): UseModalManagementReturn => {
  const [createSpaceVisible, setCreateSpaceVisible] = useState(false);

  const showCreateSpaceModal = useCallback(() => {
    setCreateSpaceVisible(true);
  }, []);

  const hideCreateSpaceModal = useCallback(() => {
    setCreateSpaceVisible(false);
  }, []);

  return {
    createSpaceVisible,
    showCreateSpaceModal,
    hideCreateSpaceModal,
  };
};