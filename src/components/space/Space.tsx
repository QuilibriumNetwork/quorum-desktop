import * as React from 'react';
import { useState } from 'react';
import { useParams } from 'react-router';
import ChannelList from './ChannelList';
import Channel from './Channel';
import UserStatus from '../user/UserStatus';
import { useSpace } from '../../hooks';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

import './Space.scss';
import { useModalContext } from '../context/ModalProvider';

type SpaceProps = {
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

const Space: React.FunctionComponent<SpaceProps> = (props) => {
  const [kickUserAddress, setKickUserAddress] = useState<string>();
  let params = useParams<{ spaceId: string; channelId: string }>();
  let { data: space } = useSpace({ spaceId: params.spaceId! });
  const { isMobile, isTablet, leftSidebarOpen, closeLeftSidebar, navMenuOpen } =
    useResponsiveLayoutContext();
  const { openUserSettings } = useModalContext();

  if (!props || !space || !params.spaceId || !params.channelId) {
    return <></>;
  }

  return (
    <div className="space-container">
      {/* Mobile backdrop overlay */}
      {(isMobile || isTablet) && leftSidebarOpen && (
        <div
          className="fixed inset-y-0 right-0 bg-overlay z-[997]"
          style={{
            left: navMenuOpen
              ? (window.innerWidth <= 480 ? '50px' : '74px')
              : '0px'
          }}
          onClick={closeLeftSidebar}
        />
      )}

      <div
        className={`space-container-channels ${leftSidebarOpen && (isMobile || isTablet) ? 'open' : ''} ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
      >
        <ChannelList spaceId={params.spaceId} />
        <UserStatus
          setUser={props.setUser}
          setIsUserSettingsOpen={openUserSettings}
          setAuthState={props.setAuthState}
          user={props.user}
        />
      </div>
      <Channel
        key={`${params.spaceId}-${params.channelId}`}
        kickUserAddress={kickUserAddress}
        setKickUserAddress={setKickUserAddress}
        spaceId={params.spaceId}
        channelId={params.channelId}
      />
    </div>
  );
};

export default Space;
