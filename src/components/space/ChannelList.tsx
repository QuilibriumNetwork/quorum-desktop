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
import { useReplyNotificationCounts } from '../../hooks/business/replies';
import { useChannelUnreadCounts } from '../../hooks/business/messages';
import { t } from '@lingui/core/macro';
import { Button, Container, Icon, Text, Tooltip } from '../primitives';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { getUserRoles } from '../../utils/permissions';
import { Group } from '../../api/quorumApi';

type ChannelListProps = { spaceId: string };

type GroupWithMentionCounts = Group & {
  channels: Array<
    Group['channels'][number] & {
      mentionCount?: number;
      unreads?: number;
    }
  >;
};

const ChannelList: React.FC<ChannelListProps> = ({ spaceId }) => {
  const { data: space } = useSpace({ spaceId });
  const user = usePasskeysContext();

  // Extract business logic into hooks
  const { openNewGroupEditor, openEditGroupEditor } = useGroupEditor(spaceId);

  const { canAddGroups, handleSpaceContextAction, getContextIcon } =
    useSpacePermissions(spaceId);

  const {
    headerClassName,
    bannerStyle,
    hasBanner,
    gradientOverlayStyle,
    spaceName,
  } = useSpaceHeader(space);

  const { groups } = useSpaceGroups(space);

  // Get all channel IDs from all groups
  const channelIds = React.useMemo(
    () =>
      groups.flatMap((group: Group) => group.channels.map((c) => c.channelId)),
    [groups]
  );

  // Get current user's role IDs for role mention filtering
  const userRoleIds = React.useMemo(() => {
    if (!space || !user.currentPasskeyInfo?.address) return [];
    const userRolesData = getUserRoles(user.currentPasskeyInfo.address, space);
    return userRolesData.map((r) => r.roleId);
  }, [space, user.currentPasskeyInfo?.address]);

  // Get mention counts and reply counts for all channels
  const mentionCounts = useChannelMentionCounts({
    spaceId,
    channelIds,
    userRoleIds,
  });
  const replyCounts = useReplyNotificationCounts({ spaceId, channelIds });

  // Get unread message counts for all channels
  const unreadCounts = useChannelUnreadCounts({ spaceId, channelIds });

  // Merge combined notification counts (mentions + replies) and unread counts into groups
  const groupsWithMentionCounts = React.useMemo<GroupWithMentionCounts[]>(
    () =>
      groups.map(
        (group: Group): GroupWithMentionCounts => ({
          ...group,
          channels: group.channels.map((channel) => {
            const mentions = mentionCounts[channel.channelId] || 0;
            const replies = replyCounts[channel.channelId] || 0;
            const unreads = unreadCounts[channel.channelId] || 0;
            return {
              ...channel,
              mentionCount: mentions + replies, // Combined count for single badge
              unreads: unreads, // Separate unread indicator
            };
          }),
        })
      ),
    [groups, mentionCounts, replyCounts, unreadCounts]
  );

  return (
    <Container className="channels-list-wrapper">
      <Container className={headerClassName} style={bannerStyle}>
        {hasBanner && (
          <Container
            className="absolute inset-0 pointer-events-none z-0"
            style={gradientOverlayStyle}
          />
        )}

        <Container className="space-header-name truncate-space-name relative z-10 flex-1 min-w-0">
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
        {groupsWithMentionCounts.map((group: GroupWithMentionCounts) => (
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
              <Icon name="plus" size="sm" className="mr-2" />
              {t`Add Group`}
            </Button>
          </Container>
        )}
      </Container>
    </Container>
  );
};

export default ChannelList;
