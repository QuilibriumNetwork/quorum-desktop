/**
 * Test suite for mention highlighting functionality
 *
 * Tests both old and new mention formats with visual highlighting
 */

import { highlightMentions, containsMentions } from '../../../utils/mentionHighlighting';

describe('mentionHighlighting', () => {
  describe('containsMentions', () => {
    it('should detect user mentions in old format', () => {
      expect(containsMentions('Hello @<QmAbc123>')).toBe(true);
    });

    it('should detect user mentions in new format', () => {
      expect(containsMentions('Hello @[John Doe]<QmAbc123>')).toBe(true);
    });

    it('should detect channel mentions in old format', () => {
      expect(containsMentions('Check #<ch-abc123>')).toBe(true);
    });

    it('should detect channel mentions in new format', () => {
      expect(containsMentions('Check #[general-chat]<ch-abc123>')).toBe(true);
    });

    it('should detect role mentions', () => {
      expect(containsMentions('Hello @moderators')).toBe(true);
    });

    it('should detect @everyone mentions', () => {
      expect(containsMentions('Hello @everyone')).toBe(true);
    });

    it('should return false for text without mentions', () => {
      expect(containsMentions('Just regular text')).toBe(false);
    });

    it('should return false for empty text', () => {
      expect(containsMentions('')).toBe(false);
    });
  });

  describe('highlightMentions', () => {
    it('should highlight old format user mentions', () => {
      const text = 'Hello @<QmAbc123>';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">@&lt;QmAbc123&gt;</span>');
    });

    it('should highlight new format user mentions', () => {
      const text = 'Hello @[John Doe]<QmAbc123>';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">@[John Doe]&lt;QmAbc123&gt;</span>');
    });

    it('should highlight old format channel mentions', () => {
      const text = 'Check #<ch-abc123>';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">#&lt;ch-abc123&gt;</span>');
    });

    it('should highlight new format channel mentions', () => {
      const text = 'Check #[general-chat]<ch-abc123>';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">#[general-chat]&lt;ch-abc123&gt;</span>');
    });

    it('should highlight role mentions', () => {
      const text = 'Hello @moderators';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">@moderators</span>');
    });

    it('should highlight @everyone mentions', () => {
      const text = 'Hello @everyone';
      const result = highlightMentions(text);
      expect(result).toContain('<span class="mention-highlight">@everyone</span>');
    });

    it('should handle mixed formats in same message', () => {
      const text = 'Hey @<QmOld123> and @[New User]<QmNew456> check #[general]<ch-123>';
      const result = highlightMentions(text);

      // Should highlight all three mentions
      expect(result).toContain('<span class="mention-highlight">@&lt;QmOld123&gt;</span>');
      expect(result).toContain('<span class="mention-highlight">@[New User]&lt;QmNew456&gt;</span>');
      expect(result).toContain('<span class="mention-highlight">#[general]&lt;ch-123&gt;</span>');
    });

    it('should escape HTML characters', () => {
      const text = 'Hello @[<script>]<QmAbc123>';
      const result = highlightMentions(text);
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should respect word boundaries', () => {
      const text = '**@[User]<QmAbc123>**';
      const result = highlightMentions(text);
      // Should not highlight mentions inside markdown syntax
      expect(result).not.toContain('<span class="mention-highlight">');
    });

    it('should handle text without mentions', () => {
      const text = 'Just regular text with @ and # symbols';
      const result = highlightMentions(text);
      expect(result).toBe('Just regular text with @ and # symbols');
    });

    it('should handle empty text', () => {
      const result = highlightMentions('');
      expect(result).toBe('');
    });

    it('should not highlight @everyone if not at word boundary', () => {
      const text = 'email@everyone.com';
      const result = highlightMentions(text);
      expect(result).not.toContain('<span class="mention-highlight">');
    });

    it('should not highlight mentions inside code blocks', () => {
      const text = 'Normal @user and ```@<QmCode123>``` and `@inline`';
      const result = highlightMentions(text);

      // Should highlight normal mention but not code mentions
      expect(result).toContain('<span class="mention-highlight">@user</span>');
      expect(result).not.toContain('<span class="mention-highlight">@&lt;QmCode123&gt;</span>');
      expect(result).not.toContain('<span class="mention-highlight">@inline</span>');
    });

    it('should handle multiline code blocks correctly', () => {
      const text = 'Before\n```\n@<QmCode123>\n@everyone\n```\nAfter @<QmNormal123>';
      const result = highlightMentions(text);

      // Should not highlight mentions inside multiline code block
      expect(result).not.toContain('<span class="mention-highlight">@&lt;QmCode123&gt;</span>');
      expect(result).not.toContain('<span class="mention-highlight">@everyone</span>');

      // Should highlight mention after code block
      expect(result).toContain('<span class="mention-highlight">@&lt;QmNormal123&gt;</span>');
    });

    it('should handle nested code markers correctly', () => {
      const text = 'Text `inline @user code` and ```block @<QmUser123> code``` normal @final';
      const result = highlightMentions(text);

      // Should not highlight mentions inside any code
      expect(result).not.toContain('<span class="mention-highlight">@user</span>');
      expect(result).not.toContain('<span class="mention-highlight">@&lt;QmUser123&gt;</span>');

      // Should highlight normal mention
      expect(result).toContain('<span class="mention-highlight">@final</span>');
    });

    it('should handle unclosed code blocks gracefully', () => {
      const text = 'Start ```@<QmCode123> and @<QmNormal123>';
      const result = highlightMentions(text);

      // Both mentions should be considered inside unclosed code block
      expect(result).not.toContain('<span class="mention-highlight">');
    });
  });

  describe('Performance optimizations', () => {
    it('should handle very long text efficiently', () => {
      const longText = 'x'.repeat(2000) + ' @<QmTest123>';
      const start = Date.now();
      const result = highlightMentions(longText);
      const end = Date.now();

      // Should complete in reasonable time (< 100ms for this size)
      expect(end - start).toBeLessThan(100);
      expect(result).toContain('<span class="mention-highlight">@&lt;QmTest123&gt;</span>');
    });

    it('should optimize containsMentions for long text without mentions', () => {
      const longText = 'x'.repeat(2000);
      const start = Date.now();
      const result = containsMentions(longText);
      const end = Date.now();

      // Should complete very quickly for text without @ or #
      expect(end - start).toBeLessThan(50);
      expect(result).toBe(false);
    });
  });
});