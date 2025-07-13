import React from 'react';
import Layout from './Layout';
import './AppWithSearch.scss';

interface AppWithSearchProps {
  children: React.ReactNode;
  newDirectMessage?: boolean;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const AppWithSearch: React.FC<AppWithSearchProps> = ({
  children,
  newDirectMessage,
  kickUserAddress,
  setKickUserAddress,
}) => {
  return (
    <div className="app-with-search">
      <Layout
        newDirectMessage={newDirectMessage}
        kickUserAddress={kickUserAddress}
        setKickUserAddress={setKickUserAddress}
      >
        {children}
      </Layout>
    </div>
  );
};