import * as React from 'react';
import { useParams } from 'react-router';
import ChannelList from './ChannelList';
import Channel from './Channel';
import { useSpace } from '../../hooks';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { ThreadProvider } from '../context/ThreadContext';
import { ThreadPanel } from '../thread/ThreadPanel';

import './Space.scss';

const Space: React.FunctionComponent = () => {
  const params = useParams<{ spaceId: string; channelId: string }>();
  const { data: space } = useSpace({ spaceId: params.spaceId! });
  const { isMobile, isTablet, leftSidebarOpen, closeLeftSidebar, navMenuOpen } =
    useResponsiveLayoutContext();

  if (!space || !params.spaceId || !params.channelId) {
    return <></>;
  }

  return (
    <ThreadProvider>
      <div className="space-container">
        {/* Mobile backdrop overlay */}
        {(isMobile || isTablet) && leftSidebarOpen && (
          <div
            className={`fixed inset-y-0 right-0 bg-overlay z-[997] left-sidebar-backdrop ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
            onClick={closeLeftSidebar}
          />
        )}

        <div
          className={`space-container-channels ${leftSidebarOpen && (isMobile || isTablet) ? 'open' : ''} ${!navMenuOpen ? 'nav-menu-hidden' : ''}`}
        >
          <ChannelList spaceId={params.spaceId} />
        </div>
        <Channel
          key={`${params.spaceId}-${params.channelId}`}
          spaceId={params.spaceId}
          channelId={params.channelId}
        />
        <ThreadPanel />
      </div>
    </ThreadProvider>
  );
};

export default Space;
