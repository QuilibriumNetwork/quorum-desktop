import { useLocation, useSearchParams } from 'react-router-dom';

export type SidebarMode = 'dm' | 'spaces' | 'channels' | 'hidden';

const SPACE_ROUTE_PATTERN = /^\/spaces\/([^/]+)\/[^/]+$/;

/**
 * Single source of truth for what the AppShell sidebar should render — and
 * whether it should be visible at all — based on the current route.
 *
 * Public spaces (?tab=discover) collapses the sidebar slot to width 0 so the
 * Discover content uses the full main area.
 */
export const useSidebarMode = (): SidebarMode => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');

  if (location.pathname.startsWith('/messages')) return 'dm';

  if (location.pathname.startsWith('/spaces')) {
    if (tab === 'discover') return 'hidden';
    if (SPACE_ROUTE_PATTERN.test(location.pathname)) return 'channels';
    return 'spaces';
  }

  return 'hidden';
};
