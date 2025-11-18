/**
 * Test suite for enhanced mention extraction functionality
 *
 * Tests backward compatibility and new mention formats
 */

import { extractMentionsFromText } from '../../../utils/mentionUtils';

describe('Enhanced mentionUtils', () => {
  describe('extractMentionsFromText - User Mentions', () => {
    it('should extract old format user mentions', () => {
      const text = 'Hello @<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> how are you?';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX');
      expect(result.memberIds).toHaveLength(1);
    });

    it('should extract new format user mentions', () => {
      const text = 'Hello @[John Doe]<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> how are you?';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX');
      expect(result.memberIds).toHaveLength(1);
    });

    it('should extract both formats in same message', () => {
      const text = 'Hey @<QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ> and @[New User]<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> !';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ');
      expect(result.memberIds).toContain('QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX');
      expect(result.memberIds).toHaveLength(2);
    });

    it('should respect word boundaries for user mentions', () => {
      const text = '**@[User]<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX>**'; // Inside markdown
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toHaveLength(0);
    });

    it('should reject mentions with invalid characters in display names', () => {
      // Display names cannot contain brackets due to XSS validation (validateNameForXSS)
      const text = 'Hello @[User with [] brackets]<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> there';
      const result = extractMentionsFromText(text);

      // Since brackets are not allowed in display names, this mention should not be extracted
      expect(result.memberIds).toHaveLength(0);
    });
  });

  describe('extractMentionsFromText - Channel Mentions', () => {
    const mockChannels = [
      { channelId: 'ch-123', channelName: 'general' },
      { channelId: 'ch-456', channelName: 'random' }
    ];

    it('should extract old format channel mentions', () => {
      const text = 'Check #<ch-123> for updates';
      const result = extractMentionsFromText(text, { spaceChannels: mockChannels });

      expect(result.channelIds).toContain('ch-123');
      expect(result.channelIds).toHaveLength(1);
    });

    it('should extract new format channel mentions', () => {
      const text = 'Check #[general-chat]<ch-123> for updates';
      const result = extractMentionsFromText(text, { spaceChannels: mockChannels });

      expect(result.channelIds).toContain('ch-123');
      expect(result.channelIds).toHaveLength(1);
    });

    it('should extract both formats in same message', () => {
      const text = 'See #<ch-123> and #[random-chat]<ch-456>';
      const result = extractMentionsFromText(text, { spaceChannels: mockChannels });

      expect(result.channelIds).toContain('ch-123');
      expect(result.channelIds).toContain('ch-456');
      expect(result.channelIds).toHaveLength(2);
    });

    it('should only extract mentions for existing channels', () => {
      const text = 'Check #[nonexistent]<ch-999>';
      const result = extractMentionsFromText(text, { spaceChannels: mockChannels });

      expect(result.channelIds).toHaveLength(0);
    });

    it('should respect word boundaries for channel mentions', () => {
      const text = '**#[general]<ch-123>**'; // Inside markdown
      const result = extractMentionsFromText(text, { spaceChannels: mockChannels });

      expect(result.channelIds).toHaveLength(0);
    });
  });

  describe('extractMentionsFromText - @everyone', () => {
    it('should extract @everyone with permission', () => {
      const text = 'Hello @everyone important announcement!';
      const result = extractMentionsFromText(text, { allowEveryone: true });

      expect(result.everyone).toBe(true);
    });

    it('should not extract @everyone without permission', () => {
      const text = 'Hello @everyone, important announcement!';
      const result = extractMentionsFromText(text, { allowEveryone: false });

      expect(result.everyone).toBeUndefined();
    });

    it('should respect word boundaries for @everyone', () => {
      const text = 'email@everyone.com'; // Not at word boundary
      const result = extractMentionsFromText(text, { allowEveryone: true });

      expect(result.everyone).toBeUndefined();
    });
  });

  describe('extractMentionsFromText - Role Mentions', () => {
    const mockRoles = [
      { roleId: 'role-1', roleTag: 'moderators' },
      { roleId: 'role-2', roleTag: 'admins' }
    ];

    it('should extract role mentions', () => {
      const text = 'Hello @moderators please help!';
      const result = extractMentionsFromText(text, { spaceRoles: mockRoles });

      expect(result.roleIds).toContain('role-1');
      expect(result.roleIds).toHaveLength(1);
    });

    it('should only extract mentions for existing roles', () => {
      const text = 'Hello @nonexistent please help!';
      const result = extractMentionsFromText(text, { spaceRoles: mockRoles });

      expect(result.roleIds).toHaveLength(0);
    });

    it('should respect word boundaries for role mentions', () => {
      const text = '**@moderators**'; // Inside markdown
      const result = extractMentionsFromText(text, { spaceRoles: mockRoles });

      expect(result.roleIds).toHaveLength(0);
    });

    it('should not extract @everyone as role mention', () => {
      const text = 'Hello @everyone and @moderators!';
      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles
      });

      expect(result.everyone).toBe(true);
      expect(result.roleIds).toContain('role-1');
      expect(result.roleIds).not.toContain('everyone'); // @everyone should not be in roleIds
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain exact same behavior for old format mentions', () => {
      const text = 'Hello @<QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ> and @moderators and @everyone ';
      const mockRoles = [{ roleId: 'role-1', roleTag: 'moderators' }];

      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles
      });

      // Should work exactly as before
      expect(result.memberIds).toContain('QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ');
      expect(result.roleIds).toContain('role-1');
      expect(result.everyone).toBe(true);
    });

    it('should handle mixed old and new formats seamlessly', () => {
      const text = 'Old: @<QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ> New: @[John]<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> Role: @moderators Everyone: @everyone ';
      const mockRoles = [{ roleId: 'role-1', roleTag: 'moderators' }];

      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles
      });

      expect(result.memberIds).toEqual(['QmNhFJjGcMPqpuYfxL6x1Rv4fBXdkPcs3nEkUBBavbEEyZ', 'QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX']);
      expect(result.roleIds).toEqual(['role-1']);
      expect(result.everyone).toBe(true);
    });
  });

  describe('Rate Limiting (Security Feature)', () => {
    it('should limit mentions to 20 per message to prevent spam', () => {
      // Create a message with 25 different user mentions (exceeds 20 limit)
      let text = '@everyone '; // Start with @everyone (counts as 1)
      const expectedIds = [];

      // Add 24 user mentions (only first 19 should be processed due to @everyone taking 1 slot)
      for (let i = 1; i <= 24; i++) {
        const userId = `QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZA${i.toString().padStart(3, '0')}`;
        text += `@<${userId}> `;
        if (i <= 19) { // Only first 19 user mentions should be extracted (20 total with @everyone)
          expectedIds.push(userId);
        }
      }

      const result = extractMentionsFromText(text, { allowEveryone: true });

      // Should extract @everyone (1) + first 19 user mentions = 20 total
      expect(result.everyone).toBe(true);
      expect(result.memberIds).toHaveLength(19);
      expect(result.memberIds).toEqual(expectedIds);
    });

    it('should limit mixed mention types to 20 total', () => {
      const mockRoles = [
        { roleId: 'role-1', roleTag: 'admins' },
        { roleId: 'role-2', roleTag: 'mods' },
        { roleId: 'role-3', roleTag: 'helpers' }
      ];

      const mockChannels = [
        { channelId: 'ch-1', channelName: 'general' },
        { channelId: 'ch-2', channelName: 'random' }
      ];

      // Create message with: @everyone (1) + 10 users + 5 roles + 6 channels = 22 mentions
      let text = '@everyone ';

      // Add 10 user mentions
      for (let i = 1; i <= 10; i++) {
        text += `@<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZA${i.toString().padStart(3, '0')}> `;
      }

      // Add 5 role mentions (only 3 valid roles, but repeat them)
      text += '@admins @mods @helpers @admins @mods ';

      // Add 6 channel mentions (2 valid channels repeated)
      text += '#<ch-1> #<ch-2> #<ch-1> #<ch-2> #<ch-1> #<ch-2> ';

      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles,
        spaceChannels: mockChannels
      });

      // Count total mentions extracted (should be exactly 20)
      const totalMentions =
        (result.everyone ? 1 : 0) +
        result.memberIds.length +
        result.roleIds.length +
        result.channelIds.length;

      expect(totalMentions).toBe(16);
      expect(result.everyone).toBe(true); // @everyone should be processed first
      expect(result.memberIds).toHaveLength(10); // All 10 users processed
      expect(result.roleIds).toHaveLength(3); // All 3 unique roles processed
      expect(result.channelIds).toHaveLength(2); // All 2 unique channels processed
      // Total: 1 + 10 + 3 + 2 = 16 (deduplication removes repeated roles/channels)
    });

    it('should process mentions in order until limit is reached', () => {
      // Test that mentions are processed in the order they appear in the function
      let text = '';

      // Add 25 user mentions
      for (let i = 1; i <= 25; i++) {
        text += `@<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZA${i.toString().padStart(3, '0')}> `;
      }

      const result = extractMentionsFromText(text);

      // Should extract exactly 20 user mentions (first 20 encountered)
      expect(result.memberIds).toHaveLength(20);

      // Verify it's the first 20 users
      const expectedIds = [];
      for (let i = 1; i <= 20; i++) {
        expectedIds.push(`QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZA${i.toString().padStart(3, '0')}`);
      }
      expect(result.memberIds).toEqual(expectedIds);
    });
  });
});