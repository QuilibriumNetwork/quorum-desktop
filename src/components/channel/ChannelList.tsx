import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDoorOpen,
  faPlus,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import ChannelGroup from './ChannelGroup';
import './ChannelList.scss';
import { useSpace, useSpaceMembers } from '../../hooks';
import { useModalContext } from '../AppWithSearch';
import GroupEditor from './GroupEditor';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import { t } from '@lingui/core/macro';
import Button from '../Button';

type ChannelListProps = { spaceId: string };

const ChannelList: React.FC<ChannelListProps> = ({ spaceId }) => {
  const { data: space } = useSpace({ spaceId });
  const { openSpaceEditor, openChannelEditor, openLeaveSpace } =
    useModalContext();
  let [isGroupEditorOpen, setIsGroupEditorOpen] = React.useState<
    { groupName?: string } | undefined
  >();
  let { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  let { data: members } = useSpaceMembers({ spaceId });

  return (
    <>
      {isGroupEditorOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <GroupEditor
              spaceId={spaceId}
              groupName={isGroupEditorOpen.groupName}
              dismiss={() => setIsGroupEditorOpen(undefined)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsGroupEditorOpen(undefined)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      <div className="channels-list">
        <div
          className={
            'space-header relative flex flex-row justify-between ' +
            (space?.bannerUrl
              ? ''
              : ' !h-[41px] border-b border-b-1 border-b-surface-6')
          }
          style={{ backgroundImage: `url('${space?.bannerUrl}')` }}
        >
          {space?.bannerUrl && (
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(var(--surface-00-rgb), 0.8), rgba(var(--surface-00-rgb), 0))',
              }}
            ></div>
          )}

          <div className="space-header-name truncate relative z-10">
            {space?.spaceName}
          </div>
          <div
            className="space-context-menu-toggle-button relative z-10"
            onClick={() => {
              if (isSpaceOwner) {
                openSpaceEditor(spaceId);
              } else {
                openLeaveSpace(spaceId);
              }
            }}
          >
            <FontAwesomeIcon icon={isSpaceOwner ? faSliders : faDoorOpen} />
          </div>
        </div>
        {space?.groups.map((group) => (
          <ChannelGroup
            setIsGroupEditorOpen={setIsGroupEditorOpen}
            key={group.groupName}
            group={group}
          />
        ))}
        {isSpaceOwner && (
          <div className="px-4 py-2">
            <Button
              type="subtle-outline"
              size="small"
              onClick={() => setIsGroupEditorOpen({})}
              className="w-full justify-start"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              {t`Add Group`}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ChannelList;
