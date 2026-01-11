import { useState, useCallback } from 'react';
import type { Message as MessageType, Reaction } from '../../../api/quorumApi';
import type { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import type { MemberInfo } from '../../../components/modals/ReactionsModal';

interface UseModalManagementReturn {
  addSpaceVisible: boolean;
  showAddSpaceModal: () => void;
  hideAddSpaceModal: () => void;
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
  imageModal: {
    visible: boolean;
    imageUrl: string | null;
  };
  showImageModal: (imageUrl: string) => void;
  hideImageModal: () => void;
  editHistoryModal: {
    visible: boolean;
    message: MessageType | null;
  };
  showEditHistoryModal: (message: MessageType) => void;
  hideEditHistoryModal: () => void;
  reactionsModal: {
    visible: boolean;
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  };
  showReactionsModal: (config: {
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  }) => void;
  hideReactionsModal: () => void;
}

export const useModalManagement = (): UseModalManagementReturn => {
  const [addSpaceVisible, setAddSpaceVisible] = useState(false);
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
  const [imageModal, setImageModal] = useState<{
    visible: boolean;
    imageUrl: string | null;
  }>({
    visible: false,
    imageUrl: null,
  });
  const [editHistoryModal, setEditHistoryModal] = useState<{
    visible: boolean;
    message: MessageType | null;
  }>({
    visible: false,
    message: null,
  });
  const [reactionsModal, setReactionsModal] = useState<{
    visible: boolean;
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  }>({
    visible: false,
    reactions: [],
    customEmojis: [],
    members: {},
  });

  const showAddSpaceModal = useCallback(() => {
    setAddSpaceVisible(true);
  }, []);

  const hideAddSpaceModal = useCallback(() => {
    setAddSpaceVisible(false);
  }, []);

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

  const showImageModal = useCallback((imageUrl: string) => {
    setImageModal({ visible: true, imageUrl });
  }, []);

  const hideImageModal = useCallback(() => {
    setImageModal({ visible: false, imageUrl: null });
  }, []);

  const showEditHistoryModal = useCallback((message: MessageType) => {
    setEditHistoryModal({ visible: true, message });
  }, []);

  const hideEditHistoryModal = useCallback(() => {
    setEditHistoryModal({ visible: false, message: null });
  }, []);

  const showReactionsModal = useCallback((config: {
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  }) => {
    setReactionsModal({
      visible: true,
      ...config,
    });
  }, []);

  const hideReactionsModal = useCallback(() => {
    setReactionsModal({
      visible: false,
      reactions: [],
      customEmojis: [],
      members: {},
    });
  }, []);

  return {
    addSpaceVisible,
    showAddSpaceModal,
    hideAddSpaceModal,
    createSpaceVisible,
    showCreateSpaceModal,
    hideCreateSpaceModal,
    confirmationModal,
    showConfirmationModal,
    hideConfirmationModal,
    imageModal,
    showImageModal,
    hideImageModal,
    editHistoryModal,
    showEditHistoryModal,
    hideEditHistoryModal,
    reactionsModal,
    showReactionsModal,
    hideReactionsModal,
  };
};
