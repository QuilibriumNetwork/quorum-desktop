import * as React from 'react';
import { useParams } from 'react-router';
import DirectMessageContactsList from './DirectMessageContactsList';
import DirectMessage from './DirectMessage';
import UserStatus from '../user/UserStatus';
import { EmptyDirectMessage } from './EmptyDirectMessage';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

import './DirectMessages.scss';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { useModalContext } from '../AppWithSearch';

type DirectMessagesProps = {
  user: any;
  setAuthState: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
};

const DirectMessages: React.FunctionComponent<DirectMessagesProps> = (
  props
) => {
  let { address } = useParams<{ address: string }>();
  const { keyset } = useRegistrationContext();
  const { isMobile, leftSidebarOpen, closeLeftSidebar, openLeftSidebar } = useResponsiveLayoutContext();

  // Initialize sidebar as open on mobile by default (only on /messages homepage, not on conversation pages)
  React.useEffect(() => {
    if (isMobile && !address) {
      openLeftSidebar();
    }
  }, [isMobile, address, openLeftSidebar]);
  const { openUserSettings } = useModalContext();

  return (
    <div className="direct-messages-container">
      {/* Mobile backdrop overlay - show when sidebar is visible */}
      {isMobile && leftSidebarOpen && (
        <div 
          className="fixed inset-y-0 right-0 bg-black bg-opacity-50 z-[997]"
          style={{ left: window.innerWidth <= 480 ? '50px' : '74px' }}
          onClick={closeLeftSidebar}
        />
      )}
      
      <div className={`direct-messages-container-channels ${leftSidebarOpen && isMobile ? 'open' : ''}`}>
        <React.Suspense>
          {keyset.deviceKeyset?.inbox_keyset && <DirectMessageContactsList />}
        </React.Suspense>
        <UserStatus
          setIsUserSettingsOpen={openUserSettings}
          setUser={props.setUser}
          setAuthState={props.setAuthState}
          user={props.user}
        />
      </div>
      <React.Suspense>
        {address ? (
          <DirectMessage key={'messages-' + address} />
        ) : (
          <EmptyDirectMessage />
        )}
      </React.Suspense>
    </div>
  );
};

export default DirectMessages;
