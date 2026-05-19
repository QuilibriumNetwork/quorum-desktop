/**
 * Test suite for enhanced mention extraction functionality
 *
 * Tests backward compatibility and new mention formats
 */

import { extractMentionsFromText } from '@quilibrium/quorum-shared';

describe('Enhanced mentionUtils', () => {
  describe('extractMentionsFromText - User Mentions', () => {
    it('should extract old format user mentions', () => {
      const text = 'Hello @<QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX> how are you?';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX');
      expect(result.memberIds).toHaveLength(1);
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

  describe('Rate Limiting (Security Feature)', () => {
    it.todo('should limit mentions to 20 per message to prevent spam - extraction-side rate limiting not yet enforced', () => {
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

    it.todo('should process mentions in order until limit is reached - extraction-side rate limiting not yet enforced', () => {
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