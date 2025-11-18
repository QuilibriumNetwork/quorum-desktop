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
  isYouTubeURL,
  replaceYouTubeURLsInText,
  extractYouTubeVideoId,
  YOUTUBE_URL_DETECTION_REGEX
} from '../../utils/youtubeUtils';
import { getValidInvitePrefixes } from '../../utils/inviteDomain';
import { InviteLink } from './InviteLink';
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
  hasEveryoneMention?: boolean;
  roleMentions?: string[];
  channelMentions?: string[];
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  messageSenderId?: string;
  currentUserAddress?: string;
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

// Stable processing functions outside component to prevent re-creation
const processURLs = (text: string): string => {
  // Replace non-YouTube URLs with markdown links, avoiding code blocks and existing markdown links
  return text.replace(/^(?!.*```[\s\S]*?```.*$)(.*)$/gm, (line) => {
    // Only process lines that don't contain code blocks
    if (line.includes('```')) {
      return line;
    }

    // Replace non-YouTube URLs with markdown links, but avoid URLs already in markdown links or angle brackets
    return line.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g, (url, offset) => {
      // Check if this URL is already part of a markdown link or angle bracket autolink
      const beforeUrl = line.substring(0, offset);
      const afterUrl = line.substring(offset + url.length);

      // Look for markdown link pattern: ](URL) - URL is already inside a markdown link
      if (beforeUrl.includes('](') || (beforeUrl.endsWith('](') && afterUrl.startsWith(')'))) {
        return url; // Don't modify - already in markdown link
      }

      // Look for partial markdown link pattern: [text](URL - we're at the URL part
      const linkStart = beforeUrl.lastIndexOf('[');
      const linkMiddle = beforeUrl.lastIndexOf('](');
      if (linkStart > -1 && linkMiddle > linkStart && linkMiddle === beforeUrl.length - 2) {
        return url; // Don't modify - already in markdown link
      }

      // Look for angle bracket autolinks: <URL>
      if (beforeUrl.endsWith('<') && afterUrl.startsWith('>')) {
        return url; // Don't modify - already in angle bracket autolink
      }

      // Convert ALL URLs to markdown links (including YouTube URLs)
      return `[${url}](${url})`;
    });
  });
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

// Reusable copy button component - outside component to prevent re-creation
const CopyButton = ({ codeContent }: { codeContent: string }) => (
  <div className="absolute top-1 right-1 w-8 h-8 z-50">
    <ClickToCopyContent
      text={codeContent}
      className="w-full h-full flex items-center justify-center"
      iconSize="sm"
      iconClassName="text-subtle hover:text-main"
      tooltipLocation="top"
      copyOnContentClick={true}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4"></div>
      </div>
    </ClickToCopyContent>
  </div>
);

export const MessageMarkdownRenderer: React.FC<MessageMarkdownRendererProps> = ({
  content,
  className = '',
  mapSenderToUser,
  onUserClick,
  onChannelClick,
  hasEveryoneMention = false,
  roleMentions = [],
  channelMentions = [],
  spaceRoles = [],
  spaceChannels = [],
  messageSenderId,
  currentUserAddress,
}) => {

  // Convert H1 and H2 headers to H3 since only H3 is allowed
  const convertHeadersToH3 = (text: string): string => {
    // Don't convert headers inside code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    // Extract code blocks and replace with placeholders
    let textWithPlaceholders = text.replace(codeBlockRegex, (match, index) => {
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

  // Sanitize display names for safe token creation
  const sanitizeDisplayName = useCallback((displayName: string | null | undefined): string => {
    if (!displayName) return '';

    // Remove >>> characters that could break token parsing
    // Limit length to prevent performance issues (matches regex limits)
    return displayName
      .replace(/>>>/g, '') // Remove token-breaking characters
      .substring(0, 200)   // Match regex limit of {0,200}
      .trim();
  }, []);

  // Process mentions to show displayNames with proper styling and click handling
  // Only process mentions that have word boundaries (whitespace before and after)
  const processMentions = useCallback((text: string): string => {
    if (!mapSenderToUser) return text;

    let processedText = text;

    // Only style @everyone if the message has mentions.everyone = true and has word boundaries
    if (hasEveryoneMention) {
      const everyoneMatches = Array.from(text.matchAll(/@everyone\b/gi));

      // Collect valid matches
      const validMatches = [];
      for (const match of everyoneMatches) {
        if (hasWordBoundaries(text, match)) {
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

    // Replace @<address> OR @[Display Name]<address> with safe placeholder token only if it has word boundaries
    // Using centralized IPFS CID validation pattern
    const cidPattern = createIPFSCIDRegex().source; // Get the pattern without global flag
    const userMentionRegex = new RegExp(`@(?:\\[([^\\]]+)\\])?<(${cidPattern})>`, 'g');
    const userMatches = Array.from(text.matchAll(userMentionRegex));

    // Process matches in reverse order to avoid index shifting issues
    const validMatches = [];
    for (const match of userMatches) {
      if (hasWordBoundaries(text, match)) {
        validMatches.push(match);
      }
    }

    // Replace from end to beginning to avoid index shifting
    for (let i = validMatches.length - 1; i >= 0; i--) {
      const match = validMatches[i];
      const inlineDisplayName = match[1]; // Optional display name from @[Name]<address>
      const address = match[2]; // Address is now in match[2] due to optional group
      const beforeText = processedText.substring(0, match.index);
      const afterText = processedText.substring(match.index! + match[0].length);
      // Include sanitized inline display name in token for rendering preference
      const sanitizedDisplayName = sanitizeDisplayName(inlineDisplayName);
      processedText = beforeText + `<<<MENTION_USER:${address}:${sanitizedDisplayName}>>>` + afterText;
    }

    return processedText;
  }, [mapSenderToUser, hasEveryoneMention, sanitizeDisplayName]);

  // Process role mentions - only render if role exists
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

    // Replace @roleTag with safe placeholder (only if it has word boundaries)
    let processed = text;
    roleData.forEach(({ roleTag, displayName }) => {
      const regex = new RegExp(`@${roleTag}(?!\\w)`, 'g');
      const matches = Array.from(text.matchAll(regex));

      // Collect valid matches
      const validMatches = [];
      for (const match of matches) {
        if (hasWordBoundaries(text, match)) {
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

    // Replace #<channelId> with safe placeholder (only if it has word boundaries)
    let processed = text;
    channelData.forEach(({ channelId, channelName }) => {
      // Escape special regex characters in channel ID
      const escapedChannelId = channelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Support both formats: #<channelId> and #[Channel Name]<channelId>
      const channelRegex = new RegExp(`#(?:\\[([^\\]]+)\\])?<${escapedChannelId}>`, 'g');
      const matches = Array.from(text.matchAll(channelRegex));

      // Collect valid matches
      const validMatches = [];
      for (const match of matches) {
        if (hasWordBoundaries(text, match)) {
          validMatches.push(match);
        }
      }

      // Replace from end to beginning to avoid index shifting
      for (let i = validMatches.length - 1; i >= 0; i--) {
        const match = validMatches[i];
        const inlineDisplayName = match[1]; // Optional display name from #[Name]<channelId>
        const beforeText = processed.substring(0, match.index);
        const afterText = processed.substring(match.index! + match[0].length);
        // Include sanitized inline display name in token for rendering preference
        const sanitizedDisplayName = sanitizeDisplayName(inlineDisplayName);
        processed = beforeText + `<<<MENTION_CHANNEL:${channelId}:${channelName}:${sanitizedDisplayName}>>>` + afterText;
      }
    });

    return processed;
  }, [channelMentions, spaceChannels, sanitizeDisplayName]);

  // Shared function to process mention tokens into React components
  const processMentionTokens = useCallback((text: string): React.ReactNode[] => {
    // Check if text contains any mention tokens
    const hasMentions = text.includes('<<<MENTION_');

    if (!hasMentions) {
      return [text];
    }

    // Split text by mention tokens and render each part
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex to find all mention tokens (everyone, user, role, channel)
    // Updated to support inline display names: USER:address:inlineDisplayName and CHANNEL:id:name:inlineDisplayName
    // Using centralized IPFS CID validation pattern
    // SECURITY: Added quantifier limits to prevent catastrophic backtracking attacks
    const cidPattern = createIPFSCIDRegex().source; // Get the pattern without global flag
    const mentionRegex = new RegExp(`<<<MENTION_(EVERYONE|USER:(${cidPattern}):([^>]{0,200})|ROLE:([^:]{1,50}):([^>]{1,200})|CHANNEL:([^:>]{1,50}):([^:>]{1,200}):([^>]{0,200}))>>>`, 'g');
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Determine mention type and render appropriately
      if (match[1] === 'EVERYONE') {
        // @everyone mention
        parts.push(
          <span key={`mention-${match.index}`} className="message-name-mentions-everyone">
            @everyone
          </span>
        );
      } else if (match[2]) {
        // User mention: <<<MENTION_USER:address:inlineDisplayName>>>
        const address = match[2];
        const inlineDisplayName = match[3]; // Optional inline display name
        if (mapSenderToUser && onUserClick) {
          const user = mapSenderToUser(address);
          // SECURITY: Only use actual user data - ignore inline display names to prevent impersonation
          const displayName = user?.displayName || address.substring(0, 8) + '...';

          parts.push(
            <span
              key={`mention-${match.index}`}
              className="message-name-mentions-you interactive"
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
            className="message-name-mentions-everyone"
            title={displayName}
          >
            @{roleTag}
          </span>
        );
      } else if (match[6] && match[7]) {
        // Channel mention: <<<MENTION_CHANNEL:channelId:channelName:inlineDisplayName>>>
        const channelId = match[6];
        const channelName = match[7];
        const inlineDisplayName = match[8]; // Optional inline display name
        // Prefer inline display name, then channel lookup name
        const displayName = inlineDisplayName || channelName;
        parts.push(
          <span
            key={`mention-${match.index}`}
            className="message-name-mentions-you interactive"
            data-channel-id={channelId}
          >
            #{displayName}
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
  const processedContent = useMemo(() => {
    return fixUnclosedCodeBlocks(
      convertHeadersToH3(
        processURLs(
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
    );
  }, [content, processMentions, processRoleMentions, processChannelMentions]);

  // Memoize components to prevent re-creation and YouTube component remounting
  const components = useMemo(() => ({
    // Handle text nodes to render mentions safely
    text: ({ children, ...props }: any) => {
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
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
            {...props}
          >
            {children}
          </a>
        );
      }

      // If no href, just render as plain text
      return <span>{children}</span>;
    },

    // Handle images - catch YouTube embeds and invite cards marked with special alt text
    img: ({ src, alt, ...props }: any) => {
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
          <div className="relative my-2 last:mb-0 w-full min-w-0">
            <CopyButton codeContent={codeContent} />
            <ScrollContainer maxHeight={maxHeight} showBorder={true} borderRadius="md" className="bg-surface-4 w-full min-w-0">
              <pre className="p-3 font-mono text-subtle text-sm whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 max-w-full" {...props}>
                {children}
              </pre>
            </ScrollContainer>
          </div>
        );
      }

      return (
        <div className="relative my-2 last:mb-0 w-full min-w-0">
          <CopyButton codeContent={codeContent} />
          <pre className="bg-surface-4 border border-default rounded-lg p-3 font-mono text-sm text-subtle whitespace-pre-wrap break-words w-full min-w-0" {...props}>
            {children}
          </pre>
        </div>
      );
    },

    // Simple inline code rendering without copy functionality
    code: ({ children, className, ...props }: any) => {
      const isCodeBlock = className?.includes('language-');

      // If this is part of a code block, let the pre handler deal with it
      if (isCodeBlock) {
        return <code className={className} {...props}>{children}</code>;
      }

      // Simple inline code styling
      return (
        <code
          className="bg-surface-4 border border-default px-1.5 py-0.5 rounded text-xs font-mono mx-0.5 text-accent-500"
          {...props}
        >
          {children}
        </code>
      );
    },

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

    li: ({ children, ...props }: any) => (
      <li className="mb-1 leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1" {...props}>
        {children}
      </li>
    ),

    // Style horizontal rules
    hr: ({ ...props }: any) => (
      <hr className="border-default my-4" {...props} />
    ),

    // Style paragraphs - process children to handle mentions
    p: ({ children, node, ...props }: any) => {
      // Check if this paragraph contains only an image (which could be YouTube or invite card)
      // If so, render it unwrapped to avoid invalid <p><div> nesting
      if (node && node.children && node.children.length === 1) {
        const firstChild = node.children[0];
        // Check if the only child is an image node (our embeds use image syntax)
        if (firstChild.tagName === 'img') {
          // This paragraph contains only an embed - render children without <p> wrapper
          return <>{children}</>;
        }
      }

      // Process children recursively to find and replace mention placeholders
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return processMentionTokens(child);
        }
        return child;
      });

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

  }), [mapSenderToUser, onUserClick, processMentionTokens]); // Dependencies for mention handling in text, h3, and p components

  // Handle mention clicks
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;

    // Handle user mention clicks
    if (target.classList.contains('message-name-mentions-you') && onUserClick) {
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

    // Handle channel mention clicks
    if (target.dataset.channelId && onChannelClick) {
      const channelId = target.dataset.channelId;
      onChannelClick(channelId);
    }
  }, [onUserClick, onChannelClick, mapSenderToUser]);

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