import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import ExpandableNavMenu from './ExpandableNavMenu';
import SpaceButton from './SpaceButton';
import SpaceIcon from './SpaceIcon';
import FolderButton from './FolderButton';
import FolderContainer from './FolderContainer';
import FolderContextMenu from './FolderContextMenu';
import { t } from '@lingui/core/macro';
import { useModals } from '../context/ModalProvider';
import { NavItem } from '../../db/messages';
import { DragStateProvider, useDragStateContext } from '../../context/DragStateContext';
import {
  useSpaces,
  useConfig,
  useSpaceOrdering,
  useSpaceDragAndDrop,
  useFolderStates,
  useNavItems,
  useFolderDragAndDrop,
} from '../../hooks';
import { useDeleteFolder } from '../../hooks/business/folders';
import { useSpaceMentionCounts } from '../../hooks/business/mentions';
import { useSpaceReplyCounts } from '../../hooks/business/replies';
import {
  useSpaceUnreadCounts,
  useDirectMessageUnreadCount,
} from '../../hooks/business/messages';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import './NavMenu.scss';

type NavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

// Context menu state type
interface ContextMenuState {
  folder: (NavItem & { type: 'folder' }) | null;
  position: { x: number; y: number };
}

const NavMenuContent: React.FC<NavMenuProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = usePasskeysContext();
  const { data: spaces } = useSpaces({});
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo!.address,
  });
  const { navMenuOpen, isDesktop } = useResponsiveLayoutContext();
  const { openFolderEditor } = useModals();
  const { deleteFolder } = useDeleteFolder();

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
    folder: null,
    position: { x: 0, y: 0 },
  });

  const handleContextMenu = React.useCallback(
    (folder: NavItem & { type: 'folder' }, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        folder,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );

  const closeContextMenu = React.useCallback(() => {
    setContextMenu({ folder: null, position: { x: 0, y: 0 } });
  }, []);

  const handleOpenFolderSettings = React.useCallback(() => {
    if (contextMenu.folder) {
      openFolderEditor(contextMenu.folder.id);
    }
    closeContextMenu();
  }, [contextMenu.folder, openFolderEditor, closeContextMenu]);

  const handleDeleteFolder = React.useCallback(async () => {
    const folder = contextMenu.folder;
    if (!folder) return;

    closeContextMenu();
    await deleteFolder(folder.id);
  }, [contextMenu.folder, closeContextMenu, deleteFolder]);

  // Check if config has items (new format) or just spaceIds (legacy)
  const hasItems = config?.items && config.items.length > 0;

  // Legacy: Use old space ordering hook when no items
  const { mappedSpaces, setMappedSpaces } = useSpaceOrdering(spaces, config);
  const _legacyDrag = useSpaceDragAndDrop({
    mappedSpaces,
    setMappedSpaces,
    config,
  });

  // New: Folder-aware drag and drop (handles migration from legacy format)
  const folderDrag = useFolderDragAndDrop({
    config,
    onFolderCreated: openFolderEditor,
  });

  // Always use folder drag - it handles both legacy and new formats via migrateToItems
  const { handleDragStart, handleDragMove, handleDragEnd, sensors } = folderDrag;

  // New: Use nav items hook for folders support
  const { navItems, allSpaces } = useNavItems(spaces, config);
  const { isExpanded, toggleFolder } = useFolderStates();
  const { activeItem } = useDragStateContext();

  // Use allSpaces from navItems if available, otherwise fall back to mappedSpaces
  const spacesForCounts = hasItems ? allSpaces : mappedSpaces;

  // Get mention and reply counts for all spaces
  const spaceMentionCounts = useSpaceMentionCounts({ spaces: spacesForCounts });
  const spaceReplyCounts = useSpaceReplyCounts({ spaces: spacesForCounts });

  // Get unread message counts for all spaces
  const spaceUnreadCounts = useSpaceUnreadCounts({ spaces: spacesForCounts });

  // Get total unread direct message conversations count
  const dmUnreadCount = useDirectMessageUnreadCount();

  // Hide NavMenu below 1024px when navMenuOpen is false
  const navMenuStyle: React.CSSProperties = {};
  if (!isDesktop && !navMenuOpen) {
    navMenuStyle.transform = 'translateX(-100%)';
    navMenuStyle.transition = 'transform 0.3s ease-in-out';
  } else if (!isDesktop) {
    navMenuStyle.transition = 'transform 0.3s ease-in-out';
  }

  return (
    <header
      className={
        //@ts-ignore
        window.electron ? 'electron' : ''
      }
      style={navMenuStyle}
    >
      {
        //@ts-ignore
        window.electron ? <div className="p-3"></div> : <></>
      }
      <div className="nav-menu-logo">
        <div
          role="link"
          tabIndex={0}
          className="block cursor-pointer"
          onClick={() => {
            const lastAddress = sessionStorage.getItem('lastDmAddress');
            navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const lastAddress = sessionStorage.getItem('lastDmAddress');
              navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
            }
          }}
        >
          <SpaceIcon
            notifs={dmUnreadCount > 0}
            size="regular"
            selected={location.pathname.startsWith('/messages')}
            spaceName={t`Direct Messages`}
            iconUrl="/quorum-symbol-bg-blue.png"
            spaceId="direct-messages"
            highlightedTooltip={true}
          />
        </div>
      </div>
      <div className="nav-menu-spaces grow">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          {hasItems ? (
            // New format: render nav items (spaces and folders)
            <SortableContext items={navItems.map((ni) => ni.item.id)}>
              {navItems.map((navItem) => {
                if (navItem.item.type === 'space') {
                  const space = allSpaces.find((s) => s.spaceId === navItem.item.id);
                  if (!space) return null;
                  const mentionCount = spaceMentionCounts[space.spaceId] || 0;
                  const replyCount = spaceReplyCounts[space.spaceId] || 0;
                  const unreadCount = spaceUnreadCounts[space.spaceId] || 0;
                  const totalCount = mentionCount + replyCount;
                  return (
                    <SpaceButton
                      key={space.spaceId}
                      space={{ ...space, notifs: unreadCount }}
                      mentionCount={totalCount > 0 ? totalCount : undefined}
                    />
                  );
                } else if (navItem.item.type === 'folder' && navItem.spaces) {
                  const folder = navItem.item;
                  // Add unread counts to spaces
                  const spacesWithNotifs = navItem.spaces.map((space) => ({
                    ...space,
                    notifs: spaceUnreadCounts[space.spaceId] || 0,
                  }));
                  // Compute mention counts for spaces in folder
                  const folderMentionCounts: Record<string, number> = {};
                  for (const space of navItem.spaces) {
                    const mentionCount = spaceMentionCounts[space.spaceId] || 0;
                    const replyCount = spaceReplyCounts[space.spaceId] || 0;
                    folderMentionCounts[space.spaceId] = mentionCount + replyCount;
                  }
                  return (
                    <FolderContainer
                      key={folder.id}
                      folder={folder}
                      spaces={spacesWithNotifs}
                      isExpanded={isExpanded(folder.id)}
                      onToggleExpand={() => toggleFolder(folder.id)}
                      onContextMenu={(e) => handleContextMenu(folder, e)}
                      onEdit={() => openFolderEditor(folder.id)}
                      spaceMentionCounts={folderMentionCounts}
                    />
                  );
                }
                return null;
              })}
            </SortableContext>
          ) : (
            // Legacy format: render flat list of spaces
            <SortableContext items={mappedSpaces}>
              {mappedSpaces.map((space) => {
                const mentionCount = spaceMentionCounts[space.spaceId] || 0;
                const replyCount = spaceReplyCounts[space.spaceId] || 0;
                const unreadCount = spaceUnreadCounts[space.spaceId] || 0;
                const totalCount = mentionCount + replyCount;
                return (
                  <SpaceButton
                    key={space.spaceId}
                    space={{ ...space, notifs: unreadCount }}
                    mentionCount={totalCount > 0 ? totalCount : undefined}
                  />
                );
              })}
            </SortableContext>
          )}

          {/* DragOverlay renders a floating ghost copy - can move freely outside NavMenu */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeItem ? (
              <div className="drag-overlay-ghost">
                {activeItem.type === 'space' ? (
                  (() => {
                    const space = allSpaces.find((s) => s.spaceId === activeItem.id);
                    if (!space) return null;
                    return (
                      <SpaceIcon
                        notifs={false}
                        selected={false}
                        size="regular"
                        iconUrl={space.iconUrl}
                        spaceName={space.spaceName}
                        spaceId={space.spaceId}
                        noTooltip
                      />
                    );
                  })()
                ) : (
                  (() => {
                    const folderItem = navItems.find(
                      (ni) => ni.item.type === 'folder' && ni.item.id === activeItem.id
                    );
                    if (!folderItem || folderItem.item.type !== 'folder') return null;
                    return (
                      <FolderButton
                        folder={folderItem.item}
                        hasUnread={false}
                      />
                    );
                  })()
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <div className="expanded-nav-buttons-container">
        <ExpandableNavMenu {...props} />
      </div>

      {/* Folder context menu */}
      {contextMenu.folder && (
        <FolderContextMenu
          folder={contextMenu.folder}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onOpenSettings={handleOpenFolderSettings}
          onDelete={handleDeleteFolder}
        />
      )}

    </header>
  );
};

const NavMenu: React.FC<NavMenuProps> = (props) => {
  return (
    <DragStateProvider>
      <NavMenuContent {...props} />
    </DragStateProvider>
  );
};

export default NavMenu;
