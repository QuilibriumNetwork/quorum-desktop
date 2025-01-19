import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faDoorOpen,
  faEdit,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import ChannelGroup from './ChannelGroup';
import './ChannelList.scss';
import { useSpace, useSpaceMembers } from '../../hooks';
import Tooltip from '../Tooltip';
import TooltipButton from '../TooltipButton';
import SpaceEditor from './SpaceEditor';
import ChannelEditor from './ChannelEditor';
import GroupEditor from './GroupEditor';
import { useSpaceOwner } from '../../hooks/queries/spaceOwner';
import LeaveSpace from './LeaveSpace';

type ChannelListProps = { spaceId: string };

const ChannelList: React.FC<ChannelListProps> = ({ spaceId }) => {
  const { data: space } = useSpace({ spaceId });
  let [isMenuExpanded, setIsMenuExpanded] = React.useState<boolean>(false);
  let [isSpaceEditorOpen, setIsSpaceEditorOpen] =
    React.useState<boolean>(false);
  let [isLeaveSpaceOpen, setIsLeaveSpaceOpen] = React.useState<boolean>(false);
  let [isChannelEditorOpen, setIsChannelEditorOpen] = React.useState<
    { groupName: string; channelId?: string } | undefined
  >();
  let [isGroupEditorOpen, setIsGroupEditorOpen] = React.useState<
    { groupName?: string } | undefined
  >();
  let { data: isSpaceOwner } = useSpaceOwner({ spaceId });
  let { data: members } = useSpaceMembers({ spaceId });

  return (
    <>
      {isSpaceEditorOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <SpaceEditor
              spaceId={spaceId}
              dismiss={() => setIsSpaceEditorOpen(false)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsSpaceEditorOpen(false)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      {isLeaveSpaceOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <LeaveSpace
              spaceId={spaceId}
              dismiss={() => setIsLeaveSpaceOpen(false)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsLeaveSpaceOpen(false)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      {isChannelEditorOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <ChannelEditor
              spaceId={spaceId}
              groupName={isChannelEditorOpen.groupName}
              channelId={isChannelEditorOpen.channelId}
              dismiss={() => setIsChannelEditorOpen(undefined)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsChannelEditorOpen(undefined)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
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
      {isMenuExpanded ? (
        <>
          <div
            className="invisible-dismissal"
            onClick={() => setIsMenuExpanded(false)}
          />
          <Tooltip
            className="user-status-menu left-[20px] top-[24px] w-[200px] !p-[2px]"
            arrow="none"
            visible={isMenuExpanded}
          >
            {isSpaceOwner && (
              <>
                <TooltipButton
                  text="Edit Space"
                  icon={faEdit}
                  onClick={() => {
                    setIsMenuExpanded(false);
                    setIsSpaceEditorOpen(true);
                  }}
                />
                {/* <TooltipDivider /> */}
              </>
            )}
            {(!isSpaceOwner || members.length == 1) && (
              <TooltipButton
                type="danger"
                text="Leave Space"
                icon={faDoorOpen}
                onClick={() => {
                  setIsMenuExpanded(false);
                  setIsLeaveSpaceOpen(true);
                }}
              />
            )}
          </Tooltip>
        </>
      ) : (
        <></>
      )}
      <div className="channels-list">
        <div
          className={
            'space-header flex flex-row justify-between ' +
            (space?.bannerUrl
              ? ''
              : ' !h-[41px] border-b border-b-1 border-b-[rgba(255,255,255,0.1)]')
          }
          style={{ backgroundImage: `url('${space?.bannerUrl}')` }}
        >
          <div className="space-header-name truncate">{space?.spaceName}</div>
          <div
            className="space-context-menu-toggle-button"
            onClick={() => setIsMenuExpanded(true)}
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
        </div>
        {space?.groups.map((group) => (
          <ChannelGroup
            setIsGroupEditorOpen={setIsGroupEditorOpen}
            setIsChannelEditorOpen={setIsChannelEditorOpen}
            key={group.groupName}
            group={group}
          />
        ))}
        {isSpaceOwner && (
          <div
            className="channel-group-name small-caps flex flex-row px-4 cursor-pointer hover:text-white"
            onClick={() => setIsGroupEditorOpen({})}
          >
            <div className="truncate">Add Group</div>
            <div className="pt-[.15rem] pl-1">
              <FontAwesomeIcon
                onClick={() => setIsGroupEditorOpen({})}
                size={'2xs'}
                icon={faPlus}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ChannelList;
