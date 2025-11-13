import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import strip from 'strip-markdown';

/**
 * Strips markdown formatting from text to create clean plain text.
 * Uses the same remark parser as the markdown renderer to ensure consistency.
 *
 * This is a general-purpose utility that can be used anywhere in the app where
 * plain text is needed from markdown-formatted content (previews, notifications,
 * search results, etc.)
 *
 * Companion to markdownFormatting.ts which adds markdown formatting.
 *
 * **Special handling for app-specific tokens:**
 * - YouTube embeds: `![youtube-embed](videoId)` → Removed entirely
 * - Invite cards: `![invite-card](url)` → Removed entirely
 * - User mentions: `<<<MENTION_USER:address>>>` → Kept as-is (for notifications)
 * - Everyone mentions: `<<<MENTION_EVERYONE>>>` → Kept as-is (for notifications)
 * - Role mentions: `<<<MENTION_ROLE:roleTag:displayName>>>` → Kept as-is (for notifications)
 *
 * Note: Mentions are preserved by default. Use `stripMarkdownAndMentions()` to remove them.
 *
 * @param text - Text with markdown formatting
 * @returns Plain text without markdown syntax
 *
 * @example
 * stripMarkdown('**Hello** *world*') // Returns: 'Hello world'
 * stripMarkdown('[Link](url)') // Returns: 'Link'
 * stripMarkdown('`code`') // Returns: 'code'
 * stripMarkdown('### Heading') // Returns: 'Heading'
 * stripMarkdown('![youtube-embed](abc123)') // Returns: ''
 * stripMarkdown('Check <<<MENTION_USER:Qm...>>>') // Returns: 'Check <<<MENTION_USER:Qm...>>>'
 */
export function stripMarkdown(text: string): string {
  try {
    // Pre-process: Protect mention patterns from being stripped
    // The markdown stripper treats @<address> as HTML tags and removes them
    // So we temporarily replace them with unique placeholders
    const mentionPlaceholders = new Map<string, string>();
    let processed = text
      .replace(/@<(Qm[a-zA-Z0-9]+)>/g, (match) => {
        // Use a unique placeholder that won't be affected by markdown processing
        // Use special unicode characters to avoid conflicts
        const placeholder = `⟨MENTION${mentionPlaceholders.size}⟩`;
        mentionPlaceholders.set(placeholder, match);
        return placeholder;
      })
      .replace(/!\[youtube-embed\]\([^)]+\)/g, '') // Remove YouTube embeds
      .replace(/!\[invite-card\]\([^)]+\)/g, ''); // Remove invite cards

    // Process with remark to strip standard markdown
    const result = unified()
      .use(remarkParse) // Parse markdown
      .use(remarkGfm) // Same GFM support as renderer
      .use(strip) // Official strip-markdown plugin
      .use(remarkStringify) // Convert back to string
      .processSync(processed);

    // Restore mention patterns
    let final = String(result);
    mentionPlaceholders.forEach((originalMention, placeholder) => {
      final = final.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), originalMention);
    });

    return final.trim();
  } catch (error) {
    // Fallback to original text if parsing fails
    console.warn('Failed to strip markdown:', error);
    return text;
  }
}

/**
 * Strips markdown formatting AND all mention patterns for contexts where mentions shouldn't render.
 * Use this in search results where we want pure plain text.
 *
 * Handles both raw mention patterns from message text and processed tokens.
 *
 * @param text - Text with markdown formatting and mention patterns
 * @returns Plain text without markdown or mentions
 *
 * @example
 * stripMarkdownAndMentions('**Hello** @<Qm123>') // Returns: 'Hello'
 * stripMarkdownAndMentions('Check @everyone') // Returns: 'Check'
 * stripMarkdownAndMentions('Hey @role') // Returns: 'Hey'
 */
export function stripMarkdownAndMentions(text: string): string {
  // First strip standard markdown
  let cleaned = stripMarkdown(text);

  // Then remove all mention patterns
  cleaned = cleaned
    // Remove raw user mention patterns: @<address>
    .replace(/@<Qm[a-zA-Z0-9]+>/g, '')
    // Remove @everyone
    .replace(/@everyone\b/gi, '')
    // Remove role mentions: @roleTag (any @word that's not everyone)
    .replace(/@\w+/g, '')
    // Remove processed mention tokens (in case they exist)
    .replace(/<<<MENTION_USER:[^>]+>>>/g, '')
    .replace(/<<<MENTION_EVERYONE>>>/g, '')
    .replace(/<<<MENTION_ROLE:[^>]+>>>/g, '');

  // Clean up extra whitespace from removed mentions
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Replaces user mention addresses with display names in plain text.
 * Does NOT handle markdown or styling - returns plain string.
 *
 * Use this for contexts where you want to preserve mentions but show user-friendly display names
 * (e.g., message reply previews, tooltips, plain text contexts).
 *
 * For styled React components with mentions, use NotificationItem's renderTextWithMentions() instead.
 *
 * @param text - Text with @<address> patterns
 * @param mapSenderToUser - Function to resolve addresses to user objects with displayName
 * @returns Plain text with addresses replaced by display names
 *
 * @example
 * replaceMentionsWithDisplayNames('Hello @<Qm123abc>', mapFn)
 * // Returns: 'Hello @JohnDoe'
 *
 * replaceMentionsWithDisplayNames('Hey @<Qm123> and @everyone', mapFn)
 * // Returns: 'Hey @JohnDoe and @everyone'
 */
export function replaceMentionsWithDisplayNames(
  text: string,
  mapSenderToUser: (senderId: string) => { displayName?: string } | undefined
): string {
  if (!text) return '';

  // Replace @<address> patterns with @DisplayName
  return text.replace(/@<(Qm[a-zA-Z0-9]+)>/g, (_match, address) => {
    const user = mapSenderToUser(address);
    const displayName = user?.displayName || address.substring(0, 8) + '...';
    return `@${displayName}`;
  });
}
