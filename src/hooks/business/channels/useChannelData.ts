import { useMemo, useCallback, useState, useEffect } from 'react';
import { useSpace } from '../../queries/space/useSpace';
import { useSpaceMembers } from '../../queries/spaceMembers/useSpaceMembers';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../../utils';

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
  const [mockUtils, setMockUtils] = useState<any>(null);

  // Load mock utilities dynamically in development only
  useEffect(() => {
    if (ENABLE_MOCK_USERS) {
      import('../../../utils/mock')
        .then((utils) => {
          setMockUtils(utils);
        })
        .catch(() => {
          // Ignore import errors in production or if mock files don't exist
          setMockUtils(null);
        });
    }
  }, []);

  // Memoized mock users to prevent regeneration on every render
  const mockUsers = useMemo(() => {
    return ENABLE_MOCK_USERS && mockUtils ? mockUtils.generateMockUsers(MOCK_USER_COUNT) : [];
  }, [mockUtils]);

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
            isKicked: curr.isKicked || false,
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
          isKicked?: boolean;
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
            isKicked: curr.isKicked || false,
          },
        }),
      {} as {
        [address: string]: {
          address: string;
          userIcon?: string;
          displayName?: string;
          left: boolean;
          isKicked?: boolean;
        };
      }
    );
  }, [enhancedSpaceMembers]);

  const roles = useMemo(() => {
    const realRoles = space?.roles ?? [];
    if (ENABLE_MOCK_USERS && mockUsers.length > 0 && mockUtils) {
      const mockRoles = mockUtils.generateMockRoles(mockUsers);
      return [...realRoles, ...mockRoles];
    }
    return realRoles;
  }, [space, mockUsers]);

  const noRoleMembers = useMemo(() => {
    // Pre-compute set of all role members for O(1) lookup instead of O(n) for each user
    const allRoleMembers = new Set(roles.flatMap((r) => r.members));
    return Object.keys(activeMembers)
      .filter((s) => !allRoleMembers.has(s))
      .filter((r) => !activeMembers[r].left)
      .filter((r) => !activeMembers[r].isKicked);
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
        ).filter((s) => !activeMembers[s].isKicked);
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

  const generateVirtualizedUserList = useCallback((searchFilter = '') => {
    // Flatten pre-computed sections into virtualization format
    const flattenedItems: Array<
      | { type: 'header'; title: string }
      | { type: 'user'; address: string; userIcon?: string; displayName?: string }
    > = [];

    if (!searchFilter.trim()) {
      // No search - return full list
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
    } else {
      // Filter users based on search term
      const term = searchFilter.toLowerCase();
      const filteredSections = userSections.map(section => ({
        ...section,
        members: section.members.filter(member =>
          member.displayName?.toLowerCase().includes(term) ||
          member.address?.toLowerCase().includes(term)
        )
      })).filter(section => section.members.length > 0);

      // Build flattened items from filtered sections
      filteredSections.forEach((section) => {
        // Add section header
        flattenedItems.push({ type: 'header', title: section.title });
        // Add filtered users in this section
        section.members.forEach((member) => {
          flattenedItems.push({
            type: 'user',
            address: member.address,
            userIcon: member.userIcon,
            displayName: member.displayName,
          });
        });
      });
    }

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
