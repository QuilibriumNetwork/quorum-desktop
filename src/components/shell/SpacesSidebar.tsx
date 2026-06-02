import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { Icon, Tooltip } from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaces } from '../../hooks';
import { useSpaceUnreadCounts } from '../../hooks/business/messages';
import { useShellState } from './useShellState';
import './SpacesSidebar.scss';

const LAST_SPACE_KEY = 'lastSpaceId';
const LAST_CHANNEL_KEY = 'lastChannelId';

/**
 * Spaces sidebar — minimal first pass (step 8).
 *
 * Renders a flat list of the user's spaces with the active row highlighted.
 * Clicking a space navigates to its default channel and updates sessionStorage
 * so the rail's Spaces button can return the user to the same place next click.
 *
 * Deferred for step 8b polish (not yet implemented):
 *  - folders + DnD reordering (reuse useFolderDragAndDrop / FolderContainer)
 *  - timestamps + last message previews
 *  - member count via useSpaceMembers
 *  - unread + mention badges with full styling
 *  - hide-muted-spaces filter
 *  - "+" header button wired to AddSpaceModal (currently no-op)
 */
interface SpacesSidebarProps {
  onAddSpace: () => void;
  forceExpanded?: boolean;
}

export const SpacesSidebar: React.FunctionComponent<SpacesSidebarProps> = ({ onAddSpace, forceExpanded }) => {
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId: string }>();
  const { data: spaces = [] } = useSpaces({});
  const spaceUnreadCounts = useSpaceUnreadCounts({ spaces });
  const { sidebarCollapsed, toggleSidebarCollapsed, viewport } = useShellState();
  const showCollapseToggle = viewport === 'desktop';
  const renderCollapsed = sidebarCollapsed && !forceExpanded;

  const handleRowClick = (
    spaceId: string,
    defaultChannelId: string | undefined
  ) => {
    const channelId = defaultChannelId || 'general';
    sessionStorage.setItem(LAST_SPACE_KEY, spaceId);
    sessionStorage.setItem(LAST_CHANNEL_KEY, channelId);
    navigate(`/spaces/${spaceId}/${channelId}`);
  };

  if (renderCollapsed) {
    return (
      <div className="spaces-sidebar spaces-sidebar--collapsed">
        <div className="spaces-sidebar__header spaces-sidebar__header--collapsed">
          {showCollapseToggle && (
            <button
              type="button"
              className="spaces-sidebar__action"
              aria-label={t`Expand sidebar`}
              onClick={toggleSidebarCollapsed}
            >
              <Icon name="sidebar-left-expand" size="md" />
            </button>
          )}
        </div>
        <div className="spaces-sidebar__list">
          {spaces.map((space) => {
            const unread = spaceUnreadCounts[space.spaceId] || 0;
            const active = space.spaceId === currentSpaceId;
            return (
              <Tooltip
                key={space.spaceId}
                id={`spaces-sidebar-collapsed-${space.spaceId}`}
                content={space.spaceName}
                place="right"
                showOnTouch={false}
              >
                <button
                  type="button"
                  className={`spaces-sidebar__strip-row ${active ? 'spaces-sidebar__strip-row--active' : ''}`}
                  onClick={() => handleRowClick(space.spaceId, space.defaultChannelId)}
                  aria-label={space.spaceName}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className="spaces-sidebar__strip-avatar">
                    <SpaceIcon
                      spaceId={space.spaceId}
                      spaceName={space.spaceName}
                      iconUrl={space.iconUrl}
                      notifs={false}
                      selected={false}
                      size="regular"
                      noTooltip
                      noToggle
                    />
                    {unread > 0 && <span className="spaces-sidebar__strip-unread-dot" />}
                  </div>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="spaces-sidebar">
      <div className="spaces-sidebar__header">
        <span className="spaces-sidebar__title">{t`Spaces`}</span>
        <button
          type="button"
          className="spaces-sidebar__action"
          aria-label={t`Add a space`}
          onClick={onAddSpace}
        >
          <Icon name="plus" size="md" />
        </button>
        {showCollapseToggle && (
          <button
            type="button"
            className="spaces-sidebar__action"
            aria-label={t`Collapse sidebar`}
            onClick={toggleSidebarCollapsed}
          >
            <Icon name="sidebar-left-collapse" size="md" />
          </button>
        )}
      </div>

      <div className="spaces-sidebar__list">
        {spaces.map((space) => {
          const unread = spaceUnreadCounts[space.spaceId] || 0;
          const active = space.spaceId === currentSpaceId;
          return (
            <button
              key={space.spaceId}
              type="button"
              className={`spaces-sidebar__row ${active ? 'spaces-sidebar__row--active' : ''}`}
              onClick={() => handleRowClick(space.spaceId, space.defaultChannelId)}
              aria-current={active ? 'page' : undefined}
            >
              <SpaceIcon
                spaceId={space.spaceId}
                spaceName={space.spaceName}
                iconUrl={space.iconUrl}
                notifs={unread > 0}
                selected={false}
                size="regular"
                noTooltip
                noToggle
              />
              <div className="spaces-sidebar__row-meta">
                <div className="spaces-sidebar__row-name">{space.spaceName}</div>
              </div>
              {unread > 0 && (
                <span className="spaces-sidebar__row-badge">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SpacesSidebar;
