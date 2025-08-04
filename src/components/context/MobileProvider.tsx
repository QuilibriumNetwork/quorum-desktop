import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useState,
} from 'react';
import MessageActionsDrawer from '../message/MessageActionsDrawer';
import EmojiPickerDrawer from '../message/EmojiPickerDrawer';

// Mobile state interface
interface MobileState {
  messageActionsDrawer: {
    isOpen: boolean;
    data?: any;
    isClosing: boolean;
  };
  emojiPickerDrawer: {
    isOpen: boolean;
    data?: any;
    isClosing: boolean;
  };
}

// Mobile actions
type MobileAction =
  | { type: 'OPEN_MESSAGE_ACTIONS'; data: any }
  | { type: 'CLOSE_MESSAGE_ACTIONS' }
  | { type: 'SET_MESSAGE_ACTIONS_CLOSING'; isClosing: boolean }
  | { type: 'OPEN_EMOJI_PICKER'; data: any }
  | { type: 'CLOSE_EMOJI_PICKER' }
  | { type: 'SET_EMOJI_PICKER_CLOSING'; isClosing: boolean };

// Initial state
const initialMobileState: MobileState = {
  messageActionsDrawer: { isOpen: false, isClosing: false },
  emojiPickerDrawer: { isOpen: false, isClosing: false },
};

// Mobile reducer
function mobileReducer(state: MobileState, action: MobileAction): MobileState {
  switch (action.type) {
    case 'OPEN_MESSAGE_ACTIONS':
      return {
        ...state,
        messageActionsDrawer: {
          isOpen: true,
          data: action.data,
          isClosing: false,
        },
      };
    case 'CLOSE_MESSAGE_ACTIONS':
      return {
        ...state,
        messageActionsDrawer: {
          ...state.messageActionsDrawer,
          isOpen: false,
        },
      };
    case 'SET_MESSAGE_ACTIONS_CLOSING':
      return {
        ...state,
        messageActionsDrawer: {
          ...state.messageActionsDrawer,
          isClosing: action.isClosing,
        },
      };

    case 'OPEN_EMOJI_PICKER':
      return {
        ...state,
        emojiPickerDrawer: {
          isOpen: true,
          data: action.data,
          isClosing: false,
        },
      };
    case 'CLOSE_EMOJI_PICKER':
      return {
        ...state,
        emojiPickerDrawer: {
          ...state.emojiPickerDrawer,
          isOpen: false,
        },
      };
    case 'SET_EMOJI_PICKER_CLOSING':
      return {
        ...state,
        emojiPickerDrawer: {
          ...state.emojiPickerDrawer,
          isClosing: action.isClosing,
        },
      };

    default:
      return state;
  }
}

// Context interface
interface MobileContextType {
  state: MobileState;
  openMobileActionsDrawer: (messageData: any) => void;
  closeMobileActionsDrawer: () => void;
  openMobileEmojiDrawer: (emojiData: any) => void;
  closeMobileEmojiDrawer: () => void;
}

// Context
const MobileContext = createContext<MobileContextType | undefined>(undefined);

// Hook
export const useMobile = () => {
  const context = useContext(MobileContext);
  if (!context) {
    throw new Error('useMobile must be used within MobileProvider');
  }
  return context;
};

// Provider props
interface MobileProviderProps {
  children: ReactNode;
}

// Provider component
export const MobileProvider: React.FC<MobileProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(mobileReducer, initialMobileState);

  const handleCloseMessageActions = () => {
    dispatch({ type: 'SET_MESSAGE_ACTIONS_CLOSING', isClosing: true });
    setTimeout(() => {
      dispatch({ type: 'CLOSE_MESSAGE_ACTIONS' });
      dispatch({ type: 'SET_MESSAGE_ACTIONS_CLOSING', isClosing: false });
    }, 300);
  };

  const handleCloseEmojiPicker = () => {
    dispatch({ type: 'SET_EMOJI_PICKER_CLOSING', isClosing: true });
    setTimeout(() => {
      dispatch({ type: 'CLOSE_EMOJI_PICKER' });
      dispatch({ type: 'SET_EMOJI_PICKER_CLOSING', isClosing: false });
    }, 300);
  };

  const contextValue: MobileContextType = {
    state,
    openMobileActionsDrawer: (messageData: any) =>
      dispatch({ type: 'OPEN_MESSAGE_ACTIONS', data: messageData }),
    closeMobileActionsDrawer: handleCloseMessageActions,
    openMobileEmojiDrawer: (emojiData: any) =>
      dispatch({ type: 'OPEN_EMOJI_PICKER', data: emojiData }),
    closeMobileEmojiDrawer: handleCloseEmojiPicker,
  };

  return (
    <MobileContext.Provider value={contextValue}>
      {/* Render mobile drawers with z-[9999] for proper stacking */}
      {state.messageActionsDrawer.isOpen && state.messageActionsDrawer.data && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-overlay backdrop-blur">
          <MessageActionsDrawer
            isOpen={!state.messageActionsDrawer.isClosing}
            message={state.messageActionsDrawer.data.message}
            onClose={handleCloseMessageActions}
            onReply={state.messageActionsDrawer.data.onReply}
            onCopyLink={state.messageActionsDrawer.data.onCopyLink}
            onDelete={state.messageActionsDrawer.data.onDelete}
            onReaction={state.messageActionsDrawer.data.onReaction}
            onMoreReactions={state.messageActionsDrawer.data.onMoreReactions}
            canDelete={state.messageActionsDrawer.data.canDelete}
            userAddress={state.messageActionsDrawer.data.userAddress}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={handleCloseMessageActions}
          />
        </div>
      )}

      {state.emojiPickerDrawer.isOpen && state.emojiPickerDrawer.data && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-overlay backdrop-blur">
          <EmojiPickerDrawer
            isOpen={!state.emojiPickerDrawer.isClosing}
            onClose={handleCloseEmojiPicker}
            onEmojiClick={state.emojiPickerDrawer.data.onEmojiClick}
            customEmojis={state.emojiPickerDrawer.data.customEmojis}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={handleCloseEmojiPicker}
          />
        </div>
      )}

      {children}
    </MobileContext.Provider>
  );
};
