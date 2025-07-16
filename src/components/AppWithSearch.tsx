import React, { useState, createContext, useContext } from 'react';
import Layout from './Layout';
import UserSettingsModal from './modals/UserSettingsModal';
import SpaceEditor from './channel/SpaceEditor';
import ChannelEditor from './channel/ChannelEditor';
// Note: UserSettingsModal, SpaceEditor, ChannelEditor use custom simple modal pattern
import './AppWithSearch.scss';

interface AppWithSearchProps {
  children: React.ReactNode;
  newDirectMessage?: boolean;
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
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  rightSidebarContent: React.ReactNode;
  setRightSidebarContent: (content: React.ReactNode) => void;
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
  newDirectMessage,
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
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [rightSidebarContent, setRightSidebarContent] =
    useState<React.ReactNode>(null);

  const modalContextValue = {
    openUserSettings: () => setIsUserSettingsOpen(true),
    openSpaceEditor: (spaceId: string) => setSpaceEditorData({ spaceId }),
    openChannelEditor: (
      spaceId: string,
      groupName: string,
      channelId: string
    ) => setChannelEditorData({ spaceId, groupName, channelId }),
    showRightSidebar,
    setShowRightSidebar,
    rightSidebarContent,
    setRightSidebarContent,
  };

  return (
    <div className="app-with-search">
      {isUserSettingsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur">
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
          newDirectMessage={newDirectMessage}
          kickUserAddress={kickUserAddress}
          setKickUserAddress={setKickUserAddress}
        >
          {children}
        </Layout>
      </ModalContext.Provider>
    </div>
  );
};
