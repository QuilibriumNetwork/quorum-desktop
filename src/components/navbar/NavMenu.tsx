import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import ExpandableNavMenu from './ExpandableNavMenu';
import SpaceButton from './SpaceButton';
import SpaceIcon from './SpaceIcon';
import { t } from '@lingui/core/macro';
import { DragStateProvider } from '../../context/DragStateContext';
import {
  useSpaces,
  useConfig,
  useSpaceOrdering,
  useSpaceDragAndDrop,
} from '../../hooks';
import './NavMenu.scss';

type NavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

const NavMenuContent: React.FC<NavMenuProps> = (props) => {
  const location = useLocation();
  const user = usePasskeysContext();
  const { data: spaces } = useSpaces({});
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo!.address,
  });

  const { mappedSpaces, setMappedSpaces } = useSpaceOrdering(spaces, config);
  const { handleDragStart, handleDragEnd, sensors } = useSpaceDragAndDrop({
    mappedSpaces,
    setMappedSpaces,
    config,
  });

  return (
    <header
      className={
        //@ts-ignore
        window.electron ? 'electron' : ''
      }
    >
      {
        //@ts-ignore
        window.electron ? <div className="p-3"></div> : <></>
      }
      <div className="nav-menu-logo">
        <Link className="block" to="/messages">
          <SpaceIcon
            notifs={false}
            size="regular"
            selected={location.pathname.startsWith('/messages')}
            spaceName={t`Direct Messages`}
            iconUrl="/quorum-symbol-bg-blue.png"
            spaceId="direct-messages"
            highlightedTooltip={true}
          />
        </Link>
      </div>
      <div className="nav-menu-spaces grow">
        <DndContext
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={mappedSpaces}>
            {mappedSpaces.map((space) => (
              <SpaceButton key={space.spaceId} space={space} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <ExpandableNavMenu {...props} />
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
