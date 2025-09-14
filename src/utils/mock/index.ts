/**
 * Mock utilities for development and testing
 * Provides diverse user generation for testing user interface scalability
 */

// Export all mock functionality
export {
  generateMockUsers,
  generateMockRoles,
  isMockUsersEnabled,
  getMockUserCount,
  type MockUser,
  type MockRole,
} from './mockUsers';

export {
  getMockName,
  getMockNameCount,
  MOCK_NAMES,
} from './mockNames';

export {
  getMockAvatar,
  getAvatarTemplateCount,
  getAllAvatarTemplates,
} from './mockAvatars';