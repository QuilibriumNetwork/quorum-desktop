import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import type { Space } from '@quilibrium/quorum-shared';
import { Button, Flex, Select, Tooltip } from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import { ListSearchInput } from '../ui';
import ContextMenu, { type MenuItem } from '../ui/ContextMenu';
import { SpacesSidebarRow } from './SpacesSidebarRow';
import { useSpaces } from '../../hooks';
import { useSpaceUnreadCounts } from '../../hooks/business/messages';
import {
  useMutedSpacesSet,
  useSpaceContextMenu,
  useSpaceFavorites,
} from '../../hooks/business/spaces';
import { useShellState } from './useShellState';
import './SpacesSidebar.scss';

// Dev-only stress-test injection for the joined-spaces list. Shares the same
// gate as the Discover screen mock (?spaces=N / debug_mock_spaces). Disabled in prod.
const ENABLE_MOCK_SPACES =
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  (localStorage?.getItem('debug_mock_spaces') === 'true' ||
    new URLSearchParams(window.location?.search || '').get('spaces') !== null);
const MOCK_SPACES_COUNT = parseInt(
  new URLSearchParams(
    typeof window !== 'undefined' ? window.location?.search || '' : ''
  ).get('spaces') ||
    (typeof window !== 'undefined'
      ? localStorage?.getItem('debug_mock_spaces_count') || ''
      : '') ||
    '30',
  10
);

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
  /** Opens the "Join a space" modal (paste invite link). */
  onAddSpace: () => void;
  /** Opens the "Create a space" modal (new space from scratch). */
  onCreateSpace: () => void;
  forceExpanded?: boolean;
}

export const SpacesSidebar: React.FunctionComponent<SpacesSidebarProps> = ({ onAddSpace, onCreateSpace, forceExpanded }) => {
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId: string }>();
  const { data: realSpaces = [] } = useSpaces({});

  // Dev-only: lazy-load and append mock joined spaces so the production bundle
  // never imports the mock module.
  const [mockUtils, setMockUtils] = React.useState<{
    generateMockJoinedSpaces: (count: number) => Space[];
  } | null>(null);
  React.useEffect(() => {
    if (ENABLE_MOCK_SPACES) {
      import('../../utils/mock')
        .then((utils) => setMockUtils(utils))
        .catch(() => setMockUtils(null));
    }
  }, []);
  const mockSpaces = React.useMemo<Space[]>(() => {
    return ENABLE_MOCK_SPACES && mockUtils
      ? mockUtils.generateMockJoinedSpaces(MOCK_SPACES_COUNT)
      : [];
  }, [mockUtils]);
  const spaces = React.useMemo<Space[]>(
    () => (mockSpaces.length > 0 ? [...realSpaces, ...mockSpaces] : realSpaces),
    [realSpaces, mockSpaces]
  );

  const realSpaceUnreadCounts = useSpaceUnreadCounts({ spaces });

  // Dev-only: deterministically tag a slice of mock spaces with unread counts so
  // the badge / dot / 99+ paths are all exercised. Three buckets: no unreads,
  // small count (1–9), and overflow (>99).
  const spaceUnreadCounts = React.useMemo<Record<string, number>>(() => {
    if (mockSpaces.length === 0) return realSpaceUnreadCounts;
    const overlay: Record<string, number> = { ...realSpaceUnreadCounts };
    for (let i = 0; i < mockSpaces.length; i++) {
      const bucket = i % 4;
      if (bucket === 0) continue; // no unreads
      if (bucket === 3) {
        overlay[mockSpaces[i].spaceId] = 100 + (i % 50); // 99+ overflow path
      } else {
        overlay[mockSpaces[i].spaceId] = (i % 9) + 1; // 1..9
      }
    }
    return overlay;
  }, [realSpaceUnreadCounts, mockSpaces]);
  const { sidebarCollapsed } = useShellState();
  const renderCollapsed = sidebarCollapsed && !forceExpanded;
  const { mutedSpacesSet } = useMutedSpacesSet();
  const { favoritesSet: favoriteSpacesSet } = useSpaceFavorites();
  const { openContextMenu: openRowContextMenu, contextMenu: rowContextMenu } = useSpaceContextMenu();

  // Search + filter: closing search clears both. The filter chip only appears
  // when at least one bucket (muted / favorites) has rows to show.
  type SpacesFilter = 'all' | 'muted' | 'favorites';
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [filter, setFilter] = React.useState<SpacesFilter>('all');
  const handleToggleSearch = React.useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchInput('');
        setFilter('all');
      }
      return !prev;
    });
  }, []);
  const handleFilterChange = React.useCallback((value: string | string[]) => {
    setFilter(value as SpacesFilter);
  }, []);

  const hasMutedSpaces = mutedSpacesSet.size > 0;
  const hasFavoriteSpaces = favoriteSpacesSet.size > 0;
  const hasAnyFilter = hasMutedSpaces || hasFavoriteSpaces;

  const filterOptions = React.useMemo(() => {
    const options: { value: string; label: string; icon?: string }[] = [
      { value: 'all', label: t`All`, icon: 'users-group' },
    ];
    if (hasFavoriteSpaces) options.push({ value: 'favorites', label: t`Favorites`, icon: 'star' });
    if (hasMutedSpaces) options.push({ value: 'muted', label: t`Muted`, icon: 'bell-off' });
    return options;
  }, [hasFavoriteSpaces, hasMutedSpaces]);

  // Reset the filter chip when its source bucket disappears (e.g. user unmutes
  // the last muted space while "Muted" is selected).
  React.useEffect(() => {
    if (filter === 'muted' && !hasMutedSpaces) setFilter('all');
    if (filter === 'favorites' && !hasFavoriteSpaces) setFilter('all');
  }, [filter, hasMutedSpaces, hasFavoriteSpaces]);

  const filteredSpaces = React.useMemo(() => {
    let list = spaces;
    if (filter === 'muted') {
      list = list.filter((s) => mutedSpacesSet.has(s.spaceId));
    } else if (filter === 'favorites') {
      list = list.filter((s) => favoriteSpacesSet.has(s.spaceId));
    }
    const q = searchInput.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => s.spaceName.toLowerCase().includes(q));
    }
    return list;
  }, [spaces, searchInput, filter, mutedSpacesSet, favoriteSpacesSet]);

  // "+" button context menu: anchored to the button's bounding rect so it
  // appears below the trigger regardless of how it was activated (click,
  // keyboard). ContextMenu auto-flips if it would overflow the viewport.
  const [addMenuPosition, setAddMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const handleOpenAddMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAddMenuPosition({ x: rect.left, y: rect.bottom + 4 });
  }, []);
  const handleCloseAddMenu = React.useCallback(() => setAddMenuPosition(null), []);
  const addMenuItems = React.useMemo<MenuItem[]>(
    () => [
      {
        id: 'join-space',
        icon: 'link',
        label: t`Join a space`,
        onClick: () => {
          handleCloseAddMenu();
          onAddSpace();
        },
      },
      {
        id: 'create-space',
        icon: 'plus',
        label: t`Create a space`,
        onClick: () => {
          handleCloseAddMenu();
          onCreateSpace();
        },
      },
    ],
    [onAddSpace, onCreateSpace, handleCloseAddMenu]
  );

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
      <div className="spaces-sidebar spaces-sidebar--collapsed list-bottom-fade">
        <div className="spaces-sidebar__header spaces-sidebar__header--collapsed" />
        <div className="spaces-sidebar__list list-fade-content">
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
    <div className="spaces-sidebar list-bottom-fade">
      <div className="sidebar-header">
        <span className="sidebar-header__title">{t`Spaces`}</span>
        <Button
          type="unstyled"
          iconName="search"
          iconSize="lg"
          iconOnly
          onClick={handleToggleSearch}
          className={`header-icon-button ${searchOpen ? 'active--accent' : ''}`}
          ariaLabel={t`Search spaces`}
        />
        {addMenuPosition ? (
          // Tooltip is unmounted while the context menu is open so the two
          // popovers don't overlap on top of each other.
          <Button
            type="secondary"
            iconName="plus"
            iconSize="lg"
            iconOnly
            onClick={handleOpenAddMenu}
            className="sidebar-header-action"
            ariaLabel={t`Add a space`}
          />
        ) : (
          <Tooltip
            id="spaces-add"
            content={t`Add a space`}
            place="bottom"
            showOnTouch={false}
          >
            <Button
              type="secondary"
              iconName="plus"
              iconSize="lg"
              iconOnly
              onClick={handleOpenAddMenu}
              className="sidebar-header-action"
              ariaLabel={t`Add a space`}
            />
          </Tooltip>
        )}
      </div>
      {addMenuPosition && (
        <ContextMenu
          items={addMenuItems}
          position={addMenuPosition}
          onClose={handleCloseAddMenu}
          width={200}
        />
      )}

      {searchOpen && (
        <div className="px-3.5 pt-2 pb-3">
          <Flex className="sidebar-search-row items-center">
            {hasAnyFilter && (
              <Select
                value={filter}
                onChange={handleFilterChange}
                options={filterOptions}
                compactMode={true}
                compactIcon="filter"
                size="small"
              />
            )}
            <div className="flex-1">
              <ListSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Space name`}
                variant="minimal"
                showSearchIcon={false}
              />
            </div>
          </Flex>
          {filteredSpaces.length === 0 && (filter !== 'all' || searchInput) && (
            <div className="text-xs text-subtle mt-2">
              {filter === 'favorites' ? (
                t`No favorite spaces`
              ) : filter === 'muted' ? (
                t`No muted spaces`
              ) : (
                t`No spaces found`
              )}
            </div>
          )}
        </div>
      )}

      <div className="spaces-sidebar__list">
        {filteredSpaces.map((space) => {
          const unread = spaceUnreadCounts[space.spaceId] || 0;
          const active = space.spaceId === currentSpaceId;
          return (
            <SpacesSidebarRow
              key={space.spaceId}
              space={space}
              active={active}
              unread={unread}
              isMuted={mutedSpacesSet.has(space.spaceId)}
              isFavorite={favoriteSpacesSet.has(space.spaceId)}
              onClick={() => handleRowClick(space.spaceId, space.defaultChannelId)}
              onContextMenu={(e) => {
                void openRowContextMenu({
                  spaceId: space.spaceId,
                  spaceName: space.spaceName,
                  iconUrl: space.iconUrl,
                  event: e,
                  hasNotifications: unread > 0,
                });
              }}
            />
          );
        })}
      </div>
      {rowContextMenu}
    </div>
  );
};

export default SpacesSidebar;
