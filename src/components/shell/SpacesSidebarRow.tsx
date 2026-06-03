import * as React from 'react';
import { t } from '@lingui/core/macro';
import type { Space } from '@quilibrium/quorum-shared';
import { useSortable } from '@dnd-kit/sortable';
import { Icon, Tooltip } from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner/useSpaceOwner';
import { useOptionalDragStateContext } from '../../context/DragStateContext';

interface SuspenseChildProps {
  spaceId: string;
}

const MemberCount: React.FunctionComponent<SuspenseChildProps> = ({ spaceId }) => {
  const { data } = useSpaceMembers({ spaceId });
  return <>{data?.length ?? 0}</>;
};

const OwnerCrown: React.FunctionComponent<SuspenseChildProps> = ({ spaceId }) => {
  const { data: isOwner } = useSpaceOwner({ spaceId });
  if (!isOwner) return null;
  return (
    <Tooltip
      id={`owner-${spaceId}`}
      content={t`You are the owner of this Space`}
      place="top"
    >
      <Icon name="crown" size="sm" className="spaces-sidebar__row-crown" />
    </Tooltip>
  );
};

export interface SpacesSidebarRowProps {
  space: Space;
  active: boolean;
  unread: number;
  isMuted?: boolean;
  /** If this row sits inside a folder, the parent folder's id. Passed in dnd data. */
  parentFolderId?: string;
  /** Compact mode: 56px icon-only strip layout used in the collapsed sidebar. */
  compact?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const SpacesSidebarRow: React.FunctionComponent<SpacesSidebarRowProps> = ({
  space,
  active,
  unread,
  isMuted,
  parentFolderId,
  compact = false,
  onClick,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: space.spaceId,
    data: { type: 'space', targetId: space.spaceId, parentFolderId },
  });

  const dragState = useOptionalDragStateContext();
  const dropTarget = dragState?.dropTarget;
  // dnd-kit's isDragging is unreliable with DragOverlay; activeItem.id is the
  // source of truth (set by useFolderDragAndDrop.handleDragStart).
  const isDraggingSource =
    isDragging || dragState?.activeItem?.id === space.spaceId;
  const isDropTarget = !!dropTarget && dropTarget.id === space.spaceId;
  const showDropBefore = isDropTarget && dropTarget!.intent === 'reorder-before';
  const showDropAfter = isDropTarget && dropTarget!.intent === 'reorder-after';
  const showMergeWiggle = isDropTarget && dropTarget!.intent === 'merge';

  const rowClass = [
    compact ? 'spaces-sidebar__strip-row' : 'spaces-sidebar__row',
    'sidebar-row-chrome',
    active && (compact ? 'spaces-sidebar__strip-row--active' : 'spaces-sidebar__row--active'),
    isDraggingSource && 'spaces-sidebar__row--dragging',
    showMergeWiggle && 'sidebar-row-chrome--merge-target',
  ]
    .filter(Boolean)
    .join(' ');

  const avatar = (
    <div
      className={[
        'relative flex-shrink-0',
        showMergeWiggle && 'spaces-sidebar__row-avatar--wiggle',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <SpaceIcon
        spaceId={space.spaceId}
        spaceName={space.spaceName}
        iconUrl={space.iconUrl}
        notifs={unread > 0}
        selected={false}
        size="regular"
        noTooltip
        mentionCount={compact && unread > 0 ? unread : undefined}
      />
      {isMuted && (
        <div className="muted-badge" title="Muted">
          <Icon name="bell-off" size="sm" />
        </div>
      )}
    </div>
  );

  const button = (
    <button
      ref={setNodeRef}
      type="button"
      className={rowClass}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-current={active ? 'page' : undefined}
      aria-label={compact ? space.spaceName : undefined}
      {...attributes}
      {...listeners}
    >
      {avatar}
      {!compact && (
        <div className="spaces-sidebar__row-meta">
          <div className="spaces-sidebar__row-line spaces-sidebar__row-line--primary">
            <span className="spaces-sidebar__row-name">{space.spaceName}</span>
            <React.Suspense fallback={null}>
              <OwnerCrown spaceId={space.spaceId} />
            </React.Suspense>
          </div>
          <div className="spaces-sidebar__row-line spaces-sidebar__row-line--secondary">
            <span className="spaces-sidebar__row-members">
              <Icon name="user" size="sm" />
              <React.Suspense fallback={<span>0</span>}>
                <MemberCount spaceId={space.spaceId} />
              </React.Suspense>
            </span>
            {unread > 0 && (
              <span className="spaces-sidebar__row-badge">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );

  return (
    <>
      {showDropBefore && <div className="spaces-sidebar__row-drop-indicator" />}
      {compact ? (
        <Tooltip
          id={`spaces-sidebar-strip-${space.spaceId}`}
          content={space.spaceName}
          place="right"
          showOnTouch={false}
        >
          {button}
        </Tooltip>
      ) : (
        button
      )}
      {showDropAfter && <div className="spaces-sidebar__row-drop-indicator" />}
    </>
  );
};

export default SpacesSidebarRow;
