import * as React from 'react';
import { useLocation } from 'react-router-dom';
import DirectMessageContactsList from '../direct/DirectMessageContactsList';
import ChannelList from '../space/ChannelList';
import { SpacesSidebar } from '../space/SpacesSidebar';
import { useSidebarMode } from './useSidebarMode';
import './Sidebar.scss';

const SPACE_ROUTE_PATTERN = /^\/spaces\/([^/]+)\/[^/]+$/;

interface SidebarProps {
  onAddSpace: () => void;
  onCreateSpace: () => void;
  /** When true, force the expanded list view regardless of the global
   *  collapse preference. Used when the sidebar is rendered inside the
   *  phone drawer, where avatars-only would be useless. */
  forceExpanded?: boolean;
}

/** Route-driven dispatcher for sidebar contents. */
export const Sidebar: React.FunctionComponent<SidebarProps> = ({ onAddSpace, onCreateSpace, forceExpanded }) => {
  const mode = useSidebarMode();
  const location = useLocation();

  switch (mode) {
    case 'dm':
      return <DirectMessageContactsList forceExpanded={forceExpanded} />;
    case 'channels': {
      const match = location.pathname.match(SPACE_ROUTE_PATTERN);
      const spaceId = match ? match[1] : null;
      return spaceId ? <ChannelList spaceId={spaceId} /> : null;
    }
    case 'spaces':
      return <SpacesSidebar onAddSpace={onAddSpace} onCreateSpace={onCreateSpace} forceExpanded={forceExpanded} />;
    case 'hidden':
    default:
      return null;
  }
};

export default Sidebar;
