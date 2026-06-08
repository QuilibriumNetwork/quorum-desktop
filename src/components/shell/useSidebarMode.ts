import { useLocation } from 'react-router-dom';

export type SidebarMode = 'dm' | 'spaces' | 'channels' | 'hidden';

const SPACE_ROUTE_PATTERN = /^\/spaces\/([^/]+)\/[^/]+$/;

/**
 * Single source of truth for what the AppShell sidebar should render — and
 * whether it should be visible at all — based on the current route.
 *
 * `/discover/spaces` is a leaf route with no section sidebar — the page
 * navigates the user directly into the spaces directory. (A `discover` mode
 * previously hosted a two-tab People/Spaces sidebar; the People tab was
 * retired 2026-06-08 since no backend enumeration endpoint exists.)
 */
export const useSidebarMode = (): SidebarMode => {
  const location = useLocation();

  if (location.pathname.startsWith('/messages')) return 'dm';

  if (location.pathname.startsWith('/discover')) return 'hidden';

  if (location.pathname.startsWith('/bookmarks')) return 'hidden';

  if (location.pathname.startsWith('/spaces')) {
    if (SPACE_ROUTE_PATTERN.test(location.pathname)) return 'channels';
    return 'spaces';
  }

  return 'hidden';
};
