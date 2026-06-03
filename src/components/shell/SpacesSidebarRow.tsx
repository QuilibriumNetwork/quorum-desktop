import * as React from 'react';
import { t } from '@lingui/core/macro';
import type { Space } from '@quilibrium/quorum-shared';
import { Icon, Tooltip } from '../primitives';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaceMembers } from '../../hooks/queries/spaceMembers/useSpaceMembers';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner/useSpaceOwner';

interface SuspenseChildProps {
  spaceId: string;
}

// Suspense-bound member count. Lives in its own boundary so a slow IndexedDB
// read on one row doesn't block the rest of the list from rendering.
const MemberCount: React.FunctionComponent<SuspenseChildProps> = ({ spaceId }) => {
  const { data } = useSpaceMembers({ spaceId });
  return <>{data?.length ?? 0}</>;
};

// Suspense-bound owner crown. Renders nothing when the user isn't the owner.
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
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const SpacesSidebarRow: React.FunctionComponent<SpacesSidebarRowProps> = ({
  space,
  active,
  unread,
  isMuted,
  onClick,
  onContextMenu,
}) => {
  const rowClass = [
    'spaces-sidebar__row',
    active && 'spaces-sidebar__row--active',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={rowClass}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-current={active ? 'page' : undefined}
    >
      <div className="relative flex-shrink-0">
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
  );
};

export default SpacesSidebarRow;
