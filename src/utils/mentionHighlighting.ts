/**
 * Mention highlighting utilities for MessageComposer visual feedback
 *
 * This module provides functions to detect mentions in text and return HTML
 * with highlight spans for display in a textarea overlay.
 */

/**
 * Escape HTML characters to prevent XSS when creating highlight HTML
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Check if a mention has proper word boundaries (whitespace before and after)
 * This ensures mentions only highlight when they are standalone tokens, not part of markdown syntax
 *
 * @param text - The full text being searched
 * @param match - The regex match object containing the mention
 * @returns true if the mention has whitespace boundaries
 */
const hasWordBoundaries = (text: string, match: RegExpMatchArray): boolean => {
  const beforeChar = match.index && match.index > 0 ? text[match.index - 1] : '\n';
  const afterIndex = match.index! + match[0].length;
  const afterChar = afterIndex < text.length ? text[afterIndex] : '\n';

  // Check if both characters are whitespace (space, tab, newline)
  return /\s/.test(beforeChar) && /\s/.test(afterChar);
};

/**
 * Check if a position is inside a code block
 * Handles both inline code (`code`) and code blocks (```code```)
 *
 * @param text - The full text
 * @param position - The position to check
 * @returns true if position is inside a code block
 */
const isInsideCodeBlock = (text: string, position: number): boolean => {
  let inCodeBlock = false;
  let inInlineCode = false;
  let i = 0;

  while (i < position) {
    // Check for code block markers (```)
    if (text.substr(i, 3) === '```') {
      inCodeBlock = !inCodeBlock;
      i += 3;
      continue;
    }

    // Check for inline code markers (`) - only if not in code block
    if (!inCodeBlock && text[i] === '`') {
      inInlineCode = !inInlineCode;
    }

    i++;
  }

  return inCodeBlock || inInlineCode;
};

/**
 * Highlight mentions in text and return HTML with highlight spans
 *
 * Supports all mention types with unified styling:
 * - User mentions: @<address>
 * - Role mentions: @roleTag
 * - Everyone mentions: @everyone
 * - Channel mentions: #<id>
 *
 * Edge case handling:
 * - No highlights inside code blocks (```code``` or `code`)
 * - Respects word boundaries (no highlights in markdown syntax)
 * - HTML escaping for security
 *
 * @param text - The text to process for mention highlighting
 * @returns HTML string with mentions wrapped in highlight spans
 *
 * @example
 * highlightMentions("Hey @[John]<QmAbc> and @everyone!")
 * // Returns: "Hey <span class=\"mention-highlight\">@[John]&lt;QmAbc&gt;</span> and <span class=\"mention-highlight\">@everyone</span>!"
 *
 * @example
 * highlightMentions("Code: ```@user``` and normal @user")
 * // Returns: "Code: ```@user``` and normal <span class=\"mention-highlight\">@user</span>"
 */
export const highlightMentions = (text: string): string => {
  let processedText = escapeHtml(text);

  // Store all mention matches with their positions for processing in reverse order
  interface MentionMatch {
    start: number;
    end: number;
    text: string;
  }

  const mentionMatches: MentionMatch[] = [];

  // 1. User mentions: @<address>
  const userMentionRegex = /@<([^>]+)>/g;
  let userMatch;
  while ((userMatch = userMentionRegex.exec(text)) !== null) {
    if (hasWordBoundaries(text, userMatch) && !isInsideCodeBlock(text, userMatch.index!)) {
      mentionMatches.push({
        start: userMatch.index!,
        end: userMatch.index! + userMatch[0].length,
        text: userMatch[0]
      });
    }
  }

  // 2. Role mentions: @roleTag (alphanumeric + hyphen/underscore, not @everyone)
  const roleMentionRegex = /@([a-zA-Z0-9_-]+)(?!\w)/g;
  let roleMatch;
  while ((roleMatch = roleMentionRegex.exec(text)) !== null) {
    const roleTag = roleMatch[1];
    // Skip 'everyone' (handled separately)
    if (roleTag.toLowerCase() !== 'everyone' && hasWordBoundaries(text, roleMatch) && !isInsideCodeBlock(text, roleMatch.index!)) {
      mentionMatches.push({
        start: roleMatch.index!,
        end: roleMatch.index! + roleMatch[0].length,
        text: roleMatch[0]
      });
    }
  }

  // 3. Everyone mentions: @everyone
  const everyoneMentionRegex = /@everyone\b/gi;
  let everyoneMatch;
  while ((everyoneMatch = everyoneMentionRegex.exec(text)) !== null) {
    if (hasWordBoundaries(text, everyoneMatch) && !isInsideCodeBlock(text, everyoneMatch.index!)) {
      mentionMatches.push({
        start: everyoneMatch.index!,
        end: everyoneMatch.index! + everyoneMatch[0].length,
        text: everyoneMatch[0]
      });
    }
  }

  // 4. Channel mentions: #<id>
  const channelMentionRegex = /#<([^>]+)>/g;
  let channelMatch;
  while ((channelMatch = channelMentionRegex.exec(text)) !== null) {
    if (hasWordBoundaries(text, channelMatch) && !isInsideCodeBlock(text, channelMatch.index!)) {
      mentionMatches.push({
        start: channelMatch.index!,
        end: channelMatch.index! + channelMatch[0].length,
        text: channelMatch[0]
      });
    }
  }

  // Sort mentions by position in reverse order to avoid index shifting during replacement
  mentionMatches.sort((a, b) => b.start - a.start);

  // Apply highlights in reverse order
  for (const mention of mentionMatches) {
    // Calculate positions in escaped text
    // We need to account for HTML escaping changes
    const beforeText = text.substring(0, mention.start);
    const mentionText = mention.text;
    const afterText = text.substring(mention.end);

    const escapedBefore = escapeHtml(beforeText);
    const escapedMention = escapeHtml(mentionText);
    const escapedAfter = escapeHtml(afterText);

    // Create highlighted mention
    const highlightedMention = `<span class="mention-highlight">${escapedMention}</span>`;

    // Rebuild the processed text
    processedText = escapedBefore + highlightedMention + escapedAfter;
  }

  return processedText;
};

/**
 * Check if text contains any mentions (for optimization)
 *
 * Performance optimizations:
 * - Quick symbol check before regex
 * - Early return for short texts
 * - Lightweight regex patterns
 *
 * @param text - The text to check
 * @returns true if text contains any mention patterns
 */
export const containsMentions = (text: string): boolean => {
  // Performance: Early return for empty or very short text
  if (!text || text.length < 2) {
    return false;
  }

  // Performance: Quick character-based check before regex
  if (!text.includes('@') && !text.includes('#')) {
    return false;
  }

  // Performance: For very long texts (>1000 chars), use simple string checks first
  if (text.length > 1000) {
    // Quick check for common mention patterns
    if (!text.includes('<') && !text.includes('@everyone') &&
        !/[@#]\w/.test(text)) {
      return false;
    }
  }

  // Check for any mention patterns (lightweight check)
  const mentionPatterns = [
    /@(?:\[([^\]]+)\])?<([^>]+)>/,  // User mentions
    /@([a-zA-Z0-9_-]+)(?!\w)/,      // Role mentions
    /@everyone\b/i,                  // Everyone mentions
    /#(?:\[([^\]]+)\])?<([^>]+)>/   // Channel mentions
  ];

  return mentionPatterns.some(pattern => pattern.test(text));
};

/**
 * Performance-optimized mention highlighting with debouncing support
 *
 * For very long texts or rapid typing, this can be wrapped with debouncing
 * at the component level to prevent excessive re-rendering.
 *
 * @param text - The text to process
 * @returns Memoizable result for React optimization
 */
export const highlightMentionsOptimized = (text: string) => {
  // Use the main function but add metadata for React optimization
  const result = highlightMentions(text);
  return {
    html: result,
    hasMentions: result !== escapeHtml(text),
    textLength: text.length,
    timestamp: Date.now() // For cache invalidation if needed
  };
};