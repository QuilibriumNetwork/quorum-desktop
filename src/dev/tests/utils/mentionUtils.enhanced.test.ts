/**
 * Test suite for enhanced mention extraction functionality
 *
 * Tests backward compatibility and new mention formats
 */

import { extractMentionsFromText } from '../../../utils/mentionUtils';

describe('Enhanced mentionUtils', () => {
  describe('extractMentionsFromText - User Mentions', () => {
    it('should extract old format user mentions', () => {
      const text = 'Hello @<QmAbc123> how are you?';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmAbc123');
      expect(result.memberIds).toHaveLength(1);
    });

    it('should extract new format user mentions', () => {
      const text = 'Hello @[John Doe]<QmAbc123> how are you?';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmAbc123');
      expect(result.memberIds).toHaveLength(1);
    });

    it('should extract both formats in same message', () => {
      const text = 'Hey @<QmOld123> and @[New User]<QmNew456>!';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmOld123');
      expect(result.memberIds).toContain('QmNew456');
      expect(result.memberIds).toHaveLength(2);
    });

    it('should respect word boundaries for user mentions', () => {
      const text = '**@[User]<QmAbc123>**'; // Inside markdown
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toHaveLength(0);
    });

    it('should handle escaped brackets in display names', () => {
      const text = 'Hello @[User with [] brackets]<QmAbc123>';
      const result = extractMentionsFromText(text);

      expect(result.memberIds).toContain('QmAbc123');
      expect(result.memberIds).toHaveLength(1);
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
      const text = 'Hello @everyone, important announcement!';
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
      const text = 'Hello @<QmOld123> and @moderators and @everyone!';
      const mockRoles = [{ roleId: 'role-1', roleTag: 'moderators' }];

      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles
      });

      // Should work exactly as before
      expect(result.memberIds).toContain('QmOld123');
      expect(result.roleIds).toContain('role-1');
      expect(result.everyone).toBe(true);
    });

    it('should handle mixed old and new formats seamlessly', () => {
      const text = 'Old: @<QmOld123> New: @[John]<QmNew456> Role: @moderators Everyone: @everyone';
      const mockRoles = [{ roleId: 'role-1', roleTag: 'moderators' }];

      const result = extractMentionsFromText(text, {
        allowEveryone: true,
        spaceRoles: mockRoles
      });

      expect(result.memberIds).toEqual(['QmOld123', 'QmNew456']);
      expect(result.roleIds).toEqual(['role-1']);
      expect(result.everyone).toBe(true);
    });
  });
});