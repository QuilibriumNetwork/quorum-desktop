import React, { useState, createContext, useContext } from 'react';
import Layout from './Layout';
import UserSettingsModal from './modals/UserSettingsModal';
import SimpleModal from './SimpleModal';
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

  const modalContextValue = {
    openUserSettings: () => setIsUserSettingsOpen(true),
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