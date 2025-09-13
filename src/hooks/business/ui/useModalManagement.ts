import { useState, useCallback } from 'react';
import type { Message as MessageType } from '../../../api/quorumApi';

interface UseModalManagementReturn {
  createSpaceVisible: boolean;
  showCreateSpaceModal: () => void;
  hideCreateSpaceModal: () => void;
  confirmationModal: {
    visible: boolean;
    config: {
      title: string;
      message: string;
      preview?: React.ReactNode;
      confirmText?: string;
      cancelText?: string;
      variant?: 'danger' | 'warning' | 'info';
      protipAction?: string;
      onConfirm: () => void;
      onCancel: () => void;
    } | null;
  };
  showConfirmationModal: (config: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    protipAction?: string;
    onConfirm: () => void;
  }) => void;
  hideConfirmationModal: () => void;
}

export const useModalManagement = (): UseModalManagementReturn => {
  const [createSpaceVisible, setCreateSpaceVisible] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    visible: boolean;
    config: {
      title: string;
      message: string;
      preview?: React.ReactNode;
      confirmText?: string;
      cancelText?: string;
      variant?: 'danger' | 'warning' | 'info';
      protipAction?: string;
      onConfirm: () => void;
      onCancel: () => void;
    } | null;
  }>({
    visible: false,
    config: null,
  });

  const showCreateSpaceModal = useCallback(() => {
    setCreateSpaceVisible(true);
  }, []);

  const hideCreateSpaceModal = useCallback(() => {
    setCreateSpaceVisible(false);
  }, []);

  const showConfirmationModal = useCallback((config: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    protipAction?: string;
    onConfirm: () => void;
  }) => {
    setConfirmationModal({
      visible: true,
      config: {
        ...config,
        onCancel: () => {
          setConfirmationModal({ visible: false, config: null });
        },
      },
    });
  }, []);

  const hideConfirmationModal = useCallback(() => {
    setConfirmationModal({ visible: false, config: null });
  }, []);

  return {
    createSpaceVisible,
    showCreateSpaceModal,
    hideCreateSpaceModal,
    confirmationModal,
    showConfirmationModal,
    hideConfirmationModal,
  };
};
