import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import ExpandableNavMenu from './ExpandableNavMenu';
import SpaceButton from './SpaceButton';
import { Space } from '../../api/quorumApi';
import SpaceIcon from './SpaceIcon';
import { useSpaces } from '../../hooks/queries/spaces';
import './NavMenu.scss';
import { useMessageDB } from '../context/MessageDB';
import { useConfig } from '../../hooks/queries/config/useConfig';
import { t } from '@lingui/core/macro';

type NavMenuProps = {
  showCreateSpaceModal: () => void;
  showJoinSpaceModal: () => void;
};

const NavMenu: React.FC<NavMenuProps> = (props) => {
  const location = useLocation();
  const user = usePasskeysContext();
  const { data: spaces } = useSpaces({});
  const { saveConfig, keyset } = useMessageDB();
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo!.address,
  });
  const [mappedSpaces, setMappedSpaces] = React.useState<
    (Space & { id: string })[]
  >([]);
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;

    const sortedItems = arrayMove(
      mappedSpaces,
      mappedSpaces.findIndex((space) => space.id === e.active.id),
      mappedSpaces.findIndex((space) => space.id === e.over?.id)
    );
    setMappedSpaces(sortedItems);
    saveConfig({
      config: { ...config, spaceIds: sortedItems.map((s) => s.spaceId) },
      keyset,
    });
  };

  React.useEffect(() => {
    (async () => {
      const spaceSet = config.spaceIds;
      let dedupeList = {} as { [spaceId: string]: boolean };
      for (const id of spaceSet) {
        if (!dedupeList[id]) {
          dedupeList[id] = true;
        }
      }

      const set = Object.keys(dedupeList)
        .map((s) => {
          const space = spaces.find((sp) => sp.spaceId === s);
          if (!space) {
            return undefined;
          } else {
            return { ...space!, id: space!.spaceId };
          }
        })
        .filter((s) => s) as (Space & { id: string })[];
      setMappedSpaces(set);
    })();
  }, [config]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <header>
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
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={mappedSpaces}>
            {mappedSpaces.map((space: Space) => {
              return <SpaceButton key={space.spaceId} space={space} />;
            })}
          </SortableContext>
        </DndContext>
      </div>
      <ExpandableNavMenu {...props} />
    </header>
  );
};

export default NavMenu;
