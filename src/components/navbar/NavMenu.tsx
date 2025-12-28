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
import ContextMenu, { MenuItem } from '../ui/ContextMenu';
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
import { useSpaceLeaving } from '../../hooks/business/spaces/useSpaceLeaving';
import { useChannelMute } from '../../hooks/business/channels';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useMessageDB } from '../context/useMessageDB';
import './NavMenu.scss';

type NavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

// Context menu state types
interface FolderContextMenuState {
  folder: (NavItem & { type: 'folder' }) | null;
  position: { x: number; y: number };
}

interface SpaceContextMenuState {
  spaceId: string | null;
  spaceName: string;
  iconUrl?: string;
  isOwner: boolean;
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

  // Folder context menu state
  const [folderContextMenu, setFolderContextMenu] = React.useState<FolderContextMenuState>({
    folder: null,
    position: { x: 0, y: 0 },
  });

  // Space context menu state
  const [spaceContextMenu, setSpaceContextMenu] = React.useState<SpaceContextMenuState>({
    spaceId: null,
    spaceName: '',
    iconUrl: undefined,
    isOwner: false,
    position: { x: 0, y: 0 },
  });

  const { messageDB } = useMessageDB();
  const { leaveSpace } = useSpaceLeaving();

  // Channel mute settings for the currently selected space in context menu
  const { showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute } = useChannelMute({
    spaceId: spaceContextMenu.spaceId || '',
  });

  // Folder context menu handlers
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

  const closeFolderContextMenu = React.useCallback(() => {
    setFolderContextMenu({ folder: null, position: { x: 0, y: 0 } });
  }, []);

  const handleOpenFolderSettings = React.useCallback(() => {
    if (folderContextMenu.folder) {
      openFolderEditor(folderContextMenu.folder.id);
    }
    closeFolderContextMenu();
  }, [folderContextMenu.folder, openFolderEditor, closeFolderContextMenu]);

  const handleDeleteFolder = React.useCallback(async () => {
    const folder = folderContextMenu.folder;
    if (!folder) return;

    closeFolderContextMenu();
    await deleteFolder(folder.id);
  }, [folderContextMenu.folder, closeFolderContextMenu, deleteFolder]);

  // Get folder context menu items
  const getFolderContextMenuItems = React.useCallback((): MenuItem[] => {
    if (!folderContextMenu.folder) return [];

    return [
      {
        id: 'settings',
        icon: 'settings',
        label: t`Edit Folder`,
        onClick: handleOpenFolderSettings,
      },
      {
        id: 'delete',
        icon: 'trash',
        label: t`Delete Folder`,
        confirmLabel: t`Confirm Delete`,
        danger: true,
        onClick: handleDeleteFolder,
      },
    ];
  }, [folderContextMenu.folder, handleOpenFolderSettings, handleDeleteFolder]);

  // Space context menu handlers
  const handleSpaceContextMenu = React.useCallback(
    async (spaceId: string, spaceName: string, iconUrl: string | undefined, e: React.MouseEvent) => {
      e.preventDefault();
      // Check if user is owner of this space by checking for owner key
      let isOwner = false;
      try {
        const ownerKey = await messageDB.getSpaceKey(spaceId, 'owner');
        isOwner = !!ownerKey;
      } catch {
        isOwner = false;
      }
      setSpaceContextMenu({
        spaceId,
        spaceName,
        iconUrl,
        isOwner,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [messageDB]
  );

  const closeSpaceContextMenu = React.useCallback(() => {
    setSpaceContextMenu({
      spaceId: null,
      spaceName: '',
      iconUrl: undefined,
      isOwner: false,
      position: { x: 0, y: 0 },
    });
  }, []);

  const { openSpaceEditor } = useModals();

  // Get space context menu items based on ownership
  const getSpaceContextMenuItems = React.useCallback((): MenuItem[] => {
    if (!spaceContextMenu.spaceId) return [];

    const items: MenuItem[] = [
      {
        id: 'account',
        icon: 'user',
        label: t`My Account`,
        onClick: () => openSpaceEditor(spaceContextMenu.spaceId!, 'account'),
      },
      {
        id: 'toggle-muted-channels',
        icon: showMutedChannels ? 'eye-off' : 'eye',
        label: showMutedChannels ? t`Hide Muted Channels` : t`Show Muted Channels`,
        onClick: () => toggleShowMutedChannels(),
      },
      {
        id: 'toggle-space-mute',
        icon: isSpaceMuted ? 'bell' : 'bell-off',
        label: isSpaceMuted ? t`Unmute Space` : t`Mute Space`,
        onClick: () => toggleSpaceMute(),
      },
    ];

    if (spaceContextMenu.isOwner) {
      items.push(
        {
          id: 'settings',
          icon: 'settings',
          label: t`Space Settings`,
          onClick: () => openSpaceEditor(spaceContextMenu.spaceId!, 'general'),
          separator: true, // Separate owner options from user options
        },
        {
          id: 'invites',
          icon: 'user-plus',
          label: t`Invite Members`,
          onClick: () => openSpaceEditor(spaceContextMenu.spaceId!, 'invites'),
        },
        {
          id: 'roles',
          icon: 'shield',
          label: t`Manage Roles`,
          onClick: () => openSpaceEditor(spaceContextMenu.spaceId!, 'roles'),
        }
      );
    } else {
      items.push({
        id: 'leave',
        icon: 'logout',
        label: t`Leave Space`,
        danger: true,
        confirmLabel: t`Confirm Leave`,
        separator: true, // Separate leave from user options
        onClick: () => {
          if (spaceContextMenu.spaceId) {
            leaveSpace(spaceContextMenu.spaceId);
          }
        },
      });
    }

    return items;
  }, [spaceContextMenu.spaceId, spaceContextMenu.isOwner, openSpaceEditor, leaveSpace, showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute]);

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
                      onContextMenu={(e) => handleSpaceContextMenu(space.spaceId, space.spaceName, space.iconUrl, e)}
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
                      onContextMenu={(e) => handleFolderContextMenu(folder, e)}
                      onSpaceContextMenu={handleSpaceContextMenu}
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
                    onContextMenu={(e) => handleSpaceContextMenu(space.spaceId, space.spaceName, space.iconUrl, e)}
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
      {folderContextMenu.folder && (
        <ContextMenu
          header={{
            type: 'folder',
            icon: folderContextMenu.folder.icon || 'folder',
            iconVariant: folderContextMenu.folder.iconVariant || 'outline',
            iconColor: folderContextMenu.folder.color || 'default',
            name: folderContextMenu.folder.name,
          }}
          items={getFolderContextMenuItems()}
          position={folderContextMenu.position}
          onClose={closeFolderContextMenu}
        />
      )}

      {/* Space context menu */}
      {spaceContextMenu.spaceId && (
        <ContextMenu
          header={{
            type: 'space',
            spaceId: spaceContextMenu.spaceId,
            spaceName: spaceContextMenu.spaceName,
            iconUrl: spaceContextMenu.iconUrl,
          }}
          items={getSpaceContextMenuItems()}
          position={spaceContextMenu.position}
          onClose={closeSpaceContextMenu}
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
