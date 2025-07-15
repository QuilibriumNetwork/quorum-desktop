import * as React from 'react';
import { useParams } from 'react-router';
import ChannelList from '../channel/ChannelList';
import Channel from '../channel/Channel';
import UserStatus from '../user/UserStatus';
import { useSpace } from '../../hooks';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';

import './Space.scss';
import { useModalContext } from '../AppWithSearch';

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
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
};

const Space: React.FunctionComponent<SpaceProps> = (props) => {
  let params = useParams<{ spaceId: string; channelId: string }>();
  let { data: space } = useSpace({ spaceId: params.spaceId! });
  const { isMobile, leftSidebarOpen, closeLeftSidebar } = useResponsiveLayoutContext();
  const { openUserSettings } = useModalContext();
  
  if (!props || !space || !params.spaceId || !params.channelId) {
    return <></>;
  }

  return (
    <div className="space-container">
      {/* Mobile backdrop overlay */}
      {isMobile && leftSidebarOpen && (
        <div 
          className="fixed inset-y-0 right-0 bg-black bg-opacity-50 z-[997]"
          style={{ left: window.innerWidth <= 480 ? '50px' : '74px' }}
          onClick={closeLeftSidebar}
        />
      )}
      
      <div className={`space-container-channels ${leftSidebarOpen && isMobile ? 'open' : ''}`}>
        <ChannelList spaceId={params.spaceId} />
        <UserStatus
          setUser={props.setUser}
          setIsUserSettingsOpen={openUserSettings}
          setAuthState={props.setAuthState}
          user={props.user}
        />
      </div>
      <Channel
        kickUserAddress={props.kickUserAddress}
        setKickUserAddress={props.setKickUserAddress}
        spaceId={params.spaceId}
        channelId={params.channelId}
      />
    </div>
  );
};

export default Space;
