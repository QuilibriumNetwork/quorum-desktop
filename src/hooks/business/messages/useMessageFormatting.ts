import { useCallback, useEffect, useMemo } from 'react';
import * as linkify from 'linkifyjs';
import {
  isYouTubeURL,
  extractYouTubeVideoId,
  getValidInvitePrefixes,
  parseMessageLink,
  createIPFSCIDRegex,
} from '@quilibrium/quorum-shared';
import type { Message as MessageType, Sticker, Role, Channel } from '@quilibrium/quorum-shared';
import { getEmbeddedMediaSrc } from '../../../utils/embeddedMedia';
import { useNameResolver } from '../../../identity';

interface UseMessageFormattingOptions {
  message: MessageType;
  stickers?: { [key: string]: Sticker };
  /**
   * Historical roster lookup. No longer read for mention-body name
   * resolution (see `processTextToken`'s user-mention branch) — that goes
   * through `src/identity`'s `useNameResolver` now, which owns both the name
   * AND the truncated-address fallback. Kept in the options shape so every
   * existing call site (Message.tsx, MessagePreview.tsx, NotificationItem.tsx)
   * can keep passing it unchanged for their other, unrelated uses.
   */
  mapSenderToUser: (senderId: string) => any;
  onImageClick: (imageUrl: string) => void;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  disableMentionInteractivity?: boolean;
  /**
   * The space THIS message's mentions resolve against — a detached surface
   * (a notification row, a bookmark) must pass its OWN message's spaceId so
   * the per-space nickname ladder applies, never the ambient route's space.
   * Also still used, unchanged, for the same-space message-link check below.
   */
  currentSpaceId?: string;
  /**
   * Whether this message's `@everyone` was authorized — the wire flag is set AND
   * the sender actually held `mention:everyone` (role-based, no owner bypass).
   * When false/omitted, `@everyone` is treated as plain text and does not
   * highlight the viewer, matching the trust rule the notification path enforces.
   * Computed by the caller (Message.tsx) where the space roles are in scope.
   */
  everyoneAuthorized?: boolean;
}

// Check if a token is an invite link using dynamic domain validation
function isInviteLink(token: string): boolean {
  const validPrefixes = getValidInvitePrefixes();
  return validPrefixes.some(prefix => token.startsWith(prefix));
}

export function useMessageFormatting(options: UseMessageFormattingOptions) {
  const { message, stickers, onImageClick, spaceRoles = [], spaceChannels = [], disableMentionInteractivity = false, currentSpaceId, everyoneAuthorized = false } = options;

  // Bulk imperative resolver for in-body @mentions — `processTextToken` is
  // called per-token inside a `.map()`/tokenization loop by every caller
  // (Message.tsx, MessagePreview.tsx, NotificationItem.tsx), so a hook
  // cannot be called per mention; `resolve()` is a pure read safe to call
  // from inside that loop, and `requestNames` below opts the whole set into
  // one batched profile fetch. Requires an ancestor <IdentityScopeProvider>
  // — every caller of this hook renders under the root one mounted in
  // App.tsx (or, for a detached surface like a notification row, under its
  // own scoped provider).
  const { resolve, requestNames } = useNameResolver();

  // Every well-formed `@<address>` mention actually present in this
  // message's text, scanned directly from the raw content — NOT filtered
  // through `message.mentions.memberIds`. That metadata field is a
  // best-effort index (used elsewhere for notification triggering) and is
  // not always populated for every address the text names; gating name
  // resolution on it is exactly how a real, well-formed mention token
  // degraded to raw unrendered text with no substitution at all. Mirrors
  // MessageMarkdownRenderer's `mentionedAddresses` (the already-correct
  // reference implementation this hook is being brought in line with).
  const mentionedAddresses = useMemo(() => {
    const set = new Set<string>();
    if (message.content.type !== 'post') return set;
    const text = Array.isArray(message.content.text)
      ? message.content.text.join(' ')
      : message.content.text;
    const cidPattern = createIPFSCIDRegex().source;
    const re = new RegExp(`@<(${cidPattern})>`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) set.add(m[1]);
    return set;
  }, [message]);

  useEffect(() => {
    requestNames(mentionedAddresses);
  }, [mentionedAddresses, requestNames]);

  // Handle image click with size checking
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>, imageUrl: string, hasThumbnail?: boolean) => {
      const img = e.currentTarget;
      // If we have a thumbnail, always allow clicking to see full image
      // Otherwise, check if the image is larger than 300px
      if (hasThumbnail || ((img.naturalWidth > 300 || img.naturalHeight > 300) && imageUrl)) {
        onImageClick(imageUrl);
      }
    },
    [onImageClick]
  );

  // Check if message mentions current user.
  // @everyone only counts when it was authorized (sender held mention:everyone),
  // so an unauthorized/spoofed @everyone doesn't trigger the viewport highlight —
  // same trust rule the styled pill and notification path enforce.
  const isMentioned = useCallback(
    (userAddress: string) => {
      return (
        message.mentions?.memberIds.includes(userAddress) ||
        (message.mentions?.everyone === true && everyoneAuthorized) ||
        false
      );
    },
    [message.mentions, everyoneAuthorized]
  );

  // Check if message content should be rendered with markdown
  const shouldUseMarkdown = useCallback(() => {
    if (message.content.type !== 'post') return false;

    // Always use markdown renderer (which is now secure after rehype-raw removal)
    // The markdown renderer handles both markdown content and plain text correctly
    return true;

    // Old logic: only use markdown if patterns detected
    // const text = Array.isArray(message.content.text)
    //   ? message.content.text.join('\n')
    //   : message.content.text;
    // return hasMarkdownPatterns(text);
  }, [message]);

  // Get processed content data for rendering
  const getContentData = useCallback(() => {
    if (message.content.type === 'post') {
      const contentArray = Array.isArray(message.content.text)
        ? message.content.text
        : message.content.text.split('\n');

      return {
        type: 'post' as const,
        content: contentArray,
        messageId: message.messageId,
        // Add full text for markdown rendering
        fullText: Array.isArray(message.content.text)
          ? message.content.text.join('\n')
          : message.content.text,
      };
    } else if (message.content.type === 'embed') {
      return {
        type: 'embed' as const,
        content: message.content as {
          imageUrl?: string;
          thumbnailUrl?: string;
          videoUrl?: string;
          width?: string;
          height?: string;
          isLargeGif?: boolean;
        },
        messageId: message.messageId,
      };
    } else if (message.content.type === 'sticker') {
      const sticker = (stickers ?? {})[message.content.stickerId];
      return {
        type: 'sticker' as const,
        sticker,
        messageId: message.messageId,
      };
    }
    return null;
  }, [message, stickers]);

  // Process text tokens for mentions, links, etc.
  const processTextToken = useCallback(
    (
      token: string,
      messageId: string,
      lineIndex: number,
      tokenIndex: number
    ) => {
      // Check for @everyone mention. Style it only when the wire flag is set AND
      // the sender was authorized (everyoneAuthorized) — an unauthorized/spoofed
      // @everyone stays plain text, matching the notification trust rule.
      if (token.match(/^@everyone$/i) && message.mentions?.everyone && everyoneAuthorized) {
        return {
          type: 'mention' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          displayName: '@everyone',
          address: 'everyone',
          isInteractive: !disableMentionInteractivity,
        };
      }

      // Check for user mentions: @<address> (legacy format only)
      const cidPattern = createIPFSCIDRegex().source;
      const userMentionRegex = new RegExp(`^@<(${cidPattern})>$`);
      const userMatch = token.match(userMentionRegex);

      if (userMatch) {
        // userMatch[1] is the address. Render as a mention for ANY
        // well-formed `@<CID>` token — NOT gated on
        // `message.mentions.memberIds` (that field is a best-effort
        // notification-triggering index, not a complete list of every
        // address the text names; gating on it is what let a real mention
        // fall all the way through to unrendered raw text with no
        // substitution at all). Matches the already-correct reference
        // implementation, `processMentions` in quorum-shared, which the
        // main message list renders through and never checks memberIds
        // either.
        const userId = userMatch[1];
        const resolved = resolve(userId, { spaceId: currentSpaceId });
        return {
          type: 'mention' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          displayName: resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name,
          address: userId,
          isInteractive: !disableMentionInteractivity,
        };
      }

      // Check for role mentions (only style if role exists in message.mentions.roleIds)
      if (token.match(/^@([a-zA-Z0-9_-]+)$/) && message.mentions?.roleIds && message.mentions.roleIds.length > 0) {
        const roleTag = token.substring(1);

        // Find the role in spaceRoles to verify it exists and get roleId
        const role = spaceRoles.find(r => r.roleTag.toLowerCase() === roleTag.toLowerCase());

        // Only render as mention if the role exists AND is in the message's roleIds
        if (role && message.mentions.roleIds.includes(role.roleId)) {
          return {
            type: 'mention' as const,
            key: `${messageId}-${lineIndex}-${tokenIndex}`,
            displayName: `@${role.roleTag}`,
            address: role.roleId,
            isInteractive: !disableMentionInteractivity,
          };
        }
      }

      // Check for channel mentions: #<channelId> (legacy format only)
      const channelMentionRegex = /^#<([^>]+)>$/;
      const channelMatch = token.match(channelMentionRegex);

      if (channelMatch && message.mentions?.channelIds && message.mentions.channelIds.length > 0) {
        // channelMatch[1] is the channelId
        const channelId = channelMatch[1];

        // Find the channel in spaceChannels to verify it exists and get channel name
        const channel = spaceChannels.find(c => c.channelId === channelId);

        // Only render as mention if the channel exists AND is in the message's channelIds
        if (channel && message.mentions.channelIds.includes(channelId)) {
          return {
            type: 'channel-mention' as const,
            key: `${messageId}-${lineIndex}-${tokenIndex}`,
            displayName: `#${channel.channelName}`,
            channelId: channelId,
            channelName: channel.channelName,
            isInteractive: !disableMentionInteractivity,
          };
        }
      }


      // Check for message links (same-space only)
      const messageLinkInfo = parseMessageLink(token);
      if (messageLinkInfo && currentSpaceId && messageLinkInfo.spaceId === currentSpaceId) {
        const channel = spaceChannels.find(c => c.channelId === messageLinkInfo.channelId);
        // Only render as message link if channel exists in current space
        if (channel) {
          return {
            type: 'message-link' as const,
            key: `${messageId}-${lineIndex}-${tokenIndex}`,
            channelId: messageLinkInfo.channelId,
            messageId: messageLinkInfo.messageId,
            channelName: channel.channelName,
            isInteractive: !disableMentionInteractivity,
          };
        }
      }

      // Check for YouTube videos using centralized utilities
      if (isYouTubeURL(token)) {
        const videoId = extractYouTubeVideoId(token);
        if (videoId) {
          const thumbnailSrc = getEmbeddedMediaSrc(
            message.content as { embeddedMedia?: Array<{ type: string; key: string; data: string; mimeType: string }> },
            'youtube-thumbnail',
            videoId
          );
          return {
            type: 'youtube' as const,
            key: `${messageId}-${lineIndex}-${tokenIndex}`,
            videoId: videoId,
            thumbnailSrc,
          };
        }
      }

      // Check for invite links using dynamic domain validation
      if (isInviteLink(token)) {
        return {
          type: 'invite' as const,
          key: `${messageId}-${tokenIndex}`,
          inviteLink: token,
        };
      }

      // Check for regular links
      if (linkify.test(token)) {
        return {
          type: 'link' as const,
          key: `${messageId}-${lineIndex}-${tokenIndex}`,
          url: linkify.find(token)[0].href,
          text: token,
        };
      }

      // Regular text
      return {
        type: 'text' as const,
        key: `${messageId}-${lineIndex}-${tokenIndex}`,
        text: token,
      };
    },
    [resolve, message.mentions, spaceRoles, spaceChannels, disableMentionInteractivity, currentSpaceId, everyoneAuthorized]
  );

  return {
    // Data processors
    getContentData,
    processTextToken,

    // Utilities
    isMentioned,
    handleImageClick,
    shouldUseMarkdown,
  };
}
