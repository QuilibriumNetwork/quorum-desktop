import * as React from 'react';
import { useParams } from 'react-router';
import DirectMessageContactsList from './DirectMessageContactsList';
import DirectMessage from './DirectMessage';
import UserStatus from '../user/UserStatus';
import { EmptyDirectMessage } from './EmptyDirectMessage';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

import './DirectMessages.scss';
import { useRegistrationContext } from '../context/RegistrationPersister';
import UserSettingsModal from '../modals/UserSettingsModal';

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
  const { isMobile, leftSidebarOpen, closeLeftSidebar } = useResponsiveLayoutContext();
  let [isUserSettingsOpen, setIsUserSettingsOpen] =
    React.useState<boolean>(false);

  return (
    <div className="direct-messages-container">
      {isUserSettingsOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <UserSettingsModal
              setUser={props.setUser}
              dismiss={() => setIsUserSettingsOpen(false)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsUserSettingsOpen(false)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      {/* Mobile backdrop overlay */}
      {isMobile && leftSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[997]"
          onClick={closeLeftSidebar}
        />
      )}
      
      <div className={`direct-messages-container-channels ${leftSidebarOpen && isMobile ? 'open' : ''}`}>
        <React.Suspense>
          {keyset.deviceKeyset?.inbox_keyset && <DirectMessageContactsList />}
        </React.Suspense>
        <UserStatus
          setIsUserSettingsOpen={setIsUserSettingsOpen}
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
