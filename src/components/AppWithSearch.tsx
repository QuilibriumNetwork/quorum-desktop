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
  openChannelEditor: (spaceId: string, groupName: string, channelId: string) => void;
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
  const [spaceEditorData, setSpaceEditorData] = useState<{spaceId: string} | null>(null);
  const [channelEditorData, setChannelEditorData] = useState<{spaceId: string, groupName: string, channelId: string} | null>(null);

  const modalContextValue = {
    openUserSettings: () => setIsUserSettingsOpen(true),
    openSpaceEditor: (spaceId: string) => setSpaceEditorData({spaceId}),
    openChannelEditor: (spaceId: string, groupName: string, channelId: string) => 
      setChannelEditorData({spaceId, groupName, channelId}),
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