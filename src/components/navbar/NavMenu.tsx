import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { useDmReadState } from '../../context/DmReadStateContext';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import ExpandableNavMenu from './ExpandableNavMenu';
import SpaceButton from './SpaceButton';
import SpaceIcon from './SpaceIcon';
import FolderButton from './FolderButton';
import { Icon, Tooltip } from '../primitives';
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
import { useSpaceTagStartupRefresh } from '../../hooks/business/spaces/useSpaceTagStartupRefresh';
import { useChannelMute } from '../../hooks/business/channels';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useMessageDB } from '../context/useMessageDB';
import { hapticLight, hapticMedium } from '../../utils/haptic';
import { useLongPressWithDefaults } from '../../hooks/useLongPress';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { isTouchDevice } from '../../utils/platform';
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
  hasNotifications: boolean;
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
  const { isContextMenuOpen, setIsContextMenuOpen } = useDragStateContext();

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
    hasNotifications: false,
  });

  // DM context menu state
  const [dmContextMenuPosition, setDmContextMenuPosition] = React.useState<{ x: number; y: number } | null>(null);

  const { messageDB } = useMessageDB();
  const { leaveSpace } = useSpaceLeaving();
  const queryClient = useQueryClient();

  // On startup: re-broadcast profile if space tag changed, or clear if tag no longer exists
  useSpaceTagStartupRefresh({ spaces, config });

  // DM read state context for immediate UI updates on "mark all as read"
  const { markAllAsRead } = useDmReadState();

  // Get total unread direct message conversations count (used for context menu visibility)
  const dmUnreadCount = useDirectMessageUnreadCount();

  // Channel mute settings for the currently selected space in context menu
  const { showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute } = useChannelMute({
    spaceId: spaceContextMenu.spaceId || '',
  });

  // Folder context menu handlers
  const handleFolderContextMenu = React.useCallback(
    (folder: NavItem & { type: 'folder' }, e: React.MouseEvent) => {
      e.preventDefault();
      setIsContextMenuOpen(true);
      setFolderContextMenu({
        folder,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [setIsContextMenuOpen]
  );

  const closeFolderContextMenu = React.useCallback(() => {
    setFolderContextMenu({ folder: null, position: { x: 0, y: 0 } });
    setIsContextMenuOpen(false);
  }, [setIsContextMenuOpen]);

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
    async (
      spaceId: string,
      spaceName: string,
      iconUrl: string | undefined,
      e: React.MouseEvent,
      hasNotifications: boolean
    ) => {
      e.preventDefault();
      setIsContextMenuOpen(true);
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
        hasNotifications,
      });
    },
    [messageDB, setIsContextMenuOpen]
  );

  const closeSpaceContextMenu = React.useCallback(() => {
    setSpaceContextMenu({
      spaceId: null,
      spaceName: '',
      iconUrl: undefined,
      isOwner: false,
      position: { x: 0, y: 0 },
      hasNotifications: false,
    });
    setIsContextMenuOpen(false);
  }, [setIsContextMenuOpen]);

  const { openSpaceEditor } = useModals();

  // Get space context menu items based on ownership
  // Note: handleMarkSpaceAsRead is defined later but will be available at call time
  const getSpaceContextMenuItems = React.useCallback(
    (markSpaceAsRead: () => Promise<void>): MenuItem[] => {
      if (!spaceContextMenu.spaceId) return [];

      const items: MenuItem[] = [];

      items.push(
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
        }
      );

      // Add Mark All as Read after mute options (no separator above)
      if (spaceContextMenu.hasNotifications) {
        items.push({
          id: 'mark-all-read',
          icon: 'check',
          label: t`Mark All as Read`,
          onClick: markSpaceAsRead,
        });
      }

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
  }, [spaceContextMenu.spaceId, spaceContextMenu.isOwner, spaceContextMenu.hasNotifications, openSpaceEditor, leaveSpace, showMutedChannels, toggleShowMutedChannels, isSpaceMuted, toggleSpaceMute]);

  // DM context menu handlers - only show if there are unread messages
  const handleDmContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Only show context menu if there are unread DMs
      if (dmUnreadCount > 0) {
        setIsContextMenuOpen(true);
        setDmContextMenuPosition({ x: e.clientX, y: e.clientY });
      }
    },
    [setIsContextMenuOpen, dmUnreadCount]
  );

  const closeDmContextMenu = React.useCallback(() => {
    setDmContextMenuPosition(null);
    setIsContextMenuOpen(false);
  }, [setIsContextMenuOpen]);

  const handleMarkAllDmsRead = React.useCallback(async () => {
    // Immediately update UI via context (triggers re-render of all consumers)
    const now = markAllAsRead();

    // Get all DM conversations and save read timestamps to DB in background
    const { conversations } = await messageDB.getConversations({ type: 'direct' });
    for (const conv of conversations) {
      if ((conv.lastReadTimestamp ?? 0) < conv.timestamp) {
        await messageDB.saveReadTime({
          conversationId: conv.conversationId,
          lastMessageTimestamp: now,
        });
      }
    }
  }, [messageDB, markAllAsRead]);

  const getDmContextMenuItems = React.useCallback((): MenuItem[] => {
    return [
      {
        id: 'mark-all-read',
        icon: 'check',
        label: t`Mark All as Read`,
        onClick: handleMarkAllDmsRead,
      },
    ];
  }, [handleMarkAllDmsRead]);

  // DM icon long press for touch devices
  const isTouch = isTouchDevice();
  const dmTouchPos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const dmLongPressHandlers = useLongPressWithDefaults({
    delay: TOUCH_INTERACTION_TYPES.STANDARD.delay,
    threshold: TOUCH_INTERACTION_TYPES.STANDARD.threshold,
    onLongPress: () => {
      // Only show context menu if there are unread DMs
      if (dmUnreadCount > 0) {
        hapticMedium();
        setIsContextMenuOpen(true);
        setDmContextMenuPosition(dmTouchPos.current);
      }
    },
    onTap: () => {
      hapticLight();
      const lastAddress = sessionStorage.getItem('lastDmAddress');
      navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
    },
    shouldPreventDefault: true,
  });

  // Wrap touch start to capture position for context menu
  const handleDmTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dmTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    dmLongPressHandlers.onTouchStart(e);
  }, [dmLongPressHandlers]);

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

  // Handler for marking all messages in a space as read
  const handleMarkSpaceAsRead = React.useCallback(async () => {
    if (!spaceContextMenu.spaceId) return;

    const spaceId = spaceContextMenu.spaceId;
    const now = Date.now();

    // Get all channel IDs for this space
    const allSpacesList = hasItems ? allSpaces : mappedSpaces;
    const space = allSpacesList.find((s) => s.spaceId === spaceId);
    if (!space) return;

    const channelIds = space.groups.flatMap((g) => g.channels.map((c) => c.channelId));

    // Save read time for each channel
    for (const channelId of channelIds) {
      await messageDB.saveReadTime({
        conversationId: `${spaceId}/${channelId}`,
        lastMessageTimestamp: now,
      });
    }

    // Invalidate caches to trigger refetch
    // Space-level counts (for SpaceIcon indicators)
    queryClient.invalidateQueries({ queryKey: ['mention-counts', 'space'] });
    queryClient.invalidateQueries({ queryKey: ['reply-counts', 'space'] });
    queryClient.invalidateQueries({ queryKey: ['unread-counts', 'space'] });
    // Channel-level counts (for channel list indicators)
    queryClient.invalidateQueries({ queryKey: ['mention-counts', 'channel', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['reply-counts', 'channel', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['unread-counts', 'channel', spaceId] });
    // NotificationPanel data
    queryClient.invalidateQueries({ queryKey: ['mention-notifications', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['reply-notifications', spaceId] });
    // Conversation data (for read timestamps)
    queryClient.invalidateQueries({ queryKey: ['conversation'] });

    closeSpaceContextMenu();
  }, [spaceContextMenu.spaceId, hasItems, allSpaces, mappedSpaces, messageDB, queryClient, closeSpaceContextMenu]);

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
      aria-label={t`Main navigation`}
    >
      {
        //@ts-ignore
        window.electron ? <div className="p-3"></div> : <></>
      }
      <div className="nav-menu-logo">
        {(() => {
          const dmIconContent = (
            <div className="relative z-[999]">
              <div
                className={`space-icon-toggle ${
                  location.pathname.startsWith('/messages')
                    ? 'space-icon-toggle--selected'
                    : dmUnreadCount > 0
                      ? 'space-icon-toggle--unread'
                      : ''
                }`}
              />
              <div
                className={`${location.pathname.startsWith('/messages') ? 'space-icon-selected' : 'space-icon'} dm-icon`}
              >
                <Icon name="message" size="2xl" />
              </div>
              {dmUnreadCount > 0 && (
                <span className="space-icon-mention-bubble">
                  {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                </span>
              )}
            </div>
          );

          // Touch: use long press handlers (tap navigates, long press opens context menu)
          // Desktop: use click + right-click
          const dmIconElement = isTouch ? (
            <div
              role="link"
              tabIndex={0}
              className={`block cursor-pointer ${dmLongPressHandlers.className || ''}`}
              style={dmLongPressHandlers.style}
              onTouchStart={handleDmTouchStart}
              onTouchMove={dmLongPressHandlers.onTouchMove}
              onTouchEnd={dmLongPressHandlers.onTouchEnd}
              onContextMenu={dmLongPressHandlers.onContextMenu}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const lastAddress = sessionStorage.getItem('lastDmAddress');
                  navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
                }
              }}
            >
              {dmIconContent}
            </div>
          ) : (
            <div
              role="link"
              tabIndex={0}
              className="block cursor-pointer"
              onClick={() => {
                const lastAddress = sessionStorage.getItem('lastDmAddress');
                navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
              }}
              onContextMenu={handleDmContextMenu}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const lastAddress = sessionStorage.getItem('lastDmAddress');
                  navigate(lastAddress ? `/messages/${lastAddress}` : '/messages');
                }
              }}
            >
              {dmIconContent}
            </div>
          );

          return isContextMenuOpen ? (
            dmIconElement
          ) : (
            <Tooltip
              id="dm-nav-icon"
              content={t`Direct Messages`}
              place="right"
              showOnTouch={false}
              className="tooltip-text-large"
            >
              {dmIconElement}
            </Tooltip>
          );
        })()}
      </div>
      <nav className="nav-menu-spaces grow" aria-label={t`Spaces`}>
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
                      onContextMenu={(e) => {
                        const hasNotifications = unreadCount > 0 || totalCount > 0;
                        handleSpaceContextMenu(space.spaceId, space.spaceName, space.iconUrl, e, hasNotifications);
                      }}
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
                    onContextMenu={(e) => {
                      const hasNotifications = unreadCount > 0 || totalCount > 0;
                      handleSpaceContextMenu(space.spaceId, space.spaceName, space.iconUrl, e, hasNotifications);
                    }}
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
      </nav>
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
          items={getSpaceContextMenuItems(handleMarkSpaceAsRead)}
          position={spaceContextMenu.position}
          onClose={closeSpaceContextMenu}
        />
      )}

      {/* DM context menu */}
      {dmContextMenuPosition && (
        <ContextMenu
          header={{
            type: 'dm',
            label: t`Direct Messages`,
          }}
          items={getDmContextMenuItems()}
          position={dmContextMenuPosition}
          onClose={closeDmContextMenu}
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
