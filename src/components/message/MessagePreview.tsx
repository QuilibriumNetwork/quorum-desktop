import React from 'react';
import type { Message as MessageType, Sticker, Role, Channel, Space } from '@quilibrium/quorum-shared';
import { Flex, Spacer, Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageFormatting } from '../../hooks/business/messages/useMessageFormatting';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import { formatMessageDate } from '../../utils';
import { processMarkdownText, hasPermission } from '@quilibrium/quorum-shared';
import { getEmbeddedMediaSrc } from '../../utils/embeddedMedia';
import { MemberName, IdentityScopeProvider } from '../../identity';
import { useMultiSpaceRosters, useLocalDmNames } from '../../hooks/business/identity';

// Helper function to process text with mentions and special tokens after smart markdown stripping
const renderPreviewTextWithSpecialTokens = (
  text: string,
  formatting: any,
  messageId: string,
  disableMentionInteractivity: boolean,
  onChannelClick?: (channelId: string) => void,
  onMessageLinkClick?: (channelId: string, messageId: string) => void
): React.ReactNode => {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Smart tokenization: preserve mention patterns as single tokens
    // Matches: @<address> or #<channelId>
    // Falls back to space-delimited words for regular text
    const mentionPattern = /(@<[^>]+>|#<[^>]+>)/g;
    const tokens: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(line)) !== null) {
      // Add any text before this mention (split by spaces)
      if (match.index > lastIndex) {
        const beforeText = line.slice(lastIndex, match.index);
        tokens.push(...beforeText.split(' ').filter(t => t));
      }
      // Add the mention as a single token
      tokens.push(match[0]);
      lastIndex = match.index + match[0].length;
    }
    // Add any remaining text after the last mention
    if (lastIndex < line.length) {
      const afterText = line.slice(lastIndex);
      tokens.push(...afterText.split(' ').filter(t => t));
    }

    const renderedTokens: React.ReactNode[] = [];

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      const tokenData = formatting.processTextToken(token, messageId, i, j);

      if (tokenData.type === 'mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            {tokenData.prefix}
            <span
              className={`message-mentions-user ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
            >
              {tokenData.displayName}
            </span>
            {tokenData.suffix}{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'channel-mention') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span
              className={`message-mentions-channel ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
              onClick={!disableMentionInteractivity ? () => onChannelClick?.(tokenData.channelId) : undefined}
            >
              {tokenData.displayName}
            </span>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'link') {
        // Truncate long URLs to 50 chars (matching MessageMarkdownRenderer)
        const isLongUrl = tokenData.text.length > 50;
        const displayText = isLongUrl
          ? tokenData.text.substring(0, 50) + '...'
          : tokenData.text;

        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <a
              href={tokenData.url}
              target="_blank"
              referrerPolicy="no-referrer"
              className="link"
              title={isLongUrl ? tokenData.url : undefined}
              style={{ fontSize: 'inherit', wordBreak: 'break-all' }}
            >
              {displayText}
            </a>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'youtube') {
        renderedTokens.push(
          <div key={tokenData.key} className="message-preview-youtube">
            <YouTubeEmbed
              src={'https://www.youtube.com/embed/' + tokenData.videoId}
              allow="autoplay; encrypted-media"
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 300,
                aspectRatio: '16/9',
              }}
              previewOnly={true}
            />
          </div>
        );
      } else if (tokenData.type === 'invite') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span className="text-accent">[Invite Link]</span>{' '}
          </React.Fragment>
        );
      } else if (tokenData.type === 'message-link') {
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            <span
              className={`message-mentions-message-link ${disableMentionInteractivity ? 'non-interactive' : 'interactive'}`}
              onClick={!disableMentionInteractivity ? () => onMessageLinkClick?.(tokenData.channelId, tokenData.messageId) : undefined}
            >
              #{tokenData.channelName}
              <span className="message-mentions-message-link__separator"> › </span>
              <Icon name="message" size="sm" variant="filled" className="message-mentions-message-link__icon" />
            </span>{' '}
          </React.Fragment>
        );
      } else {
        // This is already processed by smart markdown stripping, so just render the clean text
        renderedTokens.push(
          <React.Fragment key={tokenData.key}>
            {tokenData.text}{' '}
          </React.Fragment>
        );
      }
    }

    return (
      <React.Fragment key={`line-${i}`}>
        {renderedTokens}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

interface MessagePreviewProps {
  message: MessageType;
  mapSenderToUser?: (senderId: string) => any;
  stickers?: { [key: string]: Sticker };
  showBackground?: boolean;
  hideHeader?: boolean;
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
  onMessageLinkClick?: (channelId: string, messageId: string) => void;
  disableMentionInteractivity?: boolean;
  currentSpaceId?: string;
}

/**
 * `MessagePreview` is handed to hosts that render far from where it was
 * BUILT — `showConfirmationModal`'s `preview` (`usePinnedMessages.ts`'s
 * `togglePin`, `useMessageActions.ts`'s `handleDelete`) is constructed
 * inside a Channel/DirectMessage's identity scope but RENDERED by
 * `Layout.tsx`'s `ConfirmationModalProvider`, a sibling of the app shell
 * mounted outside any Channel/DirectMessage `<IdentityScopeProvider>`.
 * React resolves context where an element is RENDERED, not where
 * `React.createElement`/JSX built it — so a name-resolving hook inside this
 * component would see whatever ancestor sits above the MODAL HOST (App.tsx's
 * root provider, `rostersBySpace={}}`), not above the button that built the
 * element. For a member with no cached public profile, that empty roster
 * means every tier comes up empty and the address renders truncated, even
 * though the exact same member resolves correctly a few pixels away in the
 * Pinned Messages panel (which renders INSIDE Channel's own provider).
 *
 * Fix: mount our OWN scope here, scoped to `currentSpaceId`, exactly like
 * `ReactionsModal`/`BookmarksPage`/`GlobalNotificationsModal` already do for
 * their own detached surfaces — never depend on an ambient provider being
 * present. `useMultiSpaceRosters` shares its query key/fetcher with
 * `useSpaceMembers` (`buildSpaceMembersKey`), so when this DOES render
 * nested inside an already-open Channel (`PinnedMessagesPanel`), the roster
 * read here is the SAME cached entry Channel's own provider was built
 * from — an inner provider refining with identical data, never a second,
 * emptier source that could shadow a working outer one. Also carries
 * `useLocalDmNames` (the same reusable source `SearchResults.tsx` and the
 * root provider use), so a DM partner known only from their local
 * conversation record — no public profile, no space roster row — still
 * resolves to their name rather than a truncated address inside a preview
 * (e.g. the delete-confirmation dialog for a DM message).
 *
 * SECOND DEFECT, fixed here too: `currentSpaceId` is not always a real
 * Space. `useMessageActions.ts`'s `handleDelete` builds this preview with
 * `currentSpaceId: spaceId || message.spaceId` — for a message inside a DM,
 * `message.spaceId` IS the peer's address (the app-wide convention: a DM's
 * spaceId === channelId === the peer's address, see `MessageList.tsx:118`,
 * `Message.tsx:384-396`, and the identical `message.spaceId ===
 * message.channelId` check `SearchResults.tsx`/`SearchResultItem.tsx` already
 * use). Passing that pseudo-spaceId straight to the provider's own `spaceId`
 * forces the SPACE ladder — a per-space-nickname tier that cannot exist for
 * a DM — where `DirectMessage.tsx` deliberately resolves on the GLOBAL
 * ladder. `isDM` below detects this the same way those other call sites do:
 * reliably, not heuristically — a real Space channel's `channelId` is a
 * distinct id generated at channel creation and is never equal to its own
 * `spaceId` by construction (every write site that checks this convention,
 * `MessageService.ts`/`ThreadService.ts` among them, relies on the same
 * fact), so the comparison cannot false-positive on an ordinary channel
 * message. On a match, `currentSpaceId` is withheld from the provider
 * entirely (both the roster fetch and `spaceId` prop), which is exactly the
 * `rostersBySpace={{}}` + no-`spaceId` shape `DirectMessage.tsx` itself uses.
 */
export const MessagePreview: React.FC<MessagePreviewProps> = (props) => {
  const { currentSpaceId, message } = props;
  const user = usePasskeysContext();
  const selfAddress = user?.currentPasskeyInfo?.address ?? null;

  const isDM = !!message.spaceId && message.spaceId === message.channelId;
  const effectiveSpaceId = isDM ? undefined : currentSpaceId;

  const spaceIds = React.useMemo(
    () => (effectiveSpaceId ? [effectiveSpaceId] : []),
    [effectiveSpaceId],
  );
  const rostersBySpace = useMultiSpaceRosters(spaceIds);
  const locallyKnownNames = useLocalDmNames(selfAddress);

  return (
    <IdentityScopeProvider
      spaceId={effectiveSpaceId}
      rostersBySpace={rostersBySpace}
      selfAddress={selfAddress}
      locallyKnownNames={locallyKnownNames}
    >
      <MessagePreviewContent {...props} />
    </IdentityScopeProvider>
  );
};

const MessagePreviewContent: React.FC<MessagePreviewProps> = ({
  message,
  mapSenderToUser,
  stickers,
  showBackground = true,
  hideHeader = false,
  spaceRoles = [],
  spaceChannels = [],
  onChannelClick,
  onMessageLinkClick,
  disableMentionInteractivity = false,
  currentSpaceId,
}) => {
  // Extract senderId from the message content based on message type
  const senderId = message.content?.senderId || '';

  // Gate the @everyone pill on sender authorization (sender held mention:everyone,
  // role-based, no owner bypass) — same trust rule as the message list. When the
  // caller doesn't supply space roles (e.g. bookmarks), @everyone safely falls
  // back to plain text rather than rendering an unverifiable pill.
  const everyoneAuthorized = React.useMemo(() => {
    if (message.mentions?.everyone !== true) return false;
    if (!senderId) return false;
    return hasPermission(senderId, 'mention:everyone', { roles: spaceRoles } as Space);
  }, [message.mentions?.everyone, senderId, spaceRoles]);

  // Message formatting logic - no image modal needed for preview
  const formatting = useMessageFormatting({
    message,
    stickers: stickers || {},
    mapSenderToUser: mapSenderToUser || (() => ({})),
    onImageClick: () => {}, // No-op for message preview - just display images
    spaceRoles,
    spaceChannels,
    disableMentionInteractivity,
    currentSpaceId,
    everyoneAuthorized,
  });

  // Use shared date formatting utility (matches Message.tsx format)
  const formattedTimestamp = message.createdDate
    ? formatMessageDate(message.createdDate)
    : t`Unknown time`;

  // Render message content with actual images and stickers
  const renderMessageContent = () => {
    if (!message.content) return <span className="text-label">{t`[Empty message]`}</span>;

    const contentData = formatting.getContentData();
    if (!contentData) return <span className="text-label">{t`[Message]`}</span>;

    // Handle embed content (images/videos)
    if (contentData.type === 'embed') {
      return (
        <div className="message-preview-embed">
          {contentData.content.imageUrl && (
            <img
              src={contentData.content.thumbnailUrl || contentData.content.imageUrl}
              style={{
                maxWidth: 200,
                maxHeight: 150,
                width: 'auto',
              }}
              className="rounded-lg"
            />
          )}
          {contentData.content.videoUrl?.startsWith(
            'https://www.youtube.com/embed'
          ) && (
            <YouTubeEmbed
              src={contentData.content.videoUrl}
              allow="autoplay; encrypted-media"
              className="rounded-lg youtube-embed"
              style={{
                width: '100%',
                maxWidth: 300,
                aspectRatio: '16/9',
              }}
              previewOnly={true}
            />
          )}
        </div>
      );
    }

    // Handle sticker content
    if (contentData.type === 'sticker') {
      return (
        <div className="message-preview-sticker">
          <img
            src={contentData.sticker?.imgUrl}
            style={{ maxWidth: 120, maxHeight: 120 }}
            className="rounded-lg"
          />
        </div>
      );
    }

    // Handle post content with smart markdown processing
    if (contentData.type === 'post') {
      // Get full text content and apply smart markdown stripping
      const fullText = contentData.content.join('\n');
      const hasText = fullText.trim().length > 0;
      const smartProcessedText = processMarkdownText(fullText, {
        preserveLineBreaks: true,     // Keep paragraph structure in previews
        preserveEmphasis: true,       // Keep bold/italic intent without syntax
        preserveHeaders: true,        // Keep header content without ### syntax
        removeFormatting: true,       // Remove markdown syntax
        removeStructure: false,       // Preserve line breaks for readability
      });

      // Process the text for mentions and links
      const processedContent = hasText
        ? renderPreviewTextWithSpecialTokens(
            smartProcessedText,
            formatting,
            contentData.messageId,
            disableMentionInteractivity,
            onChannelClick,
            onMessageLinkClick
          )
        : null;

      // Collect embedded image keys (combined text+image messages)
      const postContent = message.content.type === 'post' ? message.content : null;
      const imageKeys: string[] = [];
      if (postContent?.embeddedMedia) {
        for (const entry of postContent.embeddedMedia) {
          if (
            (entry.type === 'image' || entry.type === 'image-thumbnail') &&
            !imageKeys.includes(entry.key)
          ) {
            imageKeys.push(entry.key);
          }
        }
      }

      return (
        <div className="message-preview-post text-sm font-normal">
          {processedContent}
          {imageKeys.map((key) => {
            const src =
              getEmbeddedMediaSrc(postContent, 'image-thumbnail', key) ??
              getEmbeddedMediaSrc(postContent, 'image', key);
            if (!src) return null;
            return (
              <div key={key} className={hasText ? 'mt-2' : undefined}>
                <img
                  src={src}
                  style={{ maxWidth: 200, maxHeight: 150, width: 'auto' }}
                  className="rounded-lg"
                />
              </div>
            );
          })}
        </div>
      );
    }

    return <span className="text-label">{t`[Message]`}</span>;
  };

  return (
    <div
      className="p-2"
      style={{ backgroundColor: showBackground ? "var(--color-bg-chat)" : undefined }}
    >
      <Flex direction="column" gap="sm">
        {/* Message header. Reachable only when `hideHeader` is false; both
            current callers (PinnedMessagesPanel, BookmarkItem) pass
            hideHeader={true}, so this stays dead code in production today —
            kept resolving via the identity module (not deleted) so turning
            it back on cannot quietly reintroduce the gap `getDisplayName`
            used to be. `enrich`: a single, bounded sender per preview. */}
        {!hideHeader && (
          <Flex align="center" className="dropdown-result-meta min-w-0">
            <Icon name="user" className="dropdown-result-user-icon flex-shrink-0" />
            <MemberName
              address={senderId}
              enrich
              className="dropdown-result-sender mr-4 truncate-user-name flex-shrink min-w-0"
            />
            <Icon name="calendar-alt" className="dropdown-result-date-icon flex-shrink-0" />
            <span className="dropdown-result-date">{formattedTimestamp}</span>
          </Flex>
        )}

        {!hideHeader && (
          <Spacer
            spaceAfter="xs"
            border={true}
            direction="vertical"
          />
        )}

        {/* Message content */}
        {renderMessageContent()}
      </Flex>
    </div>
  );
};

export default MessagePreview;
