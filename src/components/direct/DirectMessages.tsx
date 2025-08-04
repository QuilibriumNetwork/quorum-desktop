import * as React from 'react';
import { useParams } from 'react-router';
import DirectMessageContactsList from './DirectMessageContactsList';
import DirectMessage from './DirectMessage';
import UserStatus from '../user/UserStatus';
import { EmptyDirectMessage } from './EmptyDirectMessage';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import NewDirectMessageModal from '../modals/NewDirectMessageModal';

import './DirectMessages.scss';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { useModalContext } from '../context/ModalProvider';
import ReactTooltip from '../ReactTooltip';
import { t } from '@lingui/core/macro';

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
  const {
    isMobile,
    isTablet,
    leftSidebarOpen,
    closeLeftSidebar,
    openLeftSidebar,
  } = useResponsiveLayoutContext();

  // Removed automatic sidebar opening behavior - sidebar now opens only when user clicks burger menu
  const { openUserSettings, isNewDirectMessageOpen, closeNewDirectMessage } = useModalContext();

  return (
    <div className="direct-messages-container">
      {isNewDirectMessageOpen && (
        <NewDirectMessageModal
          visible={isNewDirectMessageOpen}
          onClose={closeNewDirectMessage}
        />
      )}
      {/* Mobile backdrop overlay - show when sidebar is visible */}
      {(isMobile || isTablet) && leftSidebarOpen && (
        <div
          className="fixed inset-y-0 right-0 bg-overlay z-[997]"
          style={{ left: window.innerWidth <= 480 ? '50px' : '74px' }}
          onClick={closeLeftSidebar}
        />
      )}

      <div
        className={`direct-messages-container-channels ${leftSidebarOpen && (isMobile || isTablet) ? 'open' : ''}`}
      >
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
      <ReactTooltip
        id="add-friend-tooltip"
        content={t`Add friend`}
        place="right"
        className="z-[9999]"
      />
    </div>
  );
};

export default DirectMessages;
