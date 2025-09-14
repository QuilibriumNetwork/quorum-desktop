import React, { createContext, useContext, ReactNode } from 'react';
import UserSettingsModal from '../modals/UserSettingsModal';
import SpaceEditor from '../space/SpaceEditor';
import ChannelEditor from '../space/ChannelEditor';
import GroupEditor from '../space/GroupEditor';
import LeaveSpaceModal from '../modals/LeaveSpaceModal';
import KickUserModal from '../modals/KickUserModal';
import NewDirectMessageModal from '../modals/NewDirectMessageModal';
import ConversationSettingsModal from '../modals/ConversationSettingsModal';
import {
  useModalState,
  type ModalState,
} from '../../hooks/business/ui/useModalState';

// Context interface
interface ModalContextType {
  state: ModalState;
  openUserSettings: () => void;
  closeUserSettings: () => void;
  openSpaceEditor: (spaceId: string) => void;
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
  openKickUser: (kickUserAddress: string) => void;
  closeKickUser: () => void;
  openConversationSettings: (conversationId: string) => void;
  closeConversationSettings: () => void;
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
  user,
  setUser,
}) => {
  const modalState = useModalState();

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
    openConversationSettings: modalState.openConversationSettings,
    closeConversationSettings: modalState.closeConversationSettings,
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
          <SpaceEditor
            spaceId={modalState.state.spaceEditor.spaceId}
            dismiss={modalState.closeSpaceEditor}
          />
        )}

      {modalState.state.channelEditor.isOpen &&
        modalState.state.channelEditor.spaceId &&
        modalState.state.channelEditor.groupName && (
          <ChannelEditor
            spaceId={modalState.state.channelEditor.spaceId}
            groupName={modalState.state.channelEditor.groupName}
            channelId={modalState.state.channelEditor.channelId || ''}
            dismiss={modalState.closeChannelEditor}
          />
        )}

      {modalState.state.groupEditor.isOpen &&
        modalState.state.groupEditor.spaceId && (
          <GroupEditor
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
        modalState.state.kickUser.kickUserAddress && (
          <KickUserModal
            kickUserAddress={modalState.state.kickUser.kickUserAddress}
            visible={true}
            onClose={modalState.closeKickUser}
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

      {children}
    </ModalContext.Provider>
  );
};
