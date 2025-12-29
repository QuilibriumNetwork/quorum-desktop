/**
 * Mock user generation utilities for development and testing
 * Moved from useChannelData.ts for better organization and reusability
 */

import { getMockName } from './mockNames';

export interface MockUser {
  user_address: string;
  display_name: string;
  user_icon: string;
  inbox_address: string;
}

export interface MockRole {
  id: string;
  displayName: string;
  members: string[];
}

/**
 * Generate mock users with diverse names
 * Uses empty icons to trigger initials fallback in UserAvatar for consistent styling
 */
export function generateMockUsers(count: number): MockUser[] {
  const mockUsers: MockUser[] = [];

  for (let i = 0; i < count; i++) {
    mockUsers.push({
      user_address: `mock_user_${i}`,
      display_name: getMockName(i),
      user_icon: '', // Empty to trigger initials fallback in UserAvatar
      inbox_address: 'mock_inbox',
    });
  }

  return mockUsers;
}

/**
 * Generate realistic role distribution for mock users
 * Creates hierarchical roles with realistic member distribution
 */
export function generateMockRoles(mockUsers: MockUser[]): MockRole[] {
  if (!mockUsers.length) return [];

  const roles: MockRole[] = [
    { id: 'mock_owner', displayName: 'Owner', members: [] },
    { id: 'mock_admin', displayName: 'Admin', members: [] },
    { id: 'mock_moderator', displayName: 'Moderator', members: [] },
    { id: 'mock_contributor', displayName: 'Contributor', members: [] },
    { id: 'mock_member', displayName: 'Member', members: [] },
    { id: 'mock_guest', displayName: 'Guest', members: [] },
  ];

  // Realistic distribution percentages
  // Owner: 0.5%, Admin: 2%, Mod: 5%, Contributor: 15%, Member: 30%, Guest: 20%, No Role: 27.5%
  mockUsers.forEach((user, index) => {
    const percentage = (index / mockUsers.length) * 100;

    if (percentage < 0.5) {
      // 0.5% owner
      roles[0].members.push(user.user_address);
    } else if (percentage < 2.5) {
      // 2% admin
      roles[1].members.push(user.user_address);
    } else if (percentage < 7.5) {
      // 5% moderator
      roles[2].members.push(user.user_address);
    } else if (percentage < 22.5) {
      // 15% contributor
      roles[3].members.push(user.user_address);
    } else if (percentage < 52.5) {
      // 30% member
      roles[4].members.push(user.user_address);
    } else if (percentage < 72.5) {
      // 20% guest
      roles[5].members.push(user.user_address);
    }
    // Remaining 27.5% have no role
  });

  // Remove empty roles
  return roles.filter(role => role.members.length > 0);
}

/**
 * Check if mock users are enabled in development
 * Controlled by localStorage or URL parameter
 */
export function isMockUsersEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  return (
    localStorage?.getItem('debug_mock_users') === 'true' ||
    new URLSearchParams(window.location?.search || '').get('mockUsers') !== null
  );
}

/**
 * Get mock user count from URL parameter or localStorage
 */
export function getMockUserCount(): number {
  return parseInt(
    new URLSearchParams(window.location?.search || '').get('mockUsers') ||
    localStorage?.getItem('debug_mock_count') ||
    '1000'
  );
}