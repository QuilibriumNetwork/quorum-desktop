import { useMemo, useCallback } from 'react';
import { useSpace } from '../../queries/space/useSpace';
import { useSpaceMembers } from '../../queries/spaceMembers/useSpaceMembers';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../../utils';

// Development mock data generator - REMOVE IN PRODUCTION  
const generateMockUsers = (count: number) => {
  const mockUsers = [];
  // Pre-generate a few avatar URLs to avoid 1000 unique API calls
  const avatarTemplates = [
    DefaultImages.UNKNOWN_USER,
    'https://ui-avatars.com/api/?name=User&background=007bff',
    'https://ui-avatars.com/api/?name=Test&background=28a745', 
    'https://ui-avatars.com/api/?name=Mock&background=dc3545',
    'https://ui-avatars.com/api/?name=Demo&background=ffc107',
  ];
  
  for (let i = 0; i < count; i++) {
    mockUsers.push({
      user_address: `mock_user_${i}`,
      display_name: `Test User ${i + 1}`,
      user_icon: avatarTemplates[i % avatarTemplates.length],
      inbox_address: 'mock_inbox',
    });
  }
  return mockUsers;
};

// Generate mock roles to distribute users realistically
const generateMockRoles = (mockUsers: any[]) => {
  if (!mockUsers.length) return [];
  
  const roles = [
    { id: 'mock_admin', displayName: 'Admin', members: [] as string[] },
    { id: 'mock_moderator', displayName: 'Moderator', members: [] as string[] },
    { id: 'mock_role_a', displayName: 'Role A', members: [] as string[] },
    { id: 'mock_role_b', displayName: 'Role B', members: [] as string[] },
    { id: 'mock_role_c', displayName: 'Role C', members: [] as string[] },
  ];
  
  // Realistic distribution: 1% admin, 9% mod, 10% role A, 10% role B, 20% role C, 50% no role
  mockUsers.forEach((user, index) => {
    const percentage = (index / mockUsers.length) * 100;
    
    if (percentage < 1) {
      // 1% admin
      roles[0].members.push(user.user_address);
    } else if (percentage < 10) {
      // 9% moderator
      roles[1].members.push(user.user_address);
    } else if (percentage < 20) {
      // 10% role A
      roles[2].members.push(user.user_address);
    } else if (percentage < 30) {
      // 10% role B
      roles[3].members.push(user.user_address);
    } else if (percentage < 50) {
      // 20% role C
      roles[4].members.push(user.user_address);
    }
    // Remaining 50% have no role
  });
  
  return roles;
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
  
  // Memoized mock users to prevent regeneration on every render
  const mockUsers = useMemo(() => {
    return ENABLE_MOCK_USERS ? generateMockUsers(MOCK_USER_COUNT) : [];
  }, []);

  // Add mock users for testing virtualization performance
  const enhancedSpaceMembers = useMemo(() => {
    if (ENABLE_MOCK_USERS) {
      return [...spaceMembers, ...mockUsers];
    }
    return spaceMembers;
  }, [spaceMembers, mockUsers]);

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
    const realRoles = space?.roles ?? [];
    if (ENABLE_MOCK_USERS && mockUsers.length > 0) {
      const mockRoles = generateMockRoles(mockUsers);
      return [...realRoles, ...mockRoles];
    }
    return realRoles;
  }, [space, mockUsers]);

  const noRoleMembers = useMemo(() => {
    // Pre-compute set of all role members for O(1) lookup instead of O(n) for each user
    const allRoleMembers = new Set(roles.flatMap((r) => r.members));
    return Object.keys(activeMembers)
      .filter((s) => !allRoleMembers.has(s))
      .filter((r) => !activeMembers[r].left);
  }, [roles, activeMembers]);

  const stickers = useMemo(() => {
    return (space?.stickers ?? []).reduce(
      (prev, curr) => Object.assign(prev, { [curr.id]: curr }),
      {}
    );
  }, [space]);

  // Pre-compute user sections once - used by both sidebar and virtuoso
  const userSections = useMemo(() => {
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

  const generateSidebarContent = useCallback(() => {
    return userSections;
  }, [userSections]);

  const generateVirtualizedUserList = useCallback(() => {
    // Flatten pre-computed sections into virtualization format
    const flattenedItems: Array<
      | { type: 'header'; title: string }
      | { type: 'user'; address: string; userIcon?: string; displayName?: string }
    > = [];

    userSections.forEach((section) => {
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
  }, [userSections]);

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
