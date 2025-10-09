import * as React from 'react';
import ChannelGroup from './ChannelGroup';
import './ChannelList.scss';
import { useSpace } from '../../hooks';
import {
  useGroupEditor,
  useSpacePermissions,
  useSpaceHeader,
  useSpaceGroups,
} from '../../hooks';
import { useChannelMentionCounts } from '../../hooks/business/mentions';
import { t } from '@lingui/core/macro';
import { Button, Container, Icon, Text, Tooltip } from '../primitives';

type ChannelListProps = { spaceId: string };

const ChannelList: React.FC<ChannelListProps> = ({ spaceId }) => {
  const { data: space } = useSpace({ spaceId });

  // Extract business logic into hooks
  const { openNewGroupEditor, openEditGroupEditor } = useGroupEditor(spaceId);

  const { canAddGroups, handleSpaceContextAction, getContextIcon } =
    useSpacePermissions(spaceId);

  const {
    headerClassName,
    headerStyle,
    hasBanner,
    gradientOverlayStyle,
    spaceName,
  } = useSpaceHeader(space);

  const { groups } = useSpaceGroups(space);

  // Get all channel IDs from all groups
  const channelIds = React.useMemo(
    () => groups.flatMap((group) => group.channels.map((c) => c.channelId)),
    [groups]
  );

  // Get mention counts for all channels
  const mentionCounts = useChannelMentionCounts({ spaceId, channelIds });

  // Merge mention counts into groups
  const groupsWithMentionCounts = React.useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        channels: group.channels.map((channel) => ({
          ...channel,
          mentionCount: mentionCounts[channel.channelId] || 0,
        })),
      })),
    [groups, mentionCounts]
  );

  return (
    <Container className="channels-list-wrapper">
      <Container className={headerClassName} style={headerStyle}>
        {hasBanner && (
          <Container
            className="absolute inset-0 pointer-events-none z-0"
            style={gradientOverlayStyle}
          />
        )}

        <Container className="space-header-name truncate relative z-10">
          <Text weight="bold" color="strong">
            {spaceName}
          </Text>
        </Container>
        <Container
          className="space-context-menu-toggle-button relative z-10"
          onClick={handleSpaceContextAction}
        >
          <Tooltip
            id="space-settings-icon"
            content={t`Space Settings`}
            place="left"
            showOnTouch={false}
          >
            <Icon name={getContextIcon()} />
          </Tooltip>
        </Container>
      </Container>
      <Container className="channels-list">
        {groupsWithMentionCounts.map((group: any) => (
          <ChannelGroup
            onEditGroup={openEditGroupEditor}
            key={group.groupName}
            group={group}
          />
        ))}
        {canAddGroups && (
          <Container className="px-4 py-2">
            <Button
              type="subtle-outline"
              size="small"
              onClick={openNewGroupEditor}
              className="w-full justify-center items-center"
            >
              <Icon name="plus" className="mr-2" />
              {t`Add Group`}
            </Button>
          </Container>
        )}
      </Container>
    </Container>
  );
};

export default ChannelList;
