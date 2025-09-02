import React, { useState, createContext, useContext } from 'react';
import Layout from './Layout';
import UserSettingsModal from './modals/UserSettingsModal';
import SpaceEditor from './channel/SpaceEditor';
import ChannelEditor from './channel/ChannelEditor';
import LeaveSpaceModal from './modals/LeaveSpaceModal';
import ConversationSettingsModal from './modals/ConversationSettingsModal';
import MessageActionsDrawer from './message/MessageActionsDrawer';
import EmojiPickerDrawer from './message/EmojiPickerDrawer';
// Note: UserSettingsModal, SpaceEditor, ChannelEditor use custom simple modal pattern
import './AppWithSearch.scss';

interface AppWithSearchProps {
  children: React.ReactNode;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
  user?: any;
  setUser?: any;
}

interface ModalContextType {
  openUserSettings: () => void;
  openSpaceEditor: (spaceId: string) => void;
  openChannelEditor: (
    spaceId: string,
    groupName: string,
    channelId: string
  ) => void;
  openLeaveSpace: (spaceId: string) => void;
  openConversationSettings: (conversationId: string) => void;
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  rightSidebarContent: React.ReactNode;
  setRightSidebarContent: (content: React.ReactNode) => void;
  openMobileActionsDrawer: (messageData: any) => void;
  closeMobileActionsDrawer: () => void;
  openMobileEmojiDrawer: (emojiData: any) => void;
  closeMobileEmojiDrawer: () => void;
  isNewDirectMessageOpen: boolean;
  openNewDirectMessage: () => void;
  closeNewDirectMessage: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within AppWithSearch');
  }
  return context;
};

export const AppWithSearch: React.FC<AppWithSearchProps> = ({
  children,
  kickUserAddress,
  setKickUserAddress,
  user,
  setUser,
}) => {
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [spaceEditorData, setSpaceEditorData] = useState<{
    spaceId: string;
  } | null>(null);
  const [channelEditorData, setChannelEditorData] = useState<{
    spaceId: string;
    groupName: string;
    channelId: string;
  } | null>(null);
  const [leaveSpaceData, setLeaveSpaceData] = useState<{
    spaceId: string;
  } | null>(null);
  const [conversationSettingsData, setConversationSettingsData] = useState<{
    conversationId: string;
  } | null>(null);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [rightSidebarContent, setRightSidebarContent] =
    useState<React.ReactNode>(null);
  const [mobileActionsDrawerData, setMobileActionsDrawerData] = useState<any>(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [mobileEmojiDrawerData, setMobileEmojiDrawerData] = useState<any>(null);
  const [emojiDrawerClosing, setEmojiDrawerClosing] = useState(false);
  const [isNewDirectMessageOpen, setIsNewDirectMessageOpen] = useState(false);

  const modalContextValue = {
    openUserSettings: () => setIsUserSettingsOpen(true),
    openSpaceEditor: (spaceId: string) => setSpaceEditorData({ spaceId }),
    openChannelEditor: (
      spaceId: string,
      groupName: string,
      channelId: string
    ) => setChannelEditorData({ spaceId, groupName, channelId }),
    openLeaveSpace: (spaceId: string) => setLeaveSpaceData({ spaceId }),
    openConversationSettings: (conversationId: string) =>
      setConversationSettingsData({ conversationId }),
    showRightSidebar,
    setShowRightSidebar,
    rightSidebarContent,
    setRightSidebarContent,
    openMobileActionsDrawer: (messageData: any) => setMobileActionsDrawerData(messageData),
    closeMobileActionsDrawer: () => {
      setDrawerClosing(true);
      setTimeout(() => {
        setMobileActionsDrawerData(null);
        setDrawerClosing(false);
      }, 300);
    },
    openMobileEmojiDrawer: (emojiData: any) => setMobileEmojiDrawerData(emojiData),
    closeMobileEmojiDrawer: () => {
      setEmojiDrawerClosing(true);
      setTimeout(() => {
        setMobileEmojiDrawerData(null);
        setEmojiDrawerClosing(false);
      }, 300);
    },
    isNewDirectMessageOpen,
    openNewDirectMessage: () => setIsNewDirectMessageOpen(true),
    closeNewDirectMessage: () => setIsNewDirectMessageOpen(false),
  };

  return (
    <div className="app-with-search">
      {isUserSettingsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur">
          <UserSettingsModal
            setUser={setUser}
            dismiss={() => setIsUserSettingsOpen(false)}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setIsUserSettingsOpen(false)}
          />
        </div>
      )}

      {spaceEditorData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur">
          <SpaceEditor
            spaceId={spaceEditorData.spaceId}
            dismiss={() => setSpaceEditorData(null)}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setSpaceEditorData(null)}
          />
        </div>
      )}

      {channelEditorData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur">
          <ChannelEditor
            spaceId={channelEditorData.spaceId}
            groupName={channelEditorData.groupName}
            channelId={channelEditorData.channelId}
            dismiss={() => setChannelEditorData(null)}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setChannelEditorData(null)}
          />
        </div>
      )}

      {leaveSpaceData && (
        <LeaveSpaceModal
          spaceId={leaveSpaceData.spaceId}
          visible={true}
          onClose={() => setLeaveSpaceData(null)}
        />
      )}

      {conversationSettingsData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
          <ConversationSettingsModal
            conversationId={conversationSettingsData.conversationId}
            onClose={() => setConversationSettingsData(null)}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setConversationSettingsData(null)}
          />
        </div>
      )}

      {mobileActionsDrawerData && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur">
          <MessageActionsDrawer
            isOpen={!drawerClosing}
            message={mobileActionsDrawerData.message}
            onClose={() => {
              setDrawerClosing(true);
              setTimeout(() => {
                setMobileActionsDrawerData(null);
                setDrawerClosing(false);
              }, 300);
            }}
            onReply={mobileActionsDrawerData.onReply}
            onCopyLink={mobileActionsDrawerData.onCopyLink}
            onDelete={mobileActionsDrawerData.onDelete}
            onReaction={mobileActionsDrawerData.onReaction}
            onMoreReactions={mobileActionsDrawerData.onMoreReactions}
            canDelete={mobileActionsDrawerData.canDelete}
            userAddress={mobileActionsDrawerData.userAddress}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => {
              setDrawerClosing(true);
              setTimeout(() => {
                setMobileActionsDrawerData(null);
                setDrawerClosing(false);
              }, 300);
            }}
          />
        </div>
      )}

      {mobileEmojiDrawerData && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-[rgba(0,0,0,0.5)] backdrop-blur">
          <EmojiPickerDrawer
            isOpen={!emojiDrawerClosing}
            onClose={() => {
              setEmojiDrawerClosing(true);
              setTimeout(() => {
                setMobileEmojiDrawerData(null);
                setEmojiDrawerClosing(false);
              }, 300);
            }}
            onEmojiClick={mobileEmojiDrawerData.onEmojiClick}
            customEmojis={mobileEmojiDrawerData.customEmojis}
          />
          <div
            className="fixed inset-0 -z-10"
            onClick={() => {
              setEmojiDrawerClosing(true);
              setTimeout(() => {
                setMobileEmojiDrawerData(null);
                setEmojiDrawerClosing(false);
              }, 300);
            }}
          />
        </div>
      )}

      {showRightSidebar && (
        <div
          className="fixed inset-0 bg-mobile-overlay z-[9999] lg:hidden"
          onClick={() => setShowRightSidebar(false)}
        />
      )}

      {rightSidebarContent && (
        <div
          className={
            'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-scroll ' +
            'transition-transform duration-300 ease-in-out ' +
            (showRightSidebar ? 'translate-x-0' : 'translate-x-full') +
            ' fixed top-0 right-0 h-full z-[10000] lg:hidden'
          }
        >
          {rightSidebarContent}
        </div>
      )}

      <ModalContext.Provider value={modalContextValue}>
        <Layout
          kickUserAddress={kickUserAddress}
          setKickUserAddress={setKickUserAddress}
        >
          {children}
        </Layout>
      </ModalContext.Provider>
    </div>
  );
};
