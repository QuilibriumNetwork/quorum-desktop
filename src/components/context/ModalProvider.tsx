import React, { createContext, useContext, ReactNode } from 'react';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { SpaceSettingsModal } from '../modals/SpaceSettingsModal';
import ChannelEditorModal from '../modals/ChannelEditorModal';
import GroupEditorModal from '../modals/GroupEditorModal';
import LeaveSpaceModal from '../modals/LeaveSpaceModal';
import KickUserModal from '../modals/KickUserModal';
import MuteUserModal from '../modals/MuteUserModal';
import NewDirectMessageModal from '../modals/NewDirectMessageModal';
import ConversationSettingsModal from '../modals/ConversationSettingsModal';
import FolderEditorModal from '../modals/FolderEditorModal';
import {
  useModalState,
  type ModalState,
  type MuteUserTarget,
  type KickUserTarget,
} from '../../hooks/business/ui/useModalState';
import { useUserMuting } from '../../hooks/business/user/useUserMuting';

// Context interface
interface ModalContextType {
  state: ModalState;
  openUserSettings: () => void;
  closeUserSettings: () => void;
  openSpaceEditor: (spaceId: string, initialTab?: 'account' | 'general' | 'invites' | 'roles') => void;
  closeSpaceEditor: () => void;
  openChannelEditor: (
    spaceId: string,
    groupName: string,
    channelId: string
  ) => void;
  closeChannelEditor: () => void;
  openGroupEditor: (spaceId: string, groupName?: string) => void;
  closeGroupEditor: () => void;
  openLeaveSpace: (spaceId: string) => void;
  closeLeaveSpace: () => void;
  openNewDirectMessage: () => void;
  closeNewDirectMessage: () => void;
  openKickUser: (target: KickUserTarget) => void;
  closeKickUser: () => void;
  openMuteUser: (target: MuteUserTarget) => void;
  closeMuteUser: () => void;
  openConversationSettings: (conversationId: string) => void;
  closeConversationSettings: () => void;
  openFolderEditor: (folderId?: string) => void;
  closeFolderEditor: () => void;
  // Legacy compatibility with existing useModalContext
  isNewDirectMessageOpen: boolean;
}

// Context
const ModalContext = createContext<ModalContextType | undefined>(undefined);

// Hook
export const useModals = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within ModalProvider');
  }
  return context;
};

// Legacy hook for backward compatibility
export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within ModalProvider');
  }
  return context;
};

// Provider props
interface ModalProviderProps {
  children: ReactNode;
  user?: any;
  setUser?: any;
}

// Provider component
export const ModalProvider: React.FC<ModalProviderProps> = ({
  children,
  setUser,
}) => {
  const modalState = useModalState();
  const { muteUser, unmuteUser } = useUserMuting();

  const contextValue: ModalContextType = {
    state: modalState.state,
    openUserSettings: modalState.openUserSettings,
    closeUserSettings: modalState.closeUserSettings,
    openSpaceEditor: modalState.openSpaceEditor,
    closeSpaceEditor: modalState.closeSpaceEditor,
    openChannelEditor: modalState.openChannelEditor,
    closeChannelEditor: modalState.closeChannelEditor,
    openGroupEditor: modalState.openGroupEditor,
    closeGroupEditor: modalState.closeGroupEditor,
    openLeaveSpace: modalState.openLeaveSpace,
    closeLeaveSpace: modalState.closeLeaveSpace,
    openNewDirectMessage: modalState.openNewDirectMessage,
    closeNewDirectMessage: modalState.closeNewDirectMessage,
    openKickUser: modalState.openKickUser,
    closeKickUser: modalState.closeKickUser,
    openMuteUser: modalState.openMuteUser,
    closeMuteUser: modalState.closeMuteUser,
    openConversationSettings: modalState.openConversationSettings,
    closeConversationSettings: modalState.closeConversationSettings,
    openFolderEditor: modalState.openFolderEditor,
    closeFolderEditor: modalState.closeFolderEditor,
    // Legacy compatibility
    isNewDirectMessageOpen: modalState.isNewDirectMessageOpen,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {/* Render modals at provider level with z-[9999] for proper stacking */}
      {modalState.state.userSettings.isOpen && (
        <UserSettingsModal
          setUser={setUser}
          dismiss={modalState.closeUserSettings}
        />
      )}

      {modalState.state.spaceEditor.isOpen &&
        modalState.state.spaceEditor.spaceId && (
          <SpaceSettingsModal
            spaceId={modalState.state.spaceEditor.spaceId}
            dismiss={modalState.closeSpaceEditor}
            initialTab={modalState.state.spaceEditor.initialTab}
          />
        )}

      {modalState.state.channelEditor.isOpen &&
        modalState.state.channelEditor.spaceId &&
        modalState.state.channelEditor.groupName && (
          <ChannelEditorModal
            spaceId={modalState.state.channelEditor.spaceId}
            groupName={modalState.state.channelEditor.groupName}
            channelId={modalState.state.channelEditor.channelId || ''}
            dismiss={modalState.closeChannelEditor}
          />
        )}

      {modalState.state.groupEditor.isOpen &&
        modalState.state.groupEditor.spaceId && (
          <GroupEditorModal
            spaceId={modalState.state.groupEditor.spaceId}
            groupName={modalState.state.groupEditor.groupName}
            dismiss={modalState.closeGroupEditor}
          />
        )}

      {modalState.state.leaveSpace.isOpen &&
        modalState.state.leaveSpace.spaceId && (
          <LeaveSpaceModal
            spaceId={modalState.state.leaveSpace.spaceId}
            visible={true}
            onClose={modalState.closeLeaveSpace}
          />
        )}

      {modalState.state.kickUser.isOpen &&
        modalState.state.kickUser.target && (
          <KickUserModal
            visible={true}
            onClose={modalState.closeKickUser}
            userName={modalState.state.kickUser.target.displayName}
            userIcon={modalState.state.kickUser.target.userIcon}
            userAddress={modalState.state.kickUser.target.address}
          />
        )}

      {modalState.state.muteUser.isOpen &&
        modalState.state.muteUser.target && (
          <MuteUserModal
            visible={true}
            onClose={modalState.closeMuteUser}
            onConfirm={(days: number) =>
              modalState.state.muteUser.target!.isUnmuting
                ? unmuteUser(modalState.state.muteUser.target!.address)
                : muteUser(modalState.state.muteUser.target!.address, days)
            }
            userName={modalState.state.muteUser.target.displayName}
            userIcon={modalState.state.muteUser.target.userIcon}
            userAddress={modalState.state.muteUser.target.address}
            isUnmuting={modalState.state.muteUser.target.isUnmuting}
          />
        )}

      {modalState.state.newDirectMessage.isOpen && (
        <NewDirectMessageModal
          visible={true}
          onClose={modalState.closeNewDirectMessage}
        />
      )}

      {modalState.state.conversationSettings.isOpen &&
        modalState.state.conversationSettings.conversationId && (
          <ConversationSettingsModal
            conversationId={
              modalState.state.conversationSettings.conversationId
            }
            visible={true}
            onClose={modalState.closeConversationSettings}
          />
        )}

      {modalState.state.folderEditor.isOpen && (
        <FolderEditorModal
          folderId={modalState.state.folderEditor.folderId}
          onClose={modalState.closeFolderEditor}
        />
      )}

      {children}
    </ModalContext.Provider>
  );
};
