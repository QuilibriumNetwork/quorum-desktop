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

    // Remove unnecessary escapes added by remarkStringify
    // These escapes are added to prevent markdown interpretation but we want plain text
    final = final.replace(/\\([:.#\-*_`~\[\](){}|>!])/g, '$1');

    return final.trim();
  } catch (error) {
    // Fallback to original text if parsing fails
    console.warn('Failed to strip markdown:', error);
    return text;
  }
}

/**
 * Flexible markdown processing options for different contexts
 */
interface MarkdownProcessingOptions {
  // Content removal options
  removeMentions?: boolean;           // Remove @mentions entirely (default: false)
  removeFormatting?: boolean;         // Remove markdown syntax (default: true)
  removeStructure?: boolean;          // Remove line breaks, collapse whitespace (default: false)

  // Preservation options (for "smart" stripping)
  preserveLineBreaks?: boolean;       // Keep paragraph structure (default: true)
  preserveEmphasis?: boolean;         // Keep bold/italic intent without syntax (default: true)
  preserveHeaders?: boolean;          // Keep header content without ### syntax (default: true)

  // Processing options
  truncateLength?: number;            // Optional length limit with smart truncation
  replaceMentionsWithNames?: boolean; // Convert @<addr> to @DisplayName (default: false)
  mapSenderToUser?: (senderId: string) => { displayName?: string } | undefined;
}

/**
 * Unified markdown text processing utility
 *
 * Flexible function that can handle different levels of markdown processing:
 * - "Dumb" stripping (SearchResults): Remove everything, collapse to plain text
 * - "Smart" stripping (PinnedMessages): Preserve structure and formatting intent
 * - Custom combinations for future use cases
 *
 * @param text - Input text with markdown and mentions
 * @param options - Processing configuration
 * @returns Processed text according to options
 *
 * @example
 * // SearchResults (dumb stripping)
 * processMarkdownText('**Hello** @<Qm123>', {
 *   removeMentions: true,
 *   removeStructure: true
 * }) // Returns: 'Hello'
 *
 * // PinnedMessages (smart stripping)
 * processMarkdownText('### Title\n\n**Bold** text', {
 *   preserveLineBreaks: true,
 *   preserveEmphasis: true,
 *   truncateLength: 100
 * }) // Returns: 'Title\n\nBold text'
 */
export function processMarkdownText(text: string, options: MarkdownProcessingOptions = {}): string {
  if (!text) return '';

  const {
    removeMentions = false,
    removeFormatting = true,
    removeStructure = false,
    preserveLineBreaks = true,
    preserveEmphasis = true,
    preserveHeaders = true,
    truncateLength,
    replaceMentionsWithNames = false,
    mapSenderToUser
  } = options;

  let processed = text;

  // Step 1: Handle mentions first
  if (replaceMentionsWithNames && mapSenderToUser) {
    // Convert @<address> to @DisplayName
    processed = processed.replace(/@<(Qm[a-zA-Z0-9]+)>/g, (_match, address) => {
      const user = mapSenderToUser(address);
      const displayName = user?.displayName || address.substring(0, 8) + '...';
      return `@${displayName}`;
    });
  } else if (removeMentions) {
    // Remove all mention patterns completely
    processed = processed
      // User mentions: @<address>
      .replace(/@<Qm[a-zA-Z0-9]+>/g, '')
      // @everyone
      .replace(/@everyone\b/gi, '')
      // Role mentions: @roleName
      .replace(/@\w+/g, '')
      // Channel mentions: #[Name]<id> or #<id>
      .replace(/#(?:\[[^\]]+\])?<[^>]+>/g, '')
      // Internal tokens
      .replace(/<<<MENTION_USER:[^>]+>>>/g, '')
      .replace(/<<<MENTION_EVERYONE>>>/g, '')
      .replace(/<<<MENTION_ROLE:[^>]+>>>/g, '')
      .replace(/<<<MENTION_CHANNEL:[^>]+>>>/g, '');
  }

  // Step 2: Handle markdown formatting
  if (removeFormatting) {
    if (preserveHeaders && preserveEmphasis) {
      // Smart stripping: preserve intent but remove syntax
      processed = processed
        // Headers: ### Title → Title (preserve content)
        .replace(/^#{1,6}\s+(.+)$/gm, '$1')
        // Bold: **text** → text (preserve emphasis intent)
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Italic: *text* → text (preserve emphasis intent)
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Strikethrough: ~~text~~ → text
        .replace(/~~(.+?)~~/g, '$1')
        // Inline code: `code` → code
        .replace(/`(.+?)`/g, '$1')
        // Code blocks: ```lang\ncode\n``` → code
        .replace(/```[\s\S]*?\n([\s\S]*?)\n```/g, '$1')
        .replace(/```(.+?)```/g, '$1')
        // Links: [text](url) → text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Blockquotes: > text → text
        .replace(/^>\s+/gm, '')
        // Lists: - item → item, 1. item → item
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Horizontal rules: --- → (remove)
        .replace(/^[-*_]{3,}$/gm, '');
    } else {
      // Use existing stripMarkdown for heavy processing
      processed = stripMarkdown(processed);
    }
  }

  // Step 3: Handle structure
  if (removeStructure) {
    // Dumb stripping: collapse everything
    processed = processed.replace(/\s+/g, ' ').trim();
  } else if (preserveLineBreaks) {
    // Smart stripping: preserve meaningful structure
    processed = processed
      // Preserve paragraph breaks but clean up excess
      .replace(/\n{3,}/g, '\n\n')
      // Clean up extra spaces but preserve single line breaks
      .replace(/ +/g, ' ')
      .trim();
  }

  // Step 4: Apply truncation with smart word boundaries
  if (truncateLength && processed.length > truncateLength) {
    processed = processed
      .substring(0, truncateLength)
      .replace(/\s+\S*$/, '...'); // Clean truncation at word boundary
  }

  return processed;
}

/**
 * Strips markdown formatting AND all mention patterns for contexts where mentions shouldn't render.
 * Use this in search results where we want pure plain text.
 *
 * @deprecated Use processMarkdownText() with appropriate options for better flexibility
 * @param text - Text with markdown formatting and mention patterns
 * @returns Plain text without markdown or mentions
 */
export function stripMarkdownAndMentions(text: string): string {
  return processMarkdownText(text, {
    removeMentions: true,
    removeStructure: true,
    preserveLineBreaks: false,
    preserveEmphasis: false
  });
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
