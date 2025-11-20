import * as React from 'react';
import { useParams } from 'react-router';
import DirectMessageContactsList from './DirectMessageContactsList';
import DirectMessage from './DirectMessage';
import UserStatus from '../user/UserStatus';
import { EmptyDirectMessage } from './EmptyDirectMessage';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

import './DirectMessages.scss';
import { useRegistrationContext } from '../context/useRegistrationContext';
import { useModalContext } from '../context/ModalProvider';
import { ReactTooltip } from '../ui';
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
    navMenuOpen,
  } = useResponsiveLayoutContext();

  // Simple context-aware sidebar: set initial state based on route, only on route changes
  React.useEffect(() => {
    // Only manage sidebar state for mobile/tablet - desktop shows sidebar always
    if (isMobile || isTablet) {
      if (!address) {
        // On /messages (no specific conversation) - show sidebar
        openLeftSidebar();
      } else {
        // On /messages/:address (specific conversation) - hide sidebar
        closeLeftSidebar();
      }
    }
  }, [address, isMobile, isTablet]); // Removed leftSidebarOpen from deps to avoid fighting manual toggles

  const { openUserSettings, isNewDirectMessageOpen, closeNewDirectMessage } =
    useModalContext();

  return (
    <div className="direct-messages-container">
      {/* Mobile backdrop overlay - show when sidebar is visible */}
      {(isMobile || isTablet) && leftSidebarOpen && (
        <div
          className={`fixed inset-y-0 right-0 bg-overlay z-[997] left-sidebar-backdrop ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
          onClick={closeLeftSidebar}
        />
      )}

      <div
        className={`direct-messages-container-channels ${leftSidebarOpen && (isMobile || isTablet) ? 'open' : ''} ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
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
