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
  isFavorite?: boolean;
  /** If this row sits inside a folder, the parent folder's id. Passed in dnd data. */
  parentFolderId?: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const SpacesSidebarRow: React.FunctionComponent<SpacesSidebarRowProps> = ({
  space,
  active,
  unread,
  isMuted,
  isFavorite,
  parentFolderId,
  onClick,
  onContextMenu,
}) => {
  // useSortable is safe outside a SortableContext — it returns no-op listeners
  // and a null ref so the row renders normally before the DnD providers mount.
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: space.spaceId,
    data: { type: 'space', targetId: space.spaceId, parentFolderId },
  });

  // Drop-target visuals come from DragStateContext when it exists. The hook is
  // optional so the row renders fine outside the provider.
  const dragState = useOptionalDragStateContext();
  const dropTarget = dragState?.dropTarget;
  const isDropTarget = !!dropTarget && dropTarget.id === space.spaceId;
  const showDropBefore = isDropTarget && dropTarget!.intent === 'reorder-before';
  const showDropAfter = isDropTarget && dropTarget!.intent === 'reorder-after';
  const showMergeWiggle = isDropTarget && dropTarget!.intent === 'merge';

  const rowClass = [
    'spaces-sidebar__row',
    active && 'spaces-sidebar__row--active',
    isDragging && 'spaces-sidebar__row--dragging',
    showMergeWiggle && 'spaces-sidebar__row--drop-target',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {showDropBefore && <div className="spaces-sidebar__row-drop-indicator" />}
      <button
        ref={setNodeRef}
        type="button"
        className={rowClass}
        onClick={onClick}
        onContextMenu={onContextMenu}
        aria-current={active ? 'page' : undefined}
        {...attributes}
        {...listeners}
      >
        <div className={`relative flex-shrink-0${isFavorite ? ' spaces-sidebar__row-avatar--favorite' : ''}`}>
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
          {isMuted && (
            <div className="muted-badge" title="Muted">
              <Icon name="bell-off" size="sm" />
            </div>
          )}
        </div>
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
      </button>
      {showDropAfter && <div className="spaces-sidebar__row-drop-indicator" />}
    </>
  );
};

export default SpacesSidebarRow;
