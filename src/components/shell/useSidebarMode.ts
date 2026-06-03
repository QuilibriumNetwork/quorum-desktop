import { useLocation } from 'react-router-dom';

export type SidebarMode = 'dm' | 'spaces' | 'channels' | 'discover' | 'hidden';

const SPACE_ROUTE_PATTERN = /^\/spaces\/([^/]+)\/[^/]+$/;

/**
 * Single source of truth for what the AppShell sidebar should render — and
 * whether it should be visible at all — based on the current route.
 *
 * `/discover` mounts the DiscoverSidebar (Public Spaces / People tabs).
 */
export const useSidebarMode = (): SidebarMode => {
  const location = useLocation();

  if (location.pathname.startsWith('/messages')) return 'dm';

  if (location.pathname.startsWith('/discover')) return 'discover';

  if (location.pathname.startsWith('/spaces')) {
    if (SPACE_ROUTE_PATTERN.test(location.pathname)) return 'channels';
    return 'spaces';
  }

  return 'hidden';
};
