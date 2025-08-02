import { useMemo } from 'react';
import { useSpace } from '../../queries/space/useSpace';
import { useSpaceMembers } from '../../queries/spaceMembers/useSpaceMembers';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../../utils';

interface UseChannelDataProps {
  spaceId: string;
  channelId: string;
}

export function useChannelData({ spaceId, channelId }: UseChannelDataProps) {
  const { data: space } = useSpace({ spaceId });
  const { data: spaceMembers } = useSpaceMembers({ spaceId });

  const channel = useMemo(() => {
    return space?.groups
      .find((g) => g.channels.find((c) => c.channelId == channelId))
      ?.channels.find((c) => c.channelId == channelId);
  }, [space, channelId]);

  const members = useMemo(() => {
    return spaceMembers.reduce(
      (prev, curr) =>
        Object.assign(prev, {
          [curr.user_address]: {
            address: curr.user_address,
            userIcon: curr.user_icon,
            displayName: curr.display_name,
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
        };
      }
    );
  }, [spaceMembers]);

  const activeMembers = useMemo(() => {
    return spaceMembers.reduce(
      (prev, curr) =>
        Object.assign(prev, {
          [curr.user_address]: {
            address: curr.user_address,
            userIcon: curr.user_icon,
            displayName: curr.display_name,
            left: curr.inbox_address === '',
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
          left: boolean;
        };
      }
    );
  }, [spaceMembers]);

  const roles = useMemo(() => {
    return space?.roles ?? [];
  }, [space]);

  const noRoleMembers = useMemo(() => {
    return Object.keys(activeMembers)
      .filter((s) => !roles.flatMap((r) => r.members).includes(s))
      .filter((r) => !activeMembers[r].left);
  }, [roles, activeMembers]);

  const stickers = useMemo(() => {
    return (space?.stickers ?? []).reduce(
      (prev, curr) => Object.assign(prev, { [curr.id]: curr }),
      {}
    );
  }, [space]);

  const generateSidebarContent = () => {
    const roleSections = roles
      .filter((r) => r.members.length !== 0)
      .map((role) => {
        const roleMembers = Object.keys(activeMembers).filter((s) =>
          role.members.includes(s)
        );
        return {
          title: i18n._('{role} - {count}', {
            role: role.displayName.toUpperCase(),
            count: roleMembers.length,
          }),
          members: roleMembers.map((address) => ({
            ...members[address],
            userIcon: members[address]?.userIcon?.includes(DefaultImages.UNKNOWN_USER)
              ? 'var(--unknown-icon)'
              : members[address]?.userIcon,
          })),
        };
      });

    const noRoleSection = {
      title: i18n._('No Role - {count}', { count: noRoleMembers.length }),
      members: noRoleMembers.map((address) => ({
        ...members[address],
        userIcon: members[address]?.userIcon,
      })),
    };

    return [...roleSections, noRoleSection];
  };

  return {
    space,
    channel,
    members,
    activeMembers,
    roles,
    noRoleMembers,
    stickers,
    generateSidebarContent,
  };
}