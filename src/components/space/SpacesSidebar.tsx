import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import type { Space } from '@quilibrium/quorum-shared';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Button, Icon, Tooltip, useTheme } from '../primitives';
import SpaceIcon from './SpaceIcon';
import { ListSearchInput } from '../ui';
import ContextMenu, { type MenuItem } from '../ui/ContextMenu';
import { SpacesSidebarRow } from './SpacesSidebarRow';
import { SpacesSidebarFolder } from './SpacesSidebarFolder';
import FolderButton from './FolderButton';
import { getFolderColorHex } from './IconPicker/types';
import { useSpaces } from '../../hooks';
import { useSpaceUnreadCounts } from '../../hooks/business/messages';
import { useSpaceMentionCounts } from '../../hooks/business/mentions';
import { useSpaceReplyCounts } from '../../hooks/business/replies';
import {
  useMutedSpacesSet,
  useSpaceContextMenu,
} from '../../hooks/business/spaces';
import { useNavItems } from '../../hooks/business/folders/useNavItems';
import { useFolderStates } from '../../hooks/business/folders/useFolderStates';
import { useFolderDragAndDrop } from '../../hooks/business/folders/useFolderDragAndDrop';
import { useDeleteFolder } from '../../hooks/business/folders';
import type { NavItem } from '../../db/messages';
import type { IconColor } from './IconPicker/types';
import { useConfig } from '../../hooks/queries/config';
import { useModals } from '../context/ModalProvider';
import { DragStateProvider, useOptionalDragStateContext } from '../../context/DragStateContext';
import { useShellState } from '../shell/useShellState';
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
 * Spaces sidebar — mounted by AppShell's Sidebar slot when the route is /spaces.
 *
 * Renders the user's spaces (folders interleaved with standalones via
 * `navItems`) with the active row highlighted. Clicking a space navigates to
 * its default channel and updates sessionStorage so the rail's Spaces button
 * can return the user to the same place next click.
 *
 * Owns the DragStateProvider + DndContext + SortableContext + DragOverlay
 * stack, the folder right-click context menu, and the per-space context menu
 * (via `useSpaceContextMenu`). Iterates `navItems` and dispatches to
 * `SpacesSidebarFolder` or `SpacesSidebarRow` per item type. In compact mode
 * (sidebar collapsed strip) the same components render their narrower layouts.
 */
interface SpacesSidebarProps {
  /** Opens the "Join a space" modal (paste invite link). */
  onAddSpace: () => void;
  /** Opens the "Create a space" modal (new space from scratch). */
  onCreateSpace: () => void;
  forceExpanded?: boolean;
}

export const SpacesSidebar: React.FunctionComponent<SpacesSidebarProps> = (props) => {
  // DragStateProvider must wrap everything that reads dnd state
  // (SpacesSidebarFolder, SpacesSidebarRow, useFolderDragAndDrop). Mounted here
  // so DM/Channels sidebars never see the provider.
  return (
    <DragStateProvider>
      <SpacesSidebarInner {...props} />
    </DragStateProvider>
  );
};

const SpacesSidebarInner: React.FunctionComponent<SpacesSidebarProps> = ({ onAddSpace, onCreateSpace, forceExpanded }) => {
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
  const spaceMentionCounts = useSpaceMentionCounts({ spaces });
  const spaceReplyCounts = useSpaceReplyCounts({ spaces });
  // Mentions + replies are merged for the badge — that's the "needs attention"
  // count distinct from generic unreads.
  const spaceMentionPlusReplyCounts = React.useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    const keys = new Set([...Object.keys(spaceMentionCounts), ...Object.keys(spaceReplyCounts)]);
    keys.forEach((spaceId) => {
      const total = (spaceMentionCounts[spaceId] || 0) + (spaceReplyCounts[spaceId] || 0);
      if (total > 0) result[spaceId] = total;
    });
    return result;
  }, [spaceMentionCounts, spaceReplyCounts]);

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
  const { openContextMenu: openRowContextMenu, contextMenu: rowContextMenu } = useSpaceContextMenu();

  // Folder + DnD wiring. Config drives navItems (folders interleaved with
  // standalone spaces). Folder-states keep expand/collapse in localStorage.
  // useFolderDragAndDrop handles all 9 drag scenarios + optimistic config save.
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const { data: config } = useConfig({ userAddress: userAddress || '' });
  const { navItems } = useNavItems(spaces, config);
  const { isExpanded, toggleFolder } = useFolderStates();
  const { openFolderEditor } = useModals();
  const dragState = useOptionalDragStateContext();
  const activeDragItem = dragState?.activeItem ?? null;

  const { handleDragStart, handleDragMove, handleDragEnd, sensors } = useFolderDragAndDrop({
    config,
    onFolderCreated: (folderId) => openFolderEditor(folderId),
  });

  // Folder right-click context menu: Edit Folder + Delete Folder.
  // Position follows the click coordinates.
  const { deleteFolder } = useDeleteFolder();
  const [folderContextMenu, setFolderContextMenu] = React.useState<{
    folder: (NavItem & { type: 'folder' }) | null;
    position: { x: number; y: number };
  }>({ folder: null, position: { x: 0, y: 0 } });
  const closeFolderContextMenu = React.useCallback(() => {
    setFolderContextMenu({ folder: null, position: { x: 0, y: 0 } });
  }, []);
  const handleFolderContextMenu = React.useCallback(
    (folder: NavItem & { type: 'folder' }, e: React.MouseEvent) => {
      e.preventDefault();
      setFolderContextMenu({
        folder,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );
  const folderContextMenuItems = React.useMemo<MenuItem[]>(() => {
    const f = folderContextMenu.folder;
    if (!f) return [];
    return [
      {
        id: 'edit',
        icon: 'settings',
        label: t`Edit Folder`,
        onClick: () => {
          openFolderEditor(f.id);
          closeFolderContextMenu();
        },
      },
      {
        id: 'delete',
        icon: 'trash',
        label: t`Delete Folder`,
        confirmLabel: t`Confirm Delete`,
        danger: true,
        onClick: async () => {
          closeFolderContextMenu();
          await deleteFolder(f.id);
        },
      },
    ];
  }, [folderContextMenu.folder, openFolderEditor, closeFolderContextMenu, deleteFolder]);

  // Sortable IDs flatten folders + standalone spaces in render order. SortableContext
  // needs this list so it can match dragging IDs to their position in the layout.
  const sortableIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const nav of navItems) {
      ids.push(nav.item.id);
      if (nav.item.type === 'folder' && nav.spaces) {
        for (const s of nav.spaces) ids.push(s.spaceId);
      }
    }
    return ids;
  }, [navItems]);

  // Flat view kicks in for any filter / search state. Folders don't make sense
  // when the list is filtered: showing partial folders would be confusing and
  // showing all folders would defeat the filter.

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const handleToggleSearch = React.useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) setSearchInput('');
      return !prev;
    });
  }, []);

  const filteredSpaces = React.useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return spaces;
    return spaces.filter((s) => s.spaceName.toLowerCase().includes(q));
  }, [spaces, searchInput]);

  // Folders are hidden when a search query is active.
  const isFlatView = searchInput.trim().length > 0;

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

  // Floating clone that follows the cursor during drag. Spaces show a row,
  // folders show their colored tile (collapsed strip) or tile + name + count
  // (expanded list) — same visual the user dragged from, so the ghost reads
  // as "the thing they grabbed."
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const renderDragOverlay = (variant: 'compact' | 'expanded') => {
    if (!activeDragItem) return null;

    if (activeDragItem.type === 'folder') {
      const nav = navItems.find(
        (n) => n.item.type === 'folder' && n.item.id === activeDragItem.id
      );
      if (!nav || nav.item.type !== 'folder') return null;
      const folder = nav.item;
      const folderSpaces = nav.spaces ?? [];
      const hasUnread = folderSpaces.some(
        (s) => (spaceUnreadCounts[s.spaceId] || 0) > 0
      );
      const mentionCount = folderSpaces.reduce(
        (sum, s) => sum + (spaceMentionPlusReplyCounts[s.spaceId] || 0),
        0
      );
      const folderColor = getFolderColorHex(folder.color, isDarkTheme);

      if (variant === 'compact') {
        return (
          <div
            className="spaces-sidebar__drag-overlay"
            style={{ ['--folder-color' as string]: folderColor } as React.CSSProperties}
          >
            <FolderButton
              folder={folder}
              hasUnread={hasUnread}
              mentionCount={mentionCount}
            />
          </div>
        );
      }

      return (
        <div
          className="spaces-sidebar__drag-overlay"
          style={{ ['--folder-color' as string]: folderColor } as React.CSSProperties}
        >
          <div className="folder-header folder-header--row">
            <div className="folder-header__icon">
              <FolderButton
                folder={folder}
                hasUnread={hasUnread}
                mentionCount={mentionCount}
                size="small"
              />
            </div>
            <div className="folder-header__meta">
              <div className="folder-header__name">{folder.name}</div>
              <div className="folder-header__count">
                <Icon name="user" size="sm" />
                <span>{folderSpaces.length}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Space
    const space = spaces.find((s) => s.spaceId === activeDragItem.id);
    if (!space) return null;
    return (
      <div className="spaces-sidebar__drag-overlay">
        <SpacesSidebarRow
          space={space}
          active={false}
          unread={spaceUnreadCounts[space.spaceId] || 0}
          mentionCount={spaceMentionPlusReplyCounts[space.spaceId] || 0}
          isMuted={mutedSpacesSet.has(space.spaceId)}
          compact={variant === 'compact'}
          onClick={() => {}}
        />
      </div>
    );
  };

  if (renderCollapsed) {
    return (
      <div className="spaces-sidebar spaces-sidebar--collapsed list-bottom-fade">
        <div className="spaces-sidebar__header spaces-sidebar__header--collapsed" />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="spaces-sidebar__list list-fade-content">
              {navItems.map((nav) => {
            if (nav.item.type === 'folder') {
              return (
                <SpacesSidebarFolder
                  key={nav.item.id}
                  folder={nav.item}
                  spaces={nav.spaces ?? []}
                  isExpanded={isExpanded(nav.item.id)}
                  collapsed
                  currentSpaceId={currentSpaceId}
                  spaceUnreadCounts={spaceUnreadCounts}
                  spaceMentionCounts={spaceMentionPlusReplyCounts}
                  mutedSpacesSet={mutedSpacesSet}
                  onToggleExpand={() => toggleFolder(nav.item.id)}
                  onEdit={() => openFolderEditor(nav.item.id)}
                  onSpaceClick={handleRowClick}
                  onContextMenu={(e) => handleFolderContextMenu(nav.item as NavItem & { type: 'folder' }, e)}
                  onSpaceContextMenu={(spaceId, spaceName, iconUrl, e, hasNotifications) => {
                    void openRowContextMenu({
                      spaceId,
                      spaceName,
                      iconUrl,
                      event: e,
                      hasNotifications,
                    });
                  }}
                />
              );
            }
            const space = spaces.find((s) => s.spaceId === nav.item.id);
            if (!space) return null;
            const unread = spaceUnreadCounts[space.spaceId] || 0;
            const mention = spaceMentionPlusReplyCounts[space.spaceId] || 0;
            const active = space.spaceId === currentSpaceId;
            return (
              <Tooltip
                key={space.spaceId}
                id={`spaces-sidebar-collapsed-${space.spaceId}`}
                content={space.spaceName}
                place="right"
                showOnTouch={false}
              >
                <SpacesSidebarRow
                  space={space}
                  active={active}
                  unread={unread}
                  mentionCount={mention}
                  isMuted={mutedSpacesSet.has(space.spaceId)}
                  compact
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
              </Tooltip>
            );
          })}
            </div>
          </SortableContext>
          <DragOverlay>{renderDragOverlay('compact')}</DragOverlay>
        </DndContext>
        {rowContextMenu}
        {folderContextMenu.folder && (
          <ContextMenu
            header={{
              type: 'folder',
              icon: folderContextMenu.folder.icon || 'folder',
              iconVariant: folderContextMenu.folder.iconVariant || 'outline',
              iconColor: (folderContextMenu.folder.color as IconColor) || 'default',
              name: folderContextMenu.folder.name,
            }}
            items={folderContextMenuItems}
            position={folderContextMenu.position}
            onClose={closeFolderContextMenu}
          />
        )}
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
          <div className="sidebar-search-row">
            <div className="flex-1">
              <ListSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Space name`}
                variant="minimal"
                showSearchIcon={false}
              />
            </div>
          </div>
          {filteredSpaces.length === 0 && searchInput && (
            <div className="text-xs text-subtle mt-2">
              {t`No spaces found`}
            </div>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="spaces-sidebar__list">
            {isFlatView ? (
              // Filter / search active: render a flat list, folders collapsed away.
              filteredSpaces.map((space) => {
                const unread = spaceUnreadCounts[space.spaceId] || 0;
                const mention = spaceMentionPlusReplyCounts[space.spaceId] || 0;
                const active = space.spaceId === currentSpaceId;
                return (
                  <SpacesSidebarRow
                    key={space.spaceId}
                    space={space}
                    active={active}
                    unread={unread}
                    mentionCount={mention}
                    isMuted={mutedSpacesSet.has(space.spaceId)}
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
              })
            ) : (
              navItems.map((nav) => {
                if (nav.item.type === 'folder') {
                  return (
                    <SpacesSidebarFolder
                      key={nav.item.id}
                      folder={nav.item}
                      spaces={nav.spaces ?? []}
                      isExpanded={isExpanded(nav.item.id)}
                      currentSpaceId={currentSpaceId}
                      spaceUnreadCounts={spaceUnreadCounts}
                      spaceMentionCounts={spaceMentionPlusReplyCounts}
                      mutedSpacesSet={mutedSpacesSet}
                          onToggleExpand={() => toggleFolder(nav.item.id)}
                      onEdit={() => openFolderEditor(nav.item.id)}
                      onSpaceClick={handleRowClick}
                      onContextMenu={(e) => handleFolderContextMenu(nav.item as NavItem & { type: 'folder' }, e)}
                      onSpaceContextMenu={(spaceId, spaceName, iconUrl, e, hasNotifications) => {
                        void openRowContextMenu({
                          spaceId,
                          spaceName,
                          iconUrl,
                          event: e,
                          hasNotifications,
                        });
                      }}
                    />
                  );
                }
                const space = spaces.find((s) => s.spaceId === nav.item.id);
                if (!space) return null;
                const unread = spaceUnreadCounts[space.spaceId] || 0;
                const mention = spaceMentionPlusReplyCounts[space.spaceId] || 0;
                const active = space.spaceId === currentSpaceId;
                return (
                  <SpacesSidebarRow
                    key={space.spaceId}
                    space={space}
                    active={active}
                    unread={unread}
                    mentionCount={mention}
                    isMuted={mutedSpacesSet.has(space.spaceId)}
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
              })
            )}
          </div>
        </SortableContext>
        <DragOverlay>{renderDragOverlay('expanded')}</DragOverlay>
      </DndContext>
      {rowContextMenu}
      {folderContextMenu.folder && (
        <ContextMenu
          header={{
            type: 'folder',
            icon: folderContextMenu.folder.icon || 'folder',
            iconVariant: folderContextMenu.folder.iconVariant || 'outline',
            iconColor: (folderContextMenu.folder.color as IconColor) || 'default',
            name: folderContextMenu.folder.name,
          }}
          items={folderContextMenuItems}
          position={folderContextMenu.position}
          onClose={closeFolderContextMenu}
        />
      )}
    </div>
  );
};

export default SpacesSidebar;
