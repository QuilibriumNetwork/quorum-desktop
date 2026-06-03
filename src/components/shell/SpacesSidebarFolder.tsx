import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import type { Space } from '@quilibrium/quorum-shared';
import { Icon, Tooltip, useTheme } from '../primitives';
import FolderButton from '../navbar/FolderButton';
import SpaceIcon from '../navbar/SpaceIcon';
import { useDragStateContext } from '../../context/DragStateContext';
import { getFolderColorHex, IconColor } from '../space/IconPicker/types';
import { NavItem } from '../../db/messages';
import { isTouchDevice } from '../../utils/platform';
import { hapticMedium } from '../../utils/haptic';
import { TOUCH_INTERACTION_TYPES } from '../../constants/touchInteraction';
import { SpacesSidebarRow } from './SpacesSidebarRow';

interface SpacesSidebarFolderProps {
  folder: NavItem & { type: 'folder' };
  spaces: Space[];
  isExpanded: boolean;
  /** Compact mode = 72px icon strip layout (rail-like). */
  collapsed?: boolean;
  currentSpaceId?: string;
  spaceUnreadCounts: Record<string, number>;
  mutedSpacesSet: Set<string>;
  onToggleExpand: () => void;
  onEdit: () => void;
  onSpaceClick: (spaceId: string, defaultChannelId: string | undefined) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onSpaceContextMenu?: (
    spaceId: string,
    spaceName: string,
    iconUrl: string | undefined,
    e: React.MouseEvent,
    hasNotifications: boolean
  ) => void;
}

/**
 * Folder render for the new SpacesSidebar — fork of navbar/FolderContainer
 * that renders nested rows via `SpacesSidebarRow` (two-line layout) instead
 * of `SpaceButton` (72px icon tile). DnD wiring, expand/collapse animation,
 * and touch long-press are preserved verbatim from the original.
 */
export const SpacesSidebarFolder: React.FC<SpacesSidebarFolderProps> = ({
  folder,
  spaces,
  isExpanded,
  collapsed = false,
  currentSpaceId,
  spaceUnreadCounts,
  mutedSpacesSet,
  onToggleExpand,
  onEdit,
  onSpaceClick,
  onContextMenu,
  onSpaceContextMenu,
}) => {
  const isTouch = isTouchDevice();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';

  // Long press for touch devices — opens editor.
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = React.useRef<{ x: number; y: number } | null>(null);
  const { threshold: MOVEMENT_THRESHOLD, delay: LONG_PRESS_DELAY } =
    TOUCH_INTERACTION_TYPES.DRAG_AND_DROP;

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTouch && e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        hapticMedium();
        onEdit();
        clearLongPressTimer();
      }, LONG_PRESS_DELAY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && longPressTimer.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > MOVEMENT_THRESHOLD) {
        clearLongPressTimer();
      }
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
  };

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: folder.id,
    data: { type: 'folder', targetId: folder.id },
  });

  React.useEffect(() => {
    if (isDragging) clearLongPressTimer();
  }, [isDragging]);

  const hasUnread = spaces.some((s) => (spaceUnreadCounts[s.spaceId] || 0) > 0);

  const { setIsDragging, dropTarget, activeItem } = useDragStateContext();

  const isDropTarget = dropTarget?.id === folder.id;
  const isDraggingSpace = activeItem?.type === 'space';
  const showWiggle =
    isDropTarget && dropTarget?.intent === 'merge' && !isExpanded && isDraggingSpace;
  const showDropBefore =
    isDropTarget &&
    (dropTarget?.intent === 'reorder-before' ||
      (dropTarget?.intent === 'merge' && isExpanded));
  const showDropAfter = isDropTarget && dropTarget?.intent === 'reorder-after';

  React.useEffect(() => {
    setIsDragging(isDragging);
  }, [isDragging, setIsDragging]);

  const dragStyle: React.CSSProperties = {
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  const folderColor = getFolderColorHex(folder.color as IconColor, isDarkTheme);

  const handleClick = () => {
    onToggleExpand();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isTouch && onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  };

  // Source-of-truth for the dragging source — same workaround as the row.
  const isDraggingSource =
    isDragging || activeItem?.id === folder.id;

  const containerClass = [
    'folder-container',
    collapsed ? 'folder-container--strip' : 'folder-container--row',
    isExpanded ? 'folder-container--expanded' : '',
    isDraggingSource ? 'folder-container--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {showDropBefore && <div className="spaces-sidebar__row-drop-indicator" />}
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          ['--folder-color' as string]: folderColor,
          touchAction: 'none',
        } as React.CSSProperties}
        {...attributes}
        {...listeners}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={containerClass}
      >
        {isDraggingSource && collapsed ? (
          // Strip mode shows the 48px square placeholder where the folder was.
          // Row mode ghosts the real content via .folder-container--dragging.
          <div className="space-icon-drag-placeholder" />
        ) : (
          <>
            {collapsed ? (
              <Tooltip
                id={`spaces-sidebar-folder-${folder.id}`}
                content={folder.name}
                place="right"
                showOnTouch={false}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleExpand();
                    }
                  }}
                  className={[
                    'folder-header',
                    'folder-header--strip',
                    'sidebar-row-chrome',
                    showWiggle && 'sidebar-row-chrome--merge-target',
                    'cursor-pointer',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={folder.name}
                  aria-expanded={isExpanded}
                >
                  <FolderButton
                    folder={folder}
                    hasUnread={hasUnread}
                    isExpanded={isExpanded}
                    showWiggle={showWiggle}
                  />
                </div>
              </Tooltip>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleExpand();
                  }
                }}
                className={[
                  'folder-header',
                  'folder-header--row',
                  'sidebar-row-chrome',
                  showWiggle && 'sidebar-row-chrome--merge-target',
                  'cursor-pointer',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-expanded={isExpanded}
              >
                <div className="folder-header__icon">
                  <FolderButton
                    folder={folder}
                    hasUnread={hasUnread}
                    isExpanded={isExpanded}
                    showWiggle={showWiggle}
                  />
                </div>
                <div className="folder-header__meta">
                  <div className="folder-header__name">{folder.name}</div>
                  <div className="folder-header__count">
                    <Icon name="user" size="sm" />
                    <span>{spaces.length}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="folder-spaces-wrapper">
              <div
                className={`folder-spaces ${collapsed ? 'folder-spaces--strip' : 'folder-spaces--row'}`}
              >
                {spaces.map((space) => {
                  const unread = spaceUnreadCounts[space.spaceId] || 0;
                  const active = space.spaceId === currentSpaceId;

                  if (collapsed) {
                    return (
                      <Tooltip
                        key={space.spaceId}
                        id={`spaces-sidebar-folder-${folder.id}-${space.spaceId}`}
                        content={space.spaceName}
                        place="right"
                        showOnTouch={false}
                      >
                        <button
                          type="button"
                          className={`spaces-sidebar__strip-row ${
                            active ? 'spaces-sidebar__strip-row--active' : ''
                          }`}
                          onClick={() =>
                            onSpaceClick(space.spaceId, space.defaultChannelId)
                          }
                          onContextMenu={
                            onSpaceContextMenu
                              ? (e) => {
                                  onSpaceContextMenu(
                                    space.spaceId,
                                    space.spaceName,
                                    space.iconUrl,
                                    e,
                                    unread > 0
                                  );
                                }
                              : undefined
                          }
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
                            {unread > 0 && (
                              <span className="spaces-sidebar__strip-unread-dot" />
                            )}
                          </div>
                        </button>
                      </Tooltip>
                    );
                  }

                  return (
                    <SpacesSidebarRow
                      key={space.spaceId}
                      space={space}
                      active={active}
                      unread={unread}
                      isMuted={mutedSpacesSet.has(space.spaceId)}
                      parentFolderId={folder.id}
                      onClick={() => onSpaceClick(space.spaceId, space.defaultChannelId)}
                      onContextMenu={
                        onSpaceContextMenu
                          ? (e) => {
                              onSpaceContextMenu(
                                space.spaceId,
                                space.spaceName,
                                space.iconUrl,
                                e,
                                unread > 0
                              );
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      {showDropAfter && <div className="spaces-sidebar__row-drop-indicator" />}
    </>
  );
};

export default SpacesSidebarFolder;
