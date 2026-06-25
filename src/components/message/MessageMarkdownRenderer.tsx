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
  hasWordBoundaries,
  createIPFSCIDRegex,
  replaceYouTubeURLsInText,
  extractYouTubeVideoId,
  getValidInvitePrefixes,
  getValidMessageLinkPrefixes,
  // Message-preprocessing pipeline (shared with mobile — single source of truth).
  processMentions as sharedProcessMentions,
  processRoleMentions as sharedProcessRoleMentions,
  processChannelMentions as sharedProcessChannelMentions,
  processURLs,
  convertHeadersToH3,
  fixUnclosedCodeBlocks,
} from '@quilibrium/quorum-shared';
import { remarkTwemoji, getEmojiOnlySize } from '../../utils/remarkTwemoji';
import { InviteLink } from './InviteLink';
import { Icon } from '../primitives';
import type { Role, Channel, PostMessage } from '@quilibrium/quorum-shared';
import { getEmbeddedMediaSrc } from '../../utils/embeddedMedia';
import { formatAddress } from '@quilibrium/quorum-shared';
import { resolveSpaceMemberName, formatResolvedName, type NameResolvableUser } from '../../utils/resolveMemberName';

interface MessageMarkdownRendererProps {
  content: string;
  className?: string;
  mapSenderToUser?: (senderId: string) => NameResolvableUser | undefined;
  /**
   * Strict variant of `mapSenderToUser`. Returns null when the address is not
   * a known member, so the renderer can distinguish a real user from a
   * fallback. When provided, user mentions to unknown addresses render as
   * non-interactive truncated-address pills (no display name, no click).
   * When not provided, the renderer falls back to the legacy behavior
   * (everything is interactive whenever `onUserClick` is set).
   */
  resolveSender?: (senderId: string) => NameResolvableUser | null;
  onUserClick?: (user: {
    address: string;
    displayName?: string;
    userIcon?: string;
    bio?: string;
  }, event: React.MouseEvent, context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }) => void;
  onChannelClick?: (channelId: string) => void;
  onMessageLinkClick?: (channelId: string, messageId: string) => void;
  hasEveryoneMention?: boolean;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  messageSenderId?: string;
  currentUserAddress?: string;
  currentSpaceId?: string;
  /** Inline element appended after the last paragraph (e.g. delivery receipt checkmark) */
  suffix?: React.ReactNode;
  embeddedMedia?: PostMessage['embeddedMedia'];
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

// processURLs, getProtectedRegions, isInProtectedRegion now come from
// @quilibrium/quorum-shared (the shared message-preprocessing pipeline).

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
  resolveSender,
  onUserClick,
  onChannelClick,
  onMessageLinkClick,
  hasEveryoneMention = false,
  spaceRoles = [],
  spaceChannels = [],
  messageSenderId,
  currentUserAddress,
  currentSpaceId,
  suffix,
  embeddedMedia,
}) => {

  // convertHeadersToH3 and fixUnclosedCodeBlocks now come from
  // @quilibrium/quorum-shared (the shared message-preprocessing pipeline).

  // Process mentions → tokens. Delegates to the shared pipeline; the desktop
  // wrapper keeps the `!mapSenderToUser` guard so contexts without a user
  // resolver (e.g. some bookmark/preview surfaces) leave `@<address>` as plain
  // text instead of emitting a raw token that wouldn't be rendered. Desktop
  // never produced legacy bare-`@name` mentions, so it passes no members.
  // `hasEveryoneMention` is desktop's authorization signal → `everyoneAuthorized`.
  const processMentions = useCallback((text: string): string => {
    if (!mapSenderToUser) return text;
    return sharedProcessMentions(text, [], hasEveryoneMention);
  }, [mapSenderToUser, hasEveryoneMention]);

  // Role mentions → tokens. Resolves directly from spaceRoles (option B —
  // identical @roleTag text renders consistently; pill = "names a real role").
  const processRoleMentions = useCallback((text: string): string => {
    return sharedProcessRoleMentions(text, spaceRoles);
  }, [spaceRoles]);

  // Channel mentions → tokens. Resolves directly from spaceChannels.
  const processChannelMentions = useCallback((text: string): string => {
    return sharedProcessChannelMentions(text, spaceChannels);
  }, [spaceChannels]);

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
        //
        // Rendering rule:
        //   - resolveSender(address) returns a real user → pill shows the
        //     display name and is interactive (clickable, hover cursor).
        //   - resolveSender(address) returns null (or isn't provided and
        //     mapSenderToUser also yields nothing useful) → pill shows
        //     `formatAddress(address)` and is non-interactive (no hover
        //     cursor, no click). Communicates "this is a mention" without
        //     lying about what clicking it will do.
        //
        // Legacy fallback: when neither resolveSender nor mapSenderToUser
        // is wired, we render the raw token as plain text (the pre-existing
        // behavior for surfaces that haven't opted in).
        const address = match[3];
        if (resolveSender || mapSenderToUser) {
          // Two independent signals:
          //   isResolved → "did the lookup actually find a real user?"
          //     Used for interactivity (only interactive when we have a user
          //     the click can actually navigate to).
          //   has-display-name → "do we have a name we can show?"
          //     Used purely for the label. A resolved user with no display
          //     name still gets the truncated address as a fallback label,
          //     but stays interactive because the click still has a target.
          //
          // TODO: once all callsites of mapSenderToUser have migrated to
          // resolveSender, drop the legacy branch — until then unknown users
          // in legacy contexts still resolve to the slice-of-address fallback
          // and remain interactive, matching pre-existing behavior.
          const resolvedUser = resolveSender
            ? resolveSender(address)
            : (mapSenderToUser ? mapSenderToUser(address) : null);
          const isResolved = resolvedUser != null;
          // Model B: a mentioned user shows their QNS name (name.q) unless they
          // have a per-space name. The mention's stored token stays the address;
          // only the displayed label changes.
          const displayName = resolvedUser
            ? formatResolvedName(
                resolveSpaceMemberName({
                  address: resolvedUser.address ?? address,
                  displayName: resolvedUser.displayName,
                  primaryUsername: resolvedUser.primaryUsername,
                  globalDisplayName: resolvedUser.globalDisplayName,
                }),
              )
            : formatAddress(address);
          const interactive = isResolved && !!onUserClick;

          parts.push(
            <span
              key={`mention-${match.index}`}
              className={`message-mentions-user ${interactive ? 'interactive' : 'non-interactive'}`}
              data-user-address={address}
              data-user-display-name={displayName}
              data-user-icon={resolvedUser?.userIcon || ''}
            >
              @{displayName}
            </span>
          );
        } else {
          // No lookup available — render the raw token as plain text
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
  }, [mapSenderToUser, resolveSender, onUserClick]);

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

  // "Jumbo emoji": when a message is nothing but emoji, render them larger.
  // 1 emoji → 64px, 2-3 → 48px, 4+ → normal inline size (sizes set in _chat.scss).
  // Computed from the raw content (before token processing) so mentions, links,
  // and other text correctly disqualify the message.
  const emojiOnlySize = useMemo(() => getEmojiOnlySize(content), [content]);
  const emojiSizeClass = emojiOnlySize ? `twemoji-jumbo twemoji-jumbo--${emojiOnlySize}` : '';

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

    // Handle images - catch YouTube embeds, invite cards, and Twemoji images
    img: ({ src, alt }: any) => {
      // Handle Twemoji images — construct src from alt codepoint, never from AST src
      if (typeof alt === 'string' && alt.startsWith('twemoji-')) {
        const unified = alt.slice('twemoji-'.length);
        return (
          <img
            src={`/twitter/64/${unified}.png`}
            alt={alt}
            className="twemoji"
            draggable={false}
          />
        );
      }

      // Handle YouTube embeds marked with special alt text
      if (alt === 'youtube-embed' && src) {
        const thumbnailSrc = getEmbeddedMediaSrc(
          { embeddedMedia },
          'youtube-thumbnail',
          src
        );
        return (
          <div className="my-2">
            <YouTubeFacade
              videoId={src}
              thumbnailSrc={thumbnailSrc}
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

    // Handle user mention clicks. Non-interactive pills (unresolved senders)
    // intentionally swallow the click so the cursor and behavior match.
    if (
      target.classList.contains('message-mentions-user') &&
      target.classList.contains('interactive') &&
      onUserClick
    ) {
      const address = target.dataset.userAddress;

      if (address) {
        // SECURITY: Always do fresh user lookup for UserProfile modal to prevent impersonation
        const user = resolveSender
          ? resolveSender(address)
          : (mapSenderToUser ? mapSenderToUser(address) : null);
        onUserClick({
          address,
          displayName: user?.displayName,
          userIcon: user?.userIcon,
          bio: (user as { bio?: string } | null)?.bio,
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
  }, [onUserClick, onChannelClick, onMessageLinkClick, mapSenderToUser, resolveSender]);

  return (
    <div className={`break-words min-w-0 max-w-full overflow-hidden ${emojiSizeClass} ${suffix ? 'has-inline-suffix' : ''} ${className || ''}`} onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkTwemoji]}
        rehypePlugins={[]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
      {suffix}
    </div>
  );
};