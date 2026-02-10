import React, { useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ScrollContainer } from '../primitives';
import ClickToCopyContent from '../ui/ClickToCopyContent';
import { YouTubeFacade } from '../ui/YouTubeFacade';
import {
  extractCodeContent,
  shouldUseScrollContainer,
  getScrollContainerMaxHeight,
} from '../../utils/codeFormatting';
import { hasWordBoundaries } from '../../utils/mentionUtils';
import { createIPFSCIDRegex } from '../../utils/validation';
import {
  replaceYouTubeURLsInText,
  extractYouTubeVideoId,
} from '../../utils/youtubeUtils';
import { getValidInvitePrefixes } from '../../utils/inviteDomain';
import { getValidMessageLinkPrefixes } from '../../utils/messageLinkUtils';
import { InviteLink } from './InviteLink';
import { Icon } from '../primitives';
import type { Role, Channel } from '../../api/quorumApi';

interface MessageMarkdownRendererProps {
  content: string;
  className?: string;
  mapSenderToUser?: (senderId: string) => { displayName?: string; userIcon?: string };
  onUserClick?: (user: {
    address: string;
    displayName?: string;
    userIcon?: string;
  }, event: React.MouseEvent, context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }) => void;
  onChannelClick?: (channelId: string) => void;
  onMessageLinkClick?: (channelId: string, messageId: string) => void;
  hasEveryoneMention?: boolean;
  roleMentions?: string[];
  channelMentions?: string[];
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  messageSenderId?: string;
  currentUserAddress?: string;
  currentSpaceId?: string;
}


// Check if a URL is an invite link using dynamic domain validation
const isInviteLink = (url: string): boolean => {
  const validPrefixes = getValidInvitePrefixes();
  return validPrefixes.some(prefix => url.startsWith(prefix));
};

// Process invite links to convert them to markdown image syntax with special alt text
const processInviteLinks = (text: string): string => {
  // Replace invite links with markdown image syntax
  return text.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g, (url) => {
    if (isInviteLink(url)) {
      // Use markdown image syntax with special alt text (similar to YouTube embeds)
      return `![invite-card](${url})`;
    }
    return url;
  });
};

// Helper type for protected regions
interface ProtectedRegion {
  start: number;
  end: number;
}

// Extract protected regions where mentions/URLs should NOT be processed
// This includes: fenced code blocks, inline code, and markdown links
const getProtectedRegions = (text: string): ProtectedRegion[] => {
  const protectedRegions: ProtectedRegion[] = [];

  // Extract fenced code blocks (```...```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    protectedRegions.push({ start: match.index, end: match.index + match[0].length });
  }

  // Extract inline code (`...`)
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const isInsideCodeBlock = protectedRegions.some(
      r => match!.index >= r.start && match!.index < r.end
    );
    if (!isInsideCodeBlock) {
      protectedRegions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Extract markdown links [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const isInsideCodeBlock = protectedRegions.some(
      r => match!.index >= r.start && match!.index < r.end
    );
    if (!isInsideCodeBlock) {
      protectedRegions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return protectedRegions;
};

// Check if an index is inside a protected region
const isInProtectedRegion = (index: number, protectedRegions: ProtectedRegion[]): boolean => {
  return protectedRegions.some(r => index >= r.start && index < r.end);
};

// Stable processing functions outside component to prevent re-creation
const processURLs = (text: string): string => {
  // Step 1: Build protected regions (code blocks, inline code, existing markdown links)
  const protectedRegions: { start: number; end: number }[] = [];

  // Extract fenced code blocks (```...```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    protectedRegions.push({ start: match.index, end: match.index + match[0].length });
  }

  // Extract inline code (`...`)
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const isInsideCodeBlock = protectedRegions.some(
      r => match!.index >= r.start && match!.index < r.end
    );
    if (!isInsideCodeBlock) {
      protectedRegions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Extract existing markdown links [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const isInsideCodeBlock = protectedRegions.some(
      r => match!.index >= r.start && match!.index < r.end
    );
    if (!isInsideCodeBlock) {
      protectedRegions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Step 2: Find all URLs and convert only those not in protected regions
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const urlMatches: { index: number; url: string }[] = [];
  while ((match = urlRegex.exec(text)) !== null) {
    urlMatches.push({ index: match.index, url: match[0] });
  }

  // Filter out URLs in protected regions
  const validUrls = urlMatches.filter(({ index }) => {
    return !protectedRegions.some(r => index >= r.start && index < r.end);
  });

  // Step 3: Replace URLs from end to start to avoid index shifting
  let result = text;
  for (let i = validUrls.length - 1; i >= 0; i--) {
    const { index, url } = validUrls[i];
    const beforeUrl = result.substring(0, index);
    const afterUrl = result.substring(index + url.length);

    // Additional check: angle bracket autolinks <URL>
    if (beforeUrl.endsWith('<') && afterUrl.startsWith('>')) {
      continue; // Don't modify - already in angle bracket autolink
    }

    // Convert URL to markdown link
    result = beforeUrl + `[${url}](${url})` + afterUrl;
  }

  return result;
};

const processStandaloneYouTubeUrls = (text: string): string => {
  // Split text into lines first
  const lines = text.split('\n');

  // Process each line independently
  const processedLines = lines.map(line => {
    const trimmedLine = line.trim();

    // Check if this line contains a YouTube URL
    return replaceYouTubeURLsInText(line, (url) => {
      // Check if the line contains ONLY this URL (standalone)
      const isStandalone = trimmedLine === url.trim();

      if (isStandalone) {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          // Use markdown image syntax as signal for YouTube embed
          return `![youtube-embed](${videoId})`;
        }
      }
      // Keep inline YouTube URLs as-is for link processing
      return url;
    });
  });

  return processedLines.join('\n');
};

// Reusable copy button component - floats to right so code wraps around it
const CopyButton = ({ codeContent }: { codeContent: string }) => (
  <span className="float-right ml-2 mb-1">
    <ClickToCopyContent
      text={codeContent}
      iconSize="sm"
      iconClassName="text-subtle hover:text-main"
      tooltipLocation="top"
      copyOnContentClick={true}
    >
      {''}
    </ClickToCopyContent>
  </span>
);

export const MessageMarkdownRenderer: React.FC<MessageMarkdownRendererProps> = ({
  content,
  className = '',
  mapSenderToUser,
  onUserClick,
  onChannelClick,
  onMessageLinkClick,
  hasEveryoneMention = false,
  roleMentions = [],
  channelMentions = [],
  spaceRoles = [],
  spaceChannels = [],
  messageSenderId,
  currentUserAddress,
  currentSpaceId,
}) => {

  // Convert H1 and H2 headers to H3 since only H3 is allowed
  const convertHeadersToH3 = (text: string): string => {
    // Don't convert headers inside code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    // Extract code blocks and replace with placeholders
    let textWithPlaceholders = text.replace(codeBlockRegex, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Convert H1 and H2 to H3
    textWithPlaceholders = textWithPlaceholders
      .replace(/^##\s/gm, '### ')  // H2 to H3
      .replace(/^#\s/gm, '### ');  // H1 to H3

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      textWithPlaceholders = textWithPlaceholders.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return textWithPlaceholders;
  };

  // Fix unclosed code blocks by adding missing closing ```
  const fixUnclosedCodeBlocks = (text: string): string => {
    // Split by ``` to analyze the structure
    const parts = text.split('```');

    // If odd number of parts, we have an unclosed code block
    if (parts.length % 2 === 0) {
      // Find the last opening ``` and close it properly
      const lastPart = parts[parts.length - 1];
      // Add closing ``` on a new line to ensure proper formatting
      return text + (lastPart.endsWith('\n') ? '```' : '\n```');
    }

    return text;
  };

  // Process mentions to show displayNames with proper styling and click handling
  // Only process mentions that have word boundaries AND are not inside protected regions
  // Protected regions: code blocks, inline code, markdown links
  const processMentions = useCallback((text: string): string => {
    if (!mapSenderToUser) return text;

    // Get protected regions (code blocks, inline code, markdown links)
    const protectedRegions = getProtectedRegions(text);

    let processedText = text;

    // Only style @everyone if the message has mentions.everyone = true and has word boundaries
    if (hasEveryoneMention) {
      const everyoneMatches = Array.from(text.matchAll(/@everyone\b/gi));

      // Collect valid matches (not in protected regions and has word boundaries)
      const validMatches = [];
      for (const match of everyoneMatches) {
        if (!isInProtectedRegion(match.index!, protectedRegions) && hasWordBoundaries(text, match)) {
          validMatches.push(match);
        }
      }

      // Replace from end to beginning to avoid index shifting
      for (let i = validMatches.length - 1; i >= 0; i--) {
        const match = validMatches[i];
        const beforeText = processedText.substring(0, match.index);
        const afterText = processedText.substring(match.index! + match[0].length);
        processedText = beforeText + '<<<MENTION_EVERYONE>>>' + afterText;
      }
    }

    // Replace @<address> with safe placeholder token only if it has word boundaries
    // Using centralized IPFS CID validation pattern
    // NOTE: Must match against processedText (not original text) since @everyone replacements change indices
    const cidPattern = createIPFSCIDRegex().source; // Get the pattern without global flag
    const userMentionRegex = new RegExp(`@<(${cidPattern})>`, 'g');
    const userMatches = Array.from(processedText.matchAll(userMentionRegex));

    // Process matches in reverse order to avoid index shifting issues
    // Filter out matches in protected regions (using original text indices for protected region check)
    // Note: Protected regions are calculated on original text, but since we only replaced @everyone
    // with a longer token, protected region checks are still valid (mentions in code blocks stay in code blocks)
    const validUserMatches = [];
    for (const match of userMatches) {
      if (hasWordBoundaries(processedText, match)) {
        // Check if this position in original text was in a protected region
        // Since @everyone tokens are longer, we can't use original indices directly
        // Instead, check if the match content appears to be inside a code block in processedText
        const isInCodeBlock = isInProtectedRegion(match.index!, getProtectedRegions(processedText));
        if (!isInCodeBlock) {
          validUserMatches.push(match);
        }
      }
    }

    // Replace from end to beginning to avoid index shifting
    for (let i = validUserMatches.length - 1; i >= 0; i--) {
      const match = validUserMatches[i];
      const address = match[1];
      const beforeText = processedText.substring(0, match.index);
      const afterText = processedText.substring(match.index! + match[0].length);
      processedText = beforeText + `<<<MENTION_USER:${address}>>>` + afterText;
    }

    return processedText;
  }, [mapSenderToUser, hasEveryoneMention]);

  // Process role mentions - only render if role exists
  // Only process mentions that have word boundaries AND are not inside protected regions
  const processRoleMentions = useCallback((text: string): string => {
    if (!roleMentions || roleMentions.length === 0 || !spaceRoles || spaceRoles.length === 0) {
      return text;
    }

    // Get role data for existing roles only
    const roleData = roleMentions
      .map(roleId => {
        const role = spaceRoles.find(r => r.roleId === roleId);
        return role ? { roleTag: role.roleTag, displayName: role.displayName } : null;
      })
      .filter(Boolean) as Array<{ roleTag: string; displayName: string }>;

    // Replace @roleTag with safe placeholder (only if it has word boundaries and not in protected region)
    // NOTE: Must re-match and recalculate protected regions after each role replacement
    // because replacements change string indices
    let processed = text;
    roleData.forEach(({ roleTag, displayName }) => {
      // Recalculate protected regions on current processed text
      const protectedRegions = getProtectedRegions(processed);
      const regex = new RegExp(`@${roleTag}(?!\\w)`, 'g');
      const matches = Array.from(processed.matchAll(regex));

      // Collect valid matches (not in protected regions and has word boundaries)
      const validMatches = [];
      for (const match of matches) {
        if (!isInProtectedRegion(match.index!, protectedRegions) && hasWordBoundaries(processed, match)) {
          validMatches.push(match);
        }
      }

      // Replace from end to beginning to avoid index shifting
      for (let i = validMatches.length - 1; i >= 0; i--) {
        const match = validMatches[i];
        const beforeText = processed.substring(0, match.index);
        const afterText = processed.substring(match.index! + match[0].length);
        processed = beforeText + `<<<MENTION_ROLE:${roleTag}:${displayName}>>>` + afterText;
      }
    });

    return processed;
  }, [roleMentions, spaceRoles]);

  // Process channel mentions - only render if channel exists
  // Only process mentions that have word boundaries AND are not inside protected regions
  const processChannelMentions = useCallback((text: string): string => {
    if (!channelMentions || channelMentions.length === 0 || !spaceChannels || spaceChannels.length === 0) {
      return text;
    }

    // Get channel data for existing channels only
    const channelData = channelMentions
      .map(channelId => {
        const channel = spaceChannels.find(c => c.channelId === channelId);
        return channel ? { channelId: channel.channelId, channelName: channel.channelName } : null;
      })
      .filter(Boolean) as Array<{ channelId: string; channelName: string }>;

    // Replace #<channelId> with safe placeholder (only if it has word boundaries and not in protected region)
    // NOTE: Must re-match and recalculate protected regions after each channel replacement
    // because replacements change string indices
    let processed = text;
    channelData.forEach(({ channelId, channelName }) => {
      // Recalculate protected regions on current processed text
      const protectedRegions = getProtectedRegions(processed);
      // Escape special regex characters in channel ID
      const escapedChannelId = channelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const channelRegex = new RegExp(`#<${escapedChannelId}>`, 'g');
      const matches = Array.from(processed.matchAll(channelRegex));

      // Collect valid matches (not in protected regions and has word boundaries)
      const validMatches = [];
      for (const match of matches) {
        if (!isInProtectedRegion(match.index!, protectedRegions) && hasWordBoundaries(processed, match)) {
          validMatches.push(match);
        }
      }

      // Replace from end to beginning to avoid index shifting
      for (let i = validMatches.length - 1; i >= 0; i--) {
        const match = validMatches[i];
        const beforeText = processed.substring(0, match.index);
        const afterText = processed.substring(match.index! + match[0].length);
        processed = beforeText + `<<<MENTION_CHANNEL:${channelId}:${channelName}>>>` + afterText;
      }
    });

    return processed;
  }, [channelMentions, spaceChannels]);

  // Process message links to convert them to styled tokens (same-space only)
  // IMPORTANT: Skip processing inside code blocks and markdown link syntax
  const processMessageLinks = useCallback((text: string): string => {
    if (!currentSpaceId || !spaceChannels || spaceChannels.length === 0) {
      return text;
    }

    // Step 1: Extract protected regions (code blocks, inline code, markdown links)
    const protectedRegions: { start: number; end: number; content: string }[] = [];

    // Extract fenced code blocks (```...```)
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      protectedRegions.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0]
      });
    }

    // Extract inline code (`...`)
    const inlineCodeRegex = /`[^`]+`/g;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      // Check if this inline code is inside a fenced code block
      const isInsideCodeBlock = protectedRegions.some(
        r => match!.index >= r.start && match!.index < r.end
      );
      if (!isInsideCodeBlock) {
        protectedRegions.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[0]
        });
      }
    }

    // Extract markdown links [text](url) - to preserve intentional markdown formatting
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = markdownLinkRegex.exec(text)) !== null) {
      // Check if this is inside a code block
      const isInsideCodeBlock = protectedRegions.some(
        r => match!.index >= r.start && match!.index < r.end
      );
      if (!isInsideCodeBlock) {
        protectedRegions.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[0]
        });
      }
    }

    // Step 2: Build regex dynamically from valid prefixes
    const prefixes = getValidMessageLinkPrefixes();
    const prefixPattern = prefixes
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    // Match message link URLs
    const messageLinkRegex = new RegExp(
      `(?:${prefixPattern})([^/]+)/([^#]+)#msg-([a-zA-Z0-9_-]+)`,
      'g'
    );

    let processed = text;
    const matches = Array.from(text.matchAll(messageLinkRegex));

    // Collect valid matches with word boundary validation AND not in protected regions
    const validMatches = [];
    for (const matchItem of matches) {
      // Skip if inside a protected region (code block, inline code, or markdown link)
      const isProtected = protectedRegions.some(
        r => matchItem.index! >= r.start && matchItem.index! < r.end
      );
      if (isProtected) {
        continue;
      }

      if (hasWordBoundaries(text, matchItem)) {
        validMatches.push(matchItem);
      }
    }

    // Process matches in reverse order to avoid index shifting
    for (let i = validMatches.length - 1; i >= 0; i--) {
      const matchItem = validMatches[i];
      const [fullMatch, spaceId, channelId, messageId] = matchItem;

      // CRITICAL: Only process links to CURRENT space
      if (spaceId !== currentSpaceId) {
        continue; // Leave cross-space links as plain URLs
      }

      // Find channel name from spaceChannels
      const channel = spaceChannels.find(c => c.channelId === channelId);
      if (!channel) {
        continue; // Channel not found - leave as plain URL
      }

      const channelName = channel.channelName;
      const beforeText = processed.substring(0, matchItem.index);
      const afterText = processed.substring(matchItem.index! + fullMatch.length);

      // Simplified token format (spaceId implicit - current space only)
      processed = beforeText + `<<<MESSAGE_LINK:${channelId}:${messageId}:${channelName}>>>` + afterText;
    }

    return processed;
  }, [currentSpaceId, spaceChannels]);

  // Shared function to process mention tokens and spoiler syntax into React components
  // Spoilers (||text||) are detected here directly - content renders as plain text
  const processMentionTokens = useCallback((text: string): React.ReactNode[] => {
    // Check if text contains any mention, message link, or spoiler tokens
    const hasTokens = text.includes('<<<MENTION_') || text.includes('<<<MESSAGE_LINK:') || text.includes('||');

    if (!hasTokens) {
      return [text];
    }

    // Split text by mention tokens and render each part
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex to find all mention tokens (everyone, user, role, channel), message link tokens, and spoilers
    // Using centralized IPFS CID validation pattern
    // SECURITY: Added quantifier limits to prevent catastrophic backtracking attacks
    // Capture group mapping:
    // match[1] = Full token content (MENTION_..., MESSAGE_LINK:...)
    // match[2] = MENTION subtype (EVERYONE, USER:..., ROLE:..., CHANNEL:...)
    // match[3] = USER address
    // match[4] = ROLE roleTag
    // match[5] = ROLE displayName
    // match[6] = CHANNEL channelId
    // match[7] = CHANNEL channelName
    // match[8] = MESSAGE_LINK channelId
    // match[9] = MESSAGE_LINK messageId
    // match[10] = MESSAGE_LINK channelName
    // match[11] = SPOILER content (plain text inside ||...||)
    const cidPattern = createIPFSCIDRegex().source; // Get the pattern without global flag
    // Combined regex for <<< >>> tokens and ||spoiler|| syntax
    const tokenRegex = new RegExp(
      `<<<(` +
        `MENTION_(EVERYONE|USER:(${cidPattern})|ROLE:([^:]{1,50}):([^>]{1,200})|CHANNEL:([^:>]{1,50}):([^:>]{1,200}))|` +
        `MESSAGE_LINK:([^:>]{1,100}):([^:>]{1,100}):([^>]{0,200})` +
      `)>>>|` +
      `\\|\\|([^|]{1,500})\\|\\|`,
      'g'
    );
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      // Add text before the token
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Determine token type and render appropriately
      if (match[2] === 'EVERYONE') {
        // @everyone mention
        parts.push(
          <span key={`mention-${match.index}`} className="message-mentions-everyone">
            @everyone
          </span>
        );
      } else if (match[3]) {
        // User mention: <<<MENTION_USER:address>>>
        const address = match[3];
        if (mapSenderToUser && onUserClick) {
          const user = mapSenderToUser(address);
          const displayName = user?.displayName || address.substring(0, 8) + '...';

          parts.push(
            <span
              key={`mention-${match.index}`}
              className="message-mentions-user interactive"
              data-user-address={address}
              data-user-display-name={displayName}
              data-user-icon={user?.userIcon || ''}
            >
              @{displayName}
            </span>
          );
        } else {
          // Fallback if handlers not available
          parts.push(match[0]);
        }
      } else if (match[4] && match[5]) {
        // Role mention: <<<MENTION_ROLE:roleTag:displayName>>>
        const roleTag = match[4];
        const displayName = match[5];
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="message-mentions-role"
            title={displayName}
          >
            @{roleTag}
          </span>
        );
      } else if (match[6] && match[7]) {
        // Channel mention: <<<MENTION_CHANNEL:channelId:channelName>>>
        const channelId = match[6];
        const channelName = match[7];
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="message-mentions-channel interactive"
            data-channel-id={channelId}
          >
            #{channelName}
          </span>
        );
      } else if (match[8] && match[9] && match[10]) {
        // Message link: <<<MESSAGE_LINK:channelId:messageId:channelName>>>
        const channelId = match[8];
        const messageId = match[9];
        const channelName = match[10];

        parts.push(
          <span
            key={`message-link-${match.index}`}
            className="message-mentions-message-link interactive"
            data-channel-id={channelId}
            data-message-id={messageId}
          >
            #{channelName}
            <span className="message-mentions-message-link__separator"> › </span>
            <Icon name="message" size="sm" variant="filled" className="message-mentions-message-link__icon" />
          </span>
        );
      } else if (match[11]) {
        // Spoiler: ||content|| - renders as plain text when revealed
        const spoilerContent = match[11];
        parts.push(
          <span
            key={`spoiler-${match.index}`}
            className="message-spoiler"
            onClick={(e) => {
              e.currentTarget.classList.toggle('message-spoiler--revealed');
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              // Keyboard accessibility: reveal spoiler with Enter or Space
              if (e.key === 'Enter' || e.key === ' ') {
                e.currentTarget.classList.toggle('message-spoiler--revealed');
                e.stopPropagation();
                e.preventDefault(); // Prevent Space from scrolling page
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Click to reveal spoiler"
          >
            {spoilerContent}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last mention
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  }, [mapSenderToUser, onUserClick]);

  // Simplified processing pipeline with stable dependencies
  // NOTE: processMessageLinks BEFORE processURLs to prevent double-processing
  // NOTE: Spoilers (||text||) are detected in processMentionTokens after markdown rendering
  const processedContent = useMemo(() => {
    return fixUnclosedCodeBlocks(
      convertHeadersToH3(
        processURLs(
          processMessageLinks(
            processChannelMentions(
              processRoleMentions(
                processMentions(
                  processStandaloneYouTubeUrls(
                    processInviteLinks(content)
                  )
                )
              )
            )
          )
        )
      )
    );
  }, [content, processMentions, processRoleMentions, processChannelMentions, processMessageLinks]);

  // Memoize components to prevent re-creation and YouTube component remounting
  const components = useMemo(() => ({
    // Handle text nodes to render mentions safely
    text: ({ children }: any) => {
      const text = String(children);
      return <>{processMentionTokens(text)}</>;
    },

    // Disable most headers but allow H3
    h1: () => null,
    h2: () => null,
    h3: ({ children, ...props }: any) => {
      // Process mention tokens in header text
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return processMentionTokens(child);
        }
        return child;
      });

      return (
        <h3 className="text-lg font-bold text-subtle mt-4 mb-2 first:mt-0" {...props}>
          {processedChildren}
        </h3>
      );
    },
    h4: () => null,
    h5: () => null,
    h6: () => null,

    // Handle links - render all as clickable links (including YouTube)
    a: ({ href, children, ...props }: any) => {
      // Render ALL links (including YouTube) as clickable links
      if (href) {
        // Truncate link text if it's a URL (matches href) and is too long
        // This handles auto-converted URLs like [http://...](http://...)
        // Custom link text like [click here](url) is preserved
        const childText = typeof children === 'string' ? children :
          (Array.isArray(children) && typeof children[0] === 'string' ? children[0] : null);

        const isAutoLink = childText && (childText === href || childText.startsWith('http'));
        const truncatedText = isAutoLink && childText.length > 50
          ? childText.substring(0, 50) + '...'
          : children;

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
            title={isAutoLink && childText.length > 50 ? href : undefined}
            {...props}
          >
            {truncatedText}
          </a>
        );
      }

      // If no href, just render as plain text
      return <span>{children}</span>;
    },

    // Handle images - catch YouTube embeds and invite cards marked with special alt text
    img: ({ src, alt }: any) => {
      // Handle YouTube embeds marked with special alt text
      if (alt === 'youtube-embed' && src) {
        return (
          <div className="my-2">
            <YouTubeFacade
              videoId={src}
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 560,
                aspectRatio: '16/9',
              }}
            />
          </div>
        );
      }

      // Handle invite cards marked with special alt text
      if (alt === 'invite-card' && src) {
        return (
          <div className="my-2">
            <InviteLink
              inviteLink={src}
              messageSenderId={messageSenderId}
              currentUserAddress={currentUserAddress}
            />
          </div>
        );
      }

      // Regular images - render normally (or return null if images not supported)
      return null; // or <img src={src} alt={alt} {...props} /> if you want image support
    },

    // Enhanced code block rendering with scroll and copy functionality
    pre: ({ children, ...props }: any) => {
      const codeContent = extractCodeContent(children);
      const useScroll = shouldUseScrollContainer(codeContent);
      const maxHeight = getScrollContainerMaxHeight();

      if (useScroll) {
        return (
          <div className="my-2 last:mb-0 w-full min-w-0">
            <ScrollContainer maxHeight={maxHeight} showBorder={true} borderRadius="md" className="bg-surface-4 w-full min-w-0">
              <pre className="p-3 font-mono text-subtle text-sm whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 max-w-full" {...props}>
                <CopyButton codeContent={codeContent} />
                {children}
              </pre>
            </ScrollContainer>
          </div>
        );
      }

      return (
        <div className="my-2 last:mb-0 w-full min-w-0">
          <pre className="bg-surface-4 border border-default rounded-lg p-3 font-mono text-sm text-subtle whitespace-pre-wrap break-words w-full min-w-0" {...props}>
            <CopyButton codeContent={codeContent} />
            {children}
          </pre>
        </div>
      );
    },

    // Code rendering - CSS handles inline vs block styling via `code:not(pre code)` selector
    code: ({ children, className, ...props }: any) => (
      <code className={`markdown-code ${className || ''}`} {...props}>
        {children}
      </code>
    ),

    // Style blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className="border-l-4 border-accent/50 pl-4 py-1 my-2 text-subtle italic"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Style tables with proper formatting
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-3 max-w-full min-w-0">
        <table className="min-w-full border-collapse border border-default" {...props}>
          {children}
        </table>
      </div>
    ),

    thead: ({ children, ...props }: any) => (
      <thead className="bg-surface-3" {...props}>
        {children}
      </thead>
    ),

    th: ({ children, ...props }: any) => (
      <th className="border border-default px-3 py-2 text-left font-semibold whitespace-nowrap" {...props}>
        {children}
      </th>
    ),

    td: ({ children, ...props }: any) => (
      <td className="border border-default px-3 py-2 whitespace-nowrap" {...props}>
        {children}
      </td>
    ),

    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-surface-1 transition-colors duration-150" {...props}>
        {children}
      </tr>
    ),

    // Style lists
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc ml-6 my-2 last:mb-0" {...props}>
        {children}
      </ul>
    ),

    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal ml-6 my-2 last:mb-0" {...props}>
        {children}
      </ol>
    ),

    li: ({ children, ...props }: any) => {
      // Process children recursively to find and replace mention placeholders (same as p component)
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return processMentionTokens(child);
        }
        return child;
      });

      return (
        <li className="mb-1 leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1" {...props}>
          {processedChildren}
        </li>
      );
    },

    // Style horizontal rules
    hr: ({ ...props }: any) => (
      <hr className="border-default my-4" {...props} />
    ),

    // Style paragraphs - process children to handle mentions
    p: ({ children, node, ...props }: any) => {
      // Check if this paragraph contains any images (which become block elements like YouTube or invite cards)
      // If so, render as <div> to avoid invalid <p><div> nesting
      const hasBlockEmbed =
        node?.children?.some(
          (child: any) =>
            child.tagName === 'img' &&
            (child.properties?.alt === 'youtube-embed' ||
              child.properties?.alt === 'invite-card')
        ) ?? false;

      // Process children recursively to find and replace mention placeholders
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return processMentionTokens(child);
        }
        return child;
      });

      // Use div instead of p when containing block-level embeds
      if (hasBlockEmbed) {
        return (
          <div className="mb-2 last:mb-0" {...props}>
            {processedChildren}
          </div>
        );
      }

      return (
        <p className="mb-2 last:mb-0" {...props}>
          {processedChildren}
        </p>
      );
    },

    // Style strikethrough
    del: ({ children, ...props }: any) => (
      <del className="line-through opacity-70" {...props}>
        {children}
      </del>
    ),

    // Style bold
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold text-strong" {...props}>
        {children}
      </strong>
    ),

    // Style italic
    em: ({ children, ...props }: any) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),

  }), [processMentionTokens, messageSenderId, currentUserAddress]); // processMentionTokens already captures mapSenderToUser and onUserClick

  // Handle mention clicks
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;

    // Handle user mention clicks
    if (target.classList.contains('message-mentions-user') && onUserClick) {
      const address = target.dataset.userAddress;

      if (address) {
        // SECURITY: Always do fresh user lookup for UserProfile modal to prevent impersonation
        const user = mapSenderToUser ? mapSenderToUser(address) : null;
        onUserClick({
          address,
          displayName: user?.displayName,
          userIcon: user?.userIcon,
        }, event, { type: 'mention', element: target });
      }
    }

    // Handle message link clicks (has both channelId and messageId)
    if (target.classList.contains('message-mentions-message-link') && target.dataset.messageId && onMessageLinkClick) {
      const channelId = target.dataset.channelId;
      const messageId = target.dataset.messageId;
      if (channelId && messageId) {
        onMessageLinkClick(channelId, messageId);
      }
      return; // Don't also trigger channel click
    }

    // Handle channel mention clicks (only has channelId, no messageId)
    if (target.classList.contains('message-mentions-channel') && target.dataset.channelId && onChannelClick) {
      const channelId = target.dataset.channelId;
      onChannelClick(channelId);
    }
  }, [onUserClick, onChannelClick, onMessageLinkClick, mapSenderToUser]);

  return (
    <div className={`break-words min-w-0 max-w-full overflow-hidden ${className || ''}`} onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};