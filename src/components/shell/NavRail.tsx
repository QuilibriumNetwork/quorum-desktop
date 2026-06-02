import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Icon, Tooltip } from '../primitives';
import type { IconName } from '@quilibrium/quorum-shared';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useModalContext } from '../context/ModalProvider';
import { UserAvatar } from '../user/UserAvatar';
import './NavRail.scss';

type RailSectionId = 'dm' | 'spaces' | 'public';

interface RailItemConfig {
  id: RailSectionId;
  icon: IconName;
  label: string;
  route: string;
  /** Predicate matched against `location.pathname` to mark this item active. */
  isActive: (pathname: string) => boolean;
}

const buildItems = (): RailItemConfig[] => [
  {
    id: 'dm',
    icon: 'message',
    label: t`Direct messages`,
    route: '/messages',
    isActive: (p) => p.startsWith('/messages'),
  },
  {
    id: 'spaces',
    icon: 'users-group',
    label: t`Spaces`,
    route: '/spaces',
    isActive: (p) => p.startsWith('/spaces') && !p.includes('tab=discover'),
  },
  {
    id: 'public',
    icon: 'compass',
    label: t`Public spaces`,
    route: '/spaces?tab=discover',
    isActive: (p) => false, // refined when we read search params below
  },
  // TODO: 'farcaster' (icon: 'world') and 'wallet' (icon: 'wallet') — features not ready
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
  const items = React.useMemo(buildItems, []);
  const user = usePasskeysContext();
  const { openUserSettings } = useModalContext();

  const displayName = user?.currentPasskeyInfo?.displayName || 'User';
  const userIcon = user?.currentPasskeyInfo?.pfpUrl;
  const userAddress = user?.currentPasskeyInfo?.address || '';

  // Compute active section from pathname + search params.
  // /spaces?tab=discover → "public"; /spaces or /spaces?tab=my-spaces or /spaces/:id/:id → "spaces"
  const activeId: RailSectionId | null = React.useMemo(() => {
    const search = new URLSearchParams(location.search);
    const tab = search.get('tab');
    if (location.pathname.startsWith('/messages')) return 'dm';
    if (location.pathname.startsWith('/spaces')) {
      return tab === 'discover' ? 'public' : 'spaces';
    }
    return null;
  }, [location.pathname, location.search]);

  const onItemClick = (item: RailItemConfig) => {
    if (item.id === 'dm') {
      // Preserve last-visited DM if available, matching legacy NavMenu behavior
      const lastAddress = sessionStorage.getItem('lastDmAddress');
      navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
      return;
    }
    if (item.id === 'spaces') {
      // Within a session, return to the last visited space + channel.
      // Outside that, show the empty hint in main while the sidebar lists own spaces.
      const lastSpaceId = sessionStorage.getItem('lastSpaceId');
      const lastChannelId = sessionStorage.getItem('lastChannelId');
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
              <Icon name={item.icon} size="xl" />
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

      {/* Collapse toggle — only when the rail width is user-controllable (desktop) */}
      {onToggleCollapse && (collapsed ? (
        <Tooltip
          id="nav-rail-collapse-toggle"
          content={t`Expand sidebar`}
          place="right"
          showOnTouch={false}
        >
          <button
            type="button"
            className="nav-rail__item nav-rail__item--collapsed"
            onClick={onToggleCollapse}
            aria-label={t`Expand sidebar`}
          >
            <Icon name="sidebar-left-expand" size="xl" />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          className="nav-rail__item nav-rail__item--expanded"
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
            <div className="nav-rail__user-hint">{t`Settings`}</div>
          </div>
        </button>
      )}
    </nav>
  );
};

export default NavRail;
