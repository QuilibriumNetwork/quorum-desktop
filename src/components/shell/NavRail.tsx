import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Icon, Tooltip } from '../primitives';
import type { IconName } from '@quilibrium/quorum-shared';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useModalContext } from '../context/ModalProvider';
import { UserAvatar } from '../user/UserAvatar';
import { useDirectMessageUnreadCount } from '../../hooks/business/messages';
import './NavRail.scss';

type RailSectionId = 'dm' | 'spaces' | 'discover';

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
    id: 'discover',
    icon: 'compass',
    label: t`Discover`,
    route: '/discover/spaces',
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
  // Rebuild on every render so the Lingui `t` macro re-evaluates with the
  // current locale (dynamicActivate doesn't break i18n strings memoized with
  // an empty deps array).
  const items = buildItems();
  const user = usePasskeysContext();
  const dmUnreadCount = useDirectMessageUnreadCount();
  const { openUserSettings } = useModalContext();

  const displayName = user?.currentPasskeyInfo?.displayName || 'User';
  const userIcon = user?.currentPasskeyInfo?.pfpUrl;
  const userAddress = user?.currentPasskeyInfo?.address || '';

  // Compute active section from pathname.
  // /discover/* → "discover"; /spaces or /spaces/:id/:id → "spaces"; /messages → "dm".
  const activeId: RailSectionId | null = React.useMemo(() => {
    if (location.pathname.startsWith('/messages')) return 'dm';
    if (location.pathname.startsWith('/discover')) return 'discover';
    if (location.pathname.startsWith('/spaces')) return 'spaces';
    return null;
  }, [location.pathname]);

  const onItemClick = (item: RailItemConfig) => {
    if (item.id === 'dm') {
      // Preserve last-visited DM if available, matching legacy NavMenu behavior
      const lastAddress = sessionStorage.getItem('lastDmAddress');
      navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
      return;
    }
    if (item.id === 'spaces') {
      // If already inside a space, re-clicking the rail item returns to the
      // spaces list (sidebar shows all spaces, main shows empty hint).
      const insideSpace = /^\/spaces\/[^/]+\/[^/]+/.test(location.pathname);
      if (insideSpace) {
        navigate('/spaces');
        return;
      }
      // Otherwise, restore the last visited space + channel if we have one.
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
          const hasUnread = item.id === 'dm' && dmUnreadCount > 0;
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
                {hasUnread && (
                  <span className="icon-unread-dot" title={t`Unread direct messages`} />
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
