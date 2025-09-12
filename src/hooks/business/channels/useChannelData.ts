import { useMemo, useCallback } from 'react';
import { useSpace } from '../../queries/space/useSpace';
import { useSpaceMembers } from '../../queries/spaceMembers/useSpaceMembers';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../../utils';

// Development mock data generator - REMOVE IN PRODUCTION
const generateMockUsers = (count: number) => {
  const mockUsers = [];
  for (let i = 0; i < count; i++) {
    mockUsers.push({
      user_address: `mock_user_${i}`,
      display_name: `Test User ${i + 1}`,
      user_icon: Math.random() > 0.3 ? `https://ui-avatars.com/api/?name=Test+User+${i + 1}&background=random` : DefaultImages.UNKNOWN_USER,
      inbox_address: 'mock_inbox',
    });
  }
  return mockUsers;
};

// Safe development-only testing - automatically disabled in production
const ENABLE_MOCK_USERS = 
  process.env.NODE_ENV === 'development' && 
  (localStorage?.getItem('debug_mock_users') === 'true' || 
   new URLSearchParams(window.location?.search || '').get('mockUsers') !== null);
const MOCK_USER_COUNT = parseInt(
  new URLSearchParams(window.location?.search || '').get('mockUsers') || 
  localStorage?.getItem('debug_mock_count') || 
  '1000'
);

interface UseChannelDataProps {
  spaceId: string;
  channelId: string;
}

export function useChannelData({ spaceId, channelId }: UseChannelDataProps) {
  const { data: space } = useSpace({ spaceId });
  const { data: spaceMembers } = useSpaceMembers({ spaceId });
  
  // Add mock users for testing virtualization performance
  const enhancedSpaceMembers = useMemo(() => {
    if (ENABLE_MOCK_USERS) {
      const mockUsers = generateMockUsers(MOCK_USER_COUNT);
      return [...spaceMembers, ...mockUsers];
    }
    return spaceMembers;
  }, [spaceMembers]);

  const channel = useMemo(() => {
    return space?.groups
      .find((g) => g.channels.find((c) => c.channelId == channelId))
      ?.channels.find((c) => c.channelId == channelId);
  }, [space, channelId]);

  const members = useMemo(() => {
    return enhancedSpaceMembers.reduce(
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
  }, [enhancedSpaceMembers]);

  const activeMembers = useMemo(() => {
    return enhancedSpaceMembers.reduce(
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
  }, [enhancedSpaceMembers]);

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

  const generateSidebarContent = useCallback(() => {
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
            userIcon: members[address]?.userIcon?.includes(
              DefaultImages.UNKNOWN_USER
            )
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
  }, [roles, activeMembers, members, noRoleMembers]);

  const generateVirtualizedUserList = useCallback(() => {
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
            userIcon: members[address]?.userIcon?.includes(
              DefaultImages.UNKNOWN_USER
            )
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

    const allSections = [...roleSections, noRoleSection];
    
    // Flatten into a single array suitable for virtualization
    const flattenedItems: Array<
      | { type: 'header'; title: string }
      | { type: 'user'; address: string; userIcon?: string; displayName?: string }
    > = [];

    allSections.forEach((section) => {
      // Add section header
      flattenedItems.push({ type: 'header', title: section.title });
      // Add all users in this section
      section.members.forEach((member) => {
        flattenedItems.push({
          type: 'user',
          address: member.address,
          userIcon: member.userIcon,
          displayName: member.displayName,
        });
      });
    });

    return flattenedItems;
  }, [roles, activeMembers, members, noRoleMembers]);

  return {
    space,
    channel,
    members,
    activeMembers,
    roles,
    noRoleMembers,
    stickers,
    generateSidebarContent,
    generateVirtualizedUserList,
  };
}
