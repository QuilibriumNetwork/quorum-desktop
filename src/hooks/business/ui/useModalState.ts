import { useReducer, useCallback } from 'react';

// Mute target interface
export interface MuteUserTarget {
  address: string;
  displayName: string;
  userIcon?: string;
  isUnmuting?: boolean;
}

// Kick target interface
export interface KickUserTarget {
  address: string;
  displayName: string;
  userIcon?: string;
}

// Block target interface (personal viewer-side block — per space)
export interface BlockUserTarget {
  address: string;
  displayName: string;
  userIcon?: string;
  spaceId: string;
  isUnblocking?: boolean;
}

// Modal state interface
export interface ModalState {
  userSettings: {
    isOpen: boolean;
  };
  spaceEditor: {
    isOpen: boolean;
    spaceId?: string;
    initialTab?: 'account' | 'general' | 'invites' | 'roles';
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
  kickUser: {
    isOpen: boolean;
    target?: KickUserTarget;
  };
  muteUser: {
    isOpen: boolean;
    target?: MuteUserTarget;
  };
  blockUser: {
    isOpen: boolean;
    target?: BlockUserTarget;
  };
  conversationSettings: {
    isOpen: boolean;
    conversationId?: string;
  };
  folderEditor: {
    isOpen: boolean;
    folderId?: string;
  };
  notifications: {
    isOpen: boolean;
  };
}

// Modal actions
type ModalAction =
  | { type: 'OPEN_USER_SETTINGS' }
  | { type: 'CLOSE_USER_SETTINGS' }
  | { type: 'OPEN_SPACE_EDITOR'; spaceId: string; initialTab?: 'account' | 'general' | 'invites' | 'roles' }
  | { type: 'CLOSE_SPACE_EDITOR' }
  | {
      type: 'OPEN_CHANNEL_EDITOR';
      spaceId: string;
      groupName: string;
      channelId: string;
    }
  | { type: 'CLOSE_CHANNEL_EDITOR' }
  | { type: 'OPEN_GROUP_EDITOR'; spaceId: string; groupName?: string }
  | { type: 'CLOSE_GROUP_EDITOR' }
  | { type: 'OPEN_LEAVE_SPACE'; spaceId: string }
  | { type: 'CLOSE_LEAVE_SPACE' }
  | { type: 'OPEN_NEW_DIRECT_MESSAGE' }
  | { type: 'CLOSE_NEW_DIRECT_MESSAGE' }
  | { type: 'OPEN_KICK_USER'; target: KickUserTarget }
  | { type: 'CLOSE_KICK_USER' }
  | { type: 'OPEN_MUTE_USER'; target: MuteUserTarget }
  | { type: 'CLOSE_MUTE_USER' }
  | { type: 'OPEN_BLOCK_USER'; target: BlockUserTarget }
  | { type: 'CLOSE_BLOCK_USER' }
  | { type: 'OPEN_CONVERSATION_SETTINGS'; conversationId: string }
  | { type: 'CLOSE_CONVERSATION_SETTINGS' }
  | { type: 'OPEN_FOLDER_EDITOR'; folderId?: string }
  | { type: 'CLOSE_FOLDER_EDITOR' }
  | { type: 'OPEN_NOTIFICATIONS' }
  | { type: 'CLOSE_NOTIFICATIONS' };

// Initial state
const initialModalState: ModalState = {
  userSettings: { isOpen: false },
  spaceEditor: { isOpen: false },
  channelEditor: { isOpen: false },
  groupEditor: { isOpen: false },
  leaveSpace: { isOpen: false },
  newDirectMessage: { isOpen: false },
  kickUser: { isOpen: false },
  muteUser: { isOpen: false },
  blockUser: { isOpen: false },
  conversationSettings: { isOpen: false },
  folderEditor: { isOpen: false },
  notifications: { isOpen: false },
};

// Modal reducer
function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_USER_SETTINGS':
      return { ...state, userSettings: { isOpen: true } };
    case 'CLOSE_USER_SETTINGS':
      return { ...state, userSettings: { isOpen: false } };

    case 'OPEN_SPACE_EDITOR':
      return {
        ...state,
        spaceEditor: { isOpen: true, spaceId: action.spaceId, initialTab: action.initialTab },
      };
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
      return {
        ...state,
        leaveSpace: { isOpen: true, spaceId: action.spaceId },
      };
    case 'CLOSE_LEAVE_SPACE':
      return { ...state, leaveSpace: { isOpen: false } };

    case 'OPEN_NEW_DIRECT_MESSAGE':
      return { ...state, newDirectMessage: { isOpen: true } };
    case 'CLOSE_NEW_DIRECT_MESSAGE':
      return { ...state, newDirectMessage: { isOpen: false } };

    case 'OPEN_KICK_USER':
      return {
        ...state,
        kickUser: { isOpen: true, target: action.target },
      };
    case 'CLOSE_KICK_USER':
      return { ...state, kickUser: { isOpen: false } };

    case 'OPEN_MUTE_USER':
      return {
        ...state,
        muteUser: { isOpen: true, target: action.target },
      };
    case 'CLOSE_MUTE_USER':
      return { ...state, muteUser: { isOpen: false } };

    case 'OPEN_BLOCK_USER':
      return {
        ...state,
        blockUser: { isOpen: true, target: action.target },
      };
    case 'CLOSE_BLOCK_USER':
      return { ...state, blockUser: { isOpen: false } };

    case 'OPEN_CONVERSATION_SETTINGS':
      return {
        ...state,
        conversationSettings: {
          isOpen: true,
          conversationId: action.conversationId,
        },
      };
    case 'CLOSE_CONVERSATION_SETTINGS':
      return { ...state, conversationSettings: { isOpen: false } };

    case 'OPEN_FOLDER_EDITOR':
      return {
        ...state,
        folderEditor: { isOpen: true, folderId: action.folderId },
      };
    case 'CLOSE_FOLDER_EDITOR':
      return { ...state, folderEditor: { isOpen: false } };

    case 'OPEN_NOTIFICATIONS':
      return { ...state, notifications: { isOpen: true } };
    case 'CLOSE_NOTIFICATIONS':
      return { ...state, notifications: { isOpen: false } };

    default:
      return state;
  }
}

/**
 * Hook for managing modal state using reducer pattern
 * Handles all modal opening/closing logic and state coordination
 * Cross-platform compatible business logic
 */
export const useModalState = () => {
  const [state, dispatch] = useReducer(modalReducer, initialModalState);

  // User Settings Modal
  const openUserSettings = useCallback(() => {
    dispatch({ type: 'OPEN_USER_SETTINGS' });
  }, []);

  const closeUserSettings = useCallback(() => {
    dispatch({ type: 'CLOSE_USER_SETTINGS' });
  }, []);

  // Space Editor Modal
  const openSpaceEditor = useCallback((spaceId: string, initialTab?: 'account' | 'general' | 'invites' | 'roles') => {
    dispatch({ type: 'OPEN_SPACE_EDITOR', spaceId, initialTab });
  }, []);

  const closeSpaceEditor = useCallback(() => {
    dispatch({ type: 'CLOSE_SPACE_EDITOR' });
  }, []);

  // Channel Editor Modal
  const openChannelEditor = useCallback(
    (spaceId: string, groupName: string, channelId: string) => {
      dispatch({ type: 'OPEN_CHANNEL_EDITOR', spaceId, groupName, channelId });
    },
    []
  );

  const closeChannelEditor = useCallback(() => {
    dispatch({ type: 'CLOSE_CHANNEL_EDITOR' });
  }, []);

  // Group Editor Modal
  const openGroupEditor = useCallback((spaceId: string, groupName?: string) => {
    dispatch({ type: 'OPEN_GROUP_EDITOR', spaceId, groupName });
  }, []);

  const closeGroupEditor = useCallback(() => {
    dispatch({ type: 'CLOSE_GROUP_EDITOR' });
  }, []);

  // Leave Space Modal
  const openLeaveSpace = useCallback((spaceId: string) => {
    dispatch({ type: 'OPEN_LEAVE_SPACE', spaceId });
  }, []);

  const closeLeaveSpace = useCallback(() => {
    dispatch({ type: 'CLOSE_LEAVE_SPACE' });
  }, []);

  // New Direct Message Modal
  const openNewDirectMessage = useCallback(() => {
    dispatch({ type: 'OPEN_NEW_DIRECT_MESSAGE' });
  }, []);

  const closeNewDirectMessage = useCallback(() => {
    dispatch({ type: 'CLOSE_NEW_DIRECT_MESSAGE' });
  }, []);

  // Kick User Modal
  const openKickUser = useCallback((target: KickUserTarget) => {
    dispatch({ type: 'OPEN_KICK_USER', target });
  }, []);

  const closeKickUser = useCallback(() => {
    dispatch({ type: 'CLOSE_KICK_USER' });
  }, []);

  // Mute User Modal
  const openMuteUser = useCallback((target: MuteUserTarget) => {
    dispatch({ type: 'OPEN_MUTE_USER', target });
  }, []);

  const closeMuteUser = useCallback(() => {
    dispatch({ type: 'CLOSE_MUTE_USER' });
  }, []);

  // Block User Modal
  const openBlockUser = useCallback((target: BlockUserTarget) => {
    dispatch({ type: 'OPEN_BLOCK_USER', target });
  }, []);

  const closeBlockUser = useCallback(() => {
    dispatch({ type: 'CLOSE_BLOCK_USER' });
  }, []);

  // Conversation Settings Modal
  const openConversationSettings = useCallback((conversationId: string) => {
    dispatch({ type: 'OPEN_CONVERSATION_SETTINGS', conversationId });
  }, []);

  const closeConversationSettings = useCallback(() => {
    dispatch({ type: 'CLOSE_CONVERSATION_SETTINGS' });
  }, []);

  // Folder Editor Modal
  const openFolderEditor = useCallback((folderId?: string) => {
    dispatch({ type: 'OPEN_FOLDER_EDITOR', folderId });
  }, []);

  const closeFolderEditor = useCallback(() => {
    dispatch({ type: 'CLOSE_FOLDER_EDITOR' });
  }, []);

  // Global Notifications Panel
  const openNotifications = useCallback(() => {
    dispatch({ type: 'OPEN_NOTIFICATIONS' });
  }, []);

  const closeNotifications = useCallback(() => {
    dispatch({ type: 'CLOSE_NOTIFICATIONS' });
  }, []);

  return {
    // State
    state,

    // User Settings
    openUserSettings,
    closeUserSettings,

    // Space Editor
    openSpaceEditor,
    closeSpaceEditor,

    // Channel Editor
    openChannelEditor,
    closeChannelEditor,

    // Group Editor
    openGroupEditor,
    closeGroupEditor,

    // Leave Space
    openLeaveSpace,
    closeLeaveSpace,

    // New Direct Message
    openNewDirectMessage,
    closeNewDirectMessage,

    // Kick User
    openKickUser,
    closeKickUser,

    // Mute User
    openMuteUser,
    closeMuteUser,

    // Block User
    openBlockUser,
    closeBlockUser,

    // Conversation Settings
    openConversationSettings,
    closeConversationSettings,

    // Folder Editor
    openFolderEditor,
    closeFolderEditor,

    // Global Notifications Panel
    openNotifications,
    closeNotifications,

    // Legacy compatibility
    isNewDirectMessageOpen: state.newDirectMessage.isOpen,
  };
};
