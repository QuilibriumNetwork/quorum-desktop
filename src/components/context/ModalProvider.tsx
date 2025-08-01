import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import UserSettingsModal from '../modals/UserSettingsModal';
import SpaceEditor from '../channel/SpaceEditor';
import ChannelEditor from '../channel/ChannelEditor';
import GroupEditor from '../channel/GroupEditor';
import LeaveSpaceModal from '../modals/LeaveSpaceModal';

// Modal state interface
interface ModalState {
  userSettings: {
    isOpen: boolean;
  };
  spaceEditor: {
    isOpen: boolean;
    spaceId?: string;
  };
  channelEditor: {
    isOpen: boolean;
    spaceId?: string;
    groupName?: string;
    channelId?: string;
  };
  groupEditor: {
    isOpen: boolean;
    spaceId?: string;
    groupName?: string;
  };
  leaveSpace: {
    isOpen: boolean;
    spaceId?: string;
  };
  newDirectMessage: {
    isOpen: boolean;
  };
}

// Modal actions
type ModalAction =
  | { type: 'OPEN_USER_SETTINGS' }
  | { type: 'CLOSE_USER_SETTINGS' }
  | { type: 'OPEN_SPACE_EDITOR'; spaceId: string }
  | { type: 'CLOSE_SPACE_EDITOR' }
  | { type: 'OPEN_CHANNEL_EDITOR'; spaceId: string; groupName: string; channelId: string }
  | { type: 'CLOSE_CHANNEL_EDITOR' }
  | { type: 'OPEN_GROUP_EDITOR'; spaceId: string; groupName?: string }
  | { type: 'CLOSE_GROUP_EDITOR' }
  | { type: 'OPEN_LEAVE_SPACE'; spaceId: string }
  | { type: 'CLOSE_LEAVE_SPACE' }
  | { type: 'OPEN_NEW_DIRECT_MESSAGE' }
  | { type: 'CLOSE_NEW_DIRECT_MESSAGE' };

// Initial state
const initialModalState: ModalState = {
  userSettings: { isOpen: false },
  spaceEditor: { isOpen: false },
  channelEditor: { isOpen: false },
  groupEditor: { isOpen: false },
  leaveSpace: { isOpen: false },
  newDirectMessage: { isOpen: false },
};

// Modal reducer
function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_USER_SETTINGS':
      return { ...state, userSettings: { isOpen: true } };
    case 'CLOSE_USER_SETTINGS':
      return { ...state, userSettings: { isOpen: false } };
    
    case 'OPEN_SPACE_EDITOR':
      return { ...state, spaceEditor: { isOpen: true, spaceId: action.spaceId } };
    case 'CLOSE_SPACE_EDITOR':
      return { ...state, spaceEditor: { isOpen: false } };
    
    case 'OPEN_CHANNEL_EDITOR':
      return {
        ...state,
        channelEditor: {
          isOpen: true,
          spaceId: action.spaceId,
          groupName: action.groupName,
          channelId: action.channelId,
        },
      };
    case 'CLOSE_CHANNEL_EDITOR':
      return { ...state, channelEditor: { isOpen: false } };
    
    case 'OPEN_GROUP_EDITOR':
      return {
        ...state,
        groupEditor: {
          isOpen: true,
          spaceId: action.spaceId,
          groupName: action.groupName,
        },
      };
    case 'CLOSE_GROUP_EDITOR':
      return { ...state, groupEditor: { isOpen: false } };
    
    case 'OPEN_LEAVE_SPACE':
      return { ...state, leaveSpace: { isOpen: true, spaceId: action.spaceId } };
    case 'CLOSE_LEAVE_SPACE':
      return { ...state, leaveSpace: { isOpen: false } };
    
    case 'OPEN_NEW_DIRECT_MESSAGE':
      return { ...state, newDirectMessage: { isOpen: true } };
    case 'CLOSE_NEW_DIRECT_MESSAGE':
      return { ...state, newDirectMessage: { isOpen: false } };
    
    default:
      return state;
  }
}

// Context interface
interface ModalContextType {
  state: ModalState;
  openUserSettings: () => void;
  closeUserSettings: () => void;
  openSpaceEditor: (spaceId: string) => void;
  closeSpaceEditor: () => void;
  openChannelEditor: (spaceId: string, groupName: string, channelId: string) => void;
  closeChannelEditor: () => void;
  openGroupEditor: (spaceId: string, groupName?: string) => void;
  closeGroupEditor: () => void;
  openLeaveSpace: (spaceId: string) => void;
  closeLeaveSpace: () => void;
  openNewDirectMessage: () => void;
  closeNewDirectMessage: () => void;
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
  const [state, dispatch] = useReducer(modalReducer, initialModalState);

  const contextValue: ModalContextType = {
    state,
    openUserSettings: () => dispatch({ type: 'OPEN_USER_SETTINGS' }),
    closeUserSettings: () => dispatch({ type: 'CLOSE_USER_SETTINGS' }),
    openSpaceEditor: (spaceId: string) =>
      dispatch({ type: 'OPEN_SPACE_EDITOR', spaceId }),
    closeSpaceEditor: () => dispatch({ type: 'CLOSE_SPACE_EDITOR' }),
    openChannelEditor: (spaceId: string, groupName: string, channelId: string) =>
      dispatch({ type: 'OPEN_CHANNEL_EDITOR', spaceId, groupName, channelId }),
    closeChannelEditor: () => dispatch({ type: 'CLOSE_CHANNEL_EDITOR' }),
    openGroupEditor: (spaceId: string, groupName?: string) =>
      dispatch({ type: 'OPEN_GROUP_EDITOR', spaceId, groupName }),
    closeGroupEditor: () => dispatch({ type: 'CLOSE_GROUP_EDITOR' }),
    openLeaveSpace: (spaceId: string) =>
      dispatch({ type: 'OPEN_LEAVE_SPACE', spaceId }),
    closeLeaveSpace: () => dispatch({ type: 'CLOSE_LEAVE_SPACE' }),
    openNewDirectMessage: () => dispatch({ type: 'OPEN_NEW_DIRECT_MESSAGE' }),
    closeNewDirectMessage: () => dispatch({ type: 'CLOSE_NEW_DIRECT_MESSAGE' }),
    // Legacy compatibility
    isNewDirectMessageOpen: state.newDirectMessage.isOpen,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {/* Render modals at provider level with z-[9999] for proper stacking */}
      {state.userSettings.isOpen && (
        <UserSettingsModal
          setUser={setUser}
          dismiss={contextValue.closeUserSettings}
        />
      )}

      {state.spaceEditor.isOpen && state.spaceEditor.spaceId && (
        <SpaceEditor
          spaceId={state.spaceEditor.spaceId}
          dismiss={contextValue.closeSpaceEditor}
        />
      )}

      {state.channelEditor.isOpen && 
       state.channelEditor.spaceId && 
       state.channelEditor.groupName && (
        <ChannelEditor
          spaceId={state.channelEditor.spaceId}
          groupName={state.channelEditor.groupName}
          channelId={state.channelEditor.channelId || ''}
          dismiss={contextValue.closeChannelEditor}
        />
      )}

      {state.groupEditor.isOpen && state.groupEditor.spaceId && (
        <GroupEditor
          spaceId={state.groupEditor.spaceId}
          groupName={state.groupEditor.groupName}
          dismiss={contextValue.closeGroupEditor}
        />
      )}

      {state.leaveSpace.isOpen && state.leaveSpace.spaceId && (
        <LeaveSpaceModal
          spaceId={state.leaveSpace.spaceId}
          visible={true}
          onClose={contextValue.closeLeaveSpace}
        />
      )}

      {children}
    </ModalContext.Provider>
  );
};