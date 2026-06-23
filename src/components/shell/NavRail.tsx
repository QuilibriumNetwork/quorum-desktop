import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Icon, Tooltip } from '../primitives';
import type { IconName } from '@quilibrium/quorum-shared';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useModalContext } from '../context/ModalProvider';
import { UserAvatar } from '../user/UserAvatar';
import { getAddressSuffix } from '../../utils';
import { useOptionalShellState } from './useShellState';
import { useSpaces } from '../../hooks/queries/spaces';
import { useSpaceMentionCounts } from '../../hooks/business/mentions';
import { useSpaceReplyCounts } from '../../hooks/business/replies';
import './NavRail.scss';

type RailSectionId = 'dm' | 'spaces' | 'notifications' | 'bookmarks' | 'discover' | 'farcaster' | 'wallet';

interface RailItemConfig {
  id: RailSectionId;
  icon: IconName;
  label: string;
  route: string;
}

const buildItems = (): RailItemConfig[] => [
  {
    id: 'dm',
    icon: 'message',
    label: t`Messages`,
    route: '/messages',
  },
  {
    id: 'spaces',
    icon: 'users-group',
    label: t`Spaces`,
    route: '/spaces',
  },
  {
    id: 'bookmarks',
    icon: 'bookmark',
    label: t`Bookmarks`,
    route: '/bookmarks',
  },
  {
    id: 'discover',
    icon: 'compass',
    label: t`Public spaces`,
    route: '/discover/spaces',
  },
  {
    id: 'farcaster',
    icon: 'globe',
    label: t`Farcaster`,
    route: '/farcaster',
  },
  {
    id: 'wallet',
    icon: 'wallet',
    label: t`Wallet`,
    route: '/wallet',
  },
  {
    id: 'notifications',
    icon: 'bell',
    label: t`Notifications`,
    route: '', // not navigated — opens the global panel
  },
  // TODO: FAVORITES section — depends on favorites feature
];

interface NavRailProps {
  collapsed: boolean;
  /** When null, the collapse toggle is hidden — used on tablet/phone where the rail
   *  width is viewport-driven and the user can't change it. */
  onToggleCollapse: (() => void) | null;
}

export const NavRail: React.FunctionComponent<NavRailProps> = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Rebuild on every render so the Lingui `t` macro re-evaluates with the
  // current locale (dynamicActivate doesn't break i18n strings memoized with
  // an empty deps array).
  const items = buildItems();
  const user = usePasskeysContext();
  const { openUserSettings, openNotifications } = useModalContext();
  // On phone the rail lives inside the drawer; tapping a section should swap
  // what the sidebar shows (DM list, spaces list) rather than navigate to the
  // last visited leaf, which would close the drawer via the leaf-route
  // auto-close in AppShell.
  const shell = useOptionalShellState();
  const isPhone = shell?.viewport === 'phone';

  const displayName = user?.currentPasskeyInfo?.displayName || 'User';
  const userIcon = user?.currentPasskeyInfo?.pfpUrl;
  const userAddress = user?.currentPasskeyInfo?.address || '';

  // Global notifications: the bell opens a centered Modal (rendered by
  // ModalProvider). NavRail only needs the unread-presence dot — the panel and
  // its sender resolver live in GlobalNotificationsModal. `useSpaces` is
  // suspense-backed, matching the sibling SpacesSidebar under the Layout-level
  // Suspense boundary; the cached query won't re-suspend.
  const { data: spaces = [] } = useSpaces();
  const mentionCounts = useSpaceMentionCounts({ spaces });
  const replyCounts = useSpaceReplyCounts({ spaces });
  const hasUnreadNotifications =
    Object.keys(mentionCounts).length > 0 || Object.keys(replyCounts).length > 0;

  // Compute active section from pathname.
  // /discover/* → "discover"; /spaces or /spaces/:id/:id → "spaces"; /messages → "dm".
  const activeId: RailSectionId | null = React.useMemo(() => {
    if (location.pathname.startsWith('/messages')) return 'dm';
    if (location.pathname.startsWith('/discover')) return 'discover';
    if (location.pathname.startsWith('/bookmarks')) return 'bookmarks';
    if (location.pathname.startsWith('/farcaster')) return 'farcaster';
    if (location.pathname.startsWith('/wallet')) return 'wallet';
    if (location.pathname.startsWith('/spaces')) return 'spaces';
    return null;
  }, [location.pathname]);

  const onItemClick = (item: RailItemConfig) => {
    if (item.id === 'notifications') {
      openNotifications();
      return;
    }
    if (item.id === 'dm') {
      // On phone the rail lives in the drawer — land on the DM list so the
      // sidebar swaps content and the drawer stays open. On desktop/tablet
      // restore the last visited DM, matching legacy NavMenu behavior.
      if (isPhone) {
        navigate('/messages');
        return;
      }
      const lastAddress = sessionStorage.getItem('lastDmAddress');
      navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
      return;
    }
    if (item.id === 'spaces') {
      // Phone: always land on the spaces list so the drawer keeps showing the
      // sidebar. Desktop/tablet: restore last visited space + channel.
      if (isPhone) {
        navigate('/spaces');
        return;
      }
      // If already inside a space, re-clicking the rail item returns to the
      // spaces list (sidebar shows all spaces, main shows empty hint).
      const insideSpace = /^\/spaces\/[^/]+\/[^/]+/.test(location.pathname);
      if (insideSpace) {
        navigate('/spaces');
        return;
      }
      // Otherwise, restore the last visited space + channel if we have one.
      // localStorage so it survives tab close (mobile browsers kill background tabs).
      let lastSpaceId: string | null = null;
      let lastChannelId: string | undefined;
      try {
        lastSpaceId = localStorage.getItem('lastSpaceId');
        if (lastSpaceId) {
          const raw = localStorage.getItem('lastChannelBySpace');
          if (raw) {
            const map = JSON.parse(raw) as Record<string, string>;
            lastChannelId = map[lastSpaceId];
          }
        }
      } catch {
        // ignore
      }
      if (lastSpaceId && lastChannelId) {
        navigate(`/spaces/${lastSpaceId}/${lastChannelId}`);
        return;
      }
      navigate('/spaces');
      return;
    }
    navigate(item.route);
  };

  return (
    <nav className="nav-rail" aria-label={t`Primary navigation`}>
      <div className="nav-rail__items">
        {items.map((item) => {
          const active = activeId === item.id;
          const buttonContent = (
            <button
              key={item.id}
              type="button"
              className={`nav-rail__item ${active ? 'nav-rail__item--active' : ''} ${collapsed ? 'nav-rail__item--collapsed' : 'nav-rail__item--expanded'}`}
              onClick={() => onItemClick(item)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative flex-shrink-0">
                <Icon name={item.icon} size="xl" />
                {item.id === 'notifications' && hasUnreadNotifications && (
                  <span className="icon-unread-dot nav-rail__notif-dot" aria-hidden="true" />
                )}
              </span>
              {!collapsed && (
                <span className="nav-rail__item-label">{item.label}</span>
              )}
            </button>
          );

          // Tooltips only on collapsed rail — expanded rail already shows labels.
          if (!collapsed) return <React.Fragment key={item.id}>{buttonContent}</React.Fragment>;

          return (
            <Tooltip
              key={item.id}
              id={`nav-rail-${item.id}`}
              content={item.label}
              place="right"
              showOnTouch={false}
            >
              {buttonContent}
            </Tooltip>
          );
        })}
      </div>

      <div className="nav-rail__spacer" />

      {/* Collapse toggle — only when the rail width is user-controllable (desktop).
          `--collapse-toggle` keeps it visually muted vs the primary nav above. */}
      {onToggleCollapse && (collapsed ? (
        <Tooltip
          id="nav-rail-collapse-toggle"
          content={t`Expand sidebar`}
          place="right"
          showOnTouch={false}
        >
          <button
            type="button"
            className="nav-rail__item nav-rail__item--collapsed nav-rail__item--collapse-toggle"
            onClick={onToggleCollapse}
            aria-label={t`Expand sidebar`}
          >
            <Icon name="sidebar-left-expand" size="xl" />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          className="nav-rail__item nav-rail__item--expanded nav-rail__item--collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={t`Collapse sidebar`}
        >
          <Icon name="sidebar-left-collapse" size="xl" />
          <span className="nav-rail__item-label">{t`Collapse`}</span>
        </button>
      ))}

      {onToggleCollapse && <div className="nav-rail__divider" />}

      {/* User avatar + settings */}
      {collapsed ? (
        <Tooltip
          id="nav-rail-user-settings"
          content={displayName}
          place="right"
          showOnTouch={false}
        >
          <button
            type="button"
            className="nav-rail__user nav-rail__user--collapsed"
            onClick={openUserSettings}
            aria-label={t`Open user settings`}
          >
            <UserAvatar
              displayName={displayName}
              userIcon={userIcon}
              address={userAddress}
              size={34}
            />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          className="nav-rail__user nav-rail__user--expanded"
          onClick={openUserSettings}
          aria-label={t`Open user settings`}
        >
          <UserAvatar
            displayName={displayName}
            userIcon={userIcon}
            address={userAddress}
            size={34}
          />
          <div className="nav-rail__user-meta">
            <div className="nav-rail__user-name">{displayName}</div>
            <div className="nav-rail__user-hint">
              {userAddress ? getAddressSuffix(userAddress) : t`Settings`}
            </div>
          </div>
        </button>
      )}
    </nav>
  );
};

export default NavRail;
