import React, { Suspense, useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { TypingScope } from '@quilibrium/quorum-shared';
import { Button, Icon, Tooltip } from '../primitives';
import { t } from '@lingui/core/macro';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, { MessageComposerRef } from '../message/MessageComposer';
import { TypingIndicator } from '../message/TypingIndicator';
import { useMessageComposer } from '../../hooks';
import { useThreadContext, useThreadContextStore } from '../context/ThreadContext';
import { useUpdateThreadReadTime } from '../../hooks/business/conversations/useUpdateThreadReadTime';
import { useThreadSettingsModal } from '../context/ThreadSettingsModalProvider';
import { useMobile } from '../context/MobileProvider';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { getThreadTitle } from '../../utils/threadTitle';
import { IdentityScopeProvider, MemberName, useNameResolver } from '../../identity';
import { useTypingIndicator } from '../../hooks/business/messages/useTypingIndicator';
import type { CustomEmoji, EmojiData } from '../emoji-picker/types';
import './ThreadPanel.scss';

const LazyEmojiPicker = React.lazy(() =>
  import('../emoji-picker/EmojiPicker').then((m) => ({ default: m.default }))
);

/**
 * `useNameResolver` needs an ancestor <IdentityScopeProvider> — ThreadPanel
 * mounts its OWN provider in what it returns, so a hook call in ThreadPanel's
 * own function body would run BEFORE that provider exists in the tree (the
 * provider is a descendant of ThreadPanel, not an ancestor of it). This tiny
 * wrapper is rendered AS A CHILD of <IdentityScopeProvider> below, so its
 * hook call resolves against the real context. `resolve()` (no explicit
 * spaceId) already reads the provider's `defaultSpaceId`, which IS
 * `channelProps.spaceId` — the exact same scope TypingIndicator's names
 * need. Same shape as Channel.tsx's `ChannelTypingIndicator`.
 *
 * ENRICHES — reconciled with `ChannelTypingIndicator` (fix round 1 of Phase D
 * rows 19-21). This used to deliberately NOT enrich, reasoning that
 * `useTypingIndicator(scope)` would need a SECOND subscription
 * (`<TypingIndicator>` owns its own internally) just to fire a request for a
 * label about to disappear. That reasoning undersold the fix: a typing
 * indicator names one or two people — it IS the bounded case recipe rule 1
 * describes — and the whole point of this migration is that the same
 * address renders the same string everywhere, so "Alice is typing…" here and
 * "alice.q" on her next message header must agree. The second subscription
 * is real but cheap: `TypingService.subscribe` (quorum-shared) is a plain
 * `Set<Listener>` registration against an in-memory map, no I/O, no
 * network — not worth trading consistency for.
 */
export const ThreadTypingIndicator: React.FC<{ scope: TypingScope | null }> = ({ scope }) => {
  const typists = useTypingIndicator(scope);
  const { resolve, requestNames } = useNameResolver();
  React.useEffect(() => {
    requestNames(typists);
  }, [typists, requestNames]);
  return (
    <TypingIndicator
      scope={scope}
      resolveName={(addr) => {
        const r = resolve(addr);
        return r.isQnsVerified ? `${r.name}.q` : r.name;
      }}
    />
  );
};

export const ThreadPanel: React.FC = () => {
  const {
    isOpen,
    threadId,
    rootMessage,
    threadMessages,
    isLoading,
    closeThread,
    submitMessage,
    submitSticker,
    setThreadClosed,
    updateThreadSettings,
    removeThread,
    channelProps,
    targetMessageId,
    updateTitle,
  } = useThreadContext();

  const messageListRef = useRef<MessageListRef>(null);
  const composerRef = useRef<MessageComposerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Explicit snap on send — mirrors Channel/DirectMessage so users sending from
  // up in thread history snap back to their reply (industry convention).
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      await submitMessage(message, inReplyTo);
      messageListRef.current?.scrollToBottom();
    },
    [submitMessage]
  );

  // Whether the parent channel has any stickers. When it doesn't, the composer's
  // emoji/sticker panel opens emoji-only (no empty Stickers tab) — same as DMs.
  const hasStickers =
    !!channelProps?.stickers && Object.keys(channelProps.stickers).length > 0;

  const composer = useMessageComposer({
    type: 'channel',
    onSubmitMessage: handleSubmitMessage,
    onSubmitSticker: submitSticker,
    hasStickers,
  });

  const { openThreadSettings } = useThreadSettingsModal();
  const { openMobileEmojiDrawer } = useMobile();
  const { isMobile } = useResponsiveLayoutContext();
  const [panelTab, setPanelTab] = useState<'emojis' | 'stickers'>('emojis');

  // Build custom emoji list for the picker
  const customEmojis: CustomEmoji[] = useMemo(() => {
    if (!channelProps?.customEmoji) return [];
    return channelProps.customEmoji.map((c) => ({
      names: [c.name],
      id: c.id,
      imgUrl: c.imgUrl,
    }));
  }, [channelProps?.customEmoji]);

  // Handle emoji selection — insert into thread composer
  const handleComposerEmojiClick = useCallback((emoji: string) => {
    if (emoji) {
      composerRef.current?.insertEmoji(emoji);
    }
  }, []);

  // Handle smiley button click — thread-specific handler
  const handleShowEmojiPanel = useCallback(() => {
    if (isMobile) {
      openMobileEmojiDrawer({
        onEmojiClick: (emoji: string) => {
          composerRef.current?.insertEmoji(emoji);
        },
        customEmojis,
        stickers: channelProps?.stickers ? Object.values(channelProps.stickers) as any : undefined,
        onStickerClick: (stickerId: string) => {
          composer.submitSticker(stickerId);
        },
      });
    } else {
      composer.setShowStickers(true);
    }
  }, [isMobile, openMobileEmojiDrawer, customEmojis, channelProps?.stickers, composer]);

  // Resize
  const STORAGE_KEY = 'thread-panel-width';
  const MIN_WIDTH = 300;
  const MAX_WIDTH_VW = 50;
  const XL_BREAKPOINT = 1280;
  const DEFAULT_WIDTH = window.innerWidth >= XL_BREAKPOINT ? 500 : 400;

  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH) return parsed;
    }
    return DEFAULT_WIDTH;
  });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth * (MAX_WIDTH_VW / 100);
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      const current = panelRef.current;
      if (current) {
        const width = current.getBoundingClientRect().width;
        localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // Prepend root message to thread replies so it appears first in the list
  const allThreadMessages = useMemo(() => {
    if (!rootMessage) return threadMessages;
    return [rootMessage, ...threadMessages];
  }, [rootMessage, threadMessages]);

  // Thread messages use a different React Query key than channels/DMs, so
  // we pass the prefix explicitly. See useThreadMessages.
  const anchorQueryKeyPrefix = useMemo<readonly unknown[] | undefined>(() => {
    if (!channelProps?.spaceId || !channelProps?.channelId || !threadId) return undefined;
    return ['thread-messages', channelProps.spaceId, channelProps.channelId, threadId];
  }, [channelProps?.spaceId, channelProps?.channelId, threadId]);

  const threadTitle = useMemo(() => getThreadTitle(rootMessage), [rootMessage]);

  const starterUser = useMemo(() => {
    if (!channelProps) return null;
    // Use thread creator (createdBy) rather than original message author (senderId)
    const creatorId = rootMessage?.threadMeta?.createdBy;
    if (!creatorId) return null;
    const user = channelProps.mapSenderToUser(creatorId);
    if (!user) return null;
    return {
      address: creatorId,
      displayName: user.displayName,
      primaryUsername: user.primaryUsername,
      globalDisplayName: user.globalDisplayName,
      userIcon: user.userIcon,
      bio: user.bio,
    };
  }, [rootMessage, channelProps]);

  const isThreadAuthor = useMemo(() => {
    if (!rootMessage?.threadMeta?.createdBy || !channelProps?.currentUserAddress) return false;
    return rootMessage.threadMeta.createdBy === channelProps.currentUserAddress;
  }, [rootMessage, channelProps?.currentUserAddress]);

  const canManage =
    isThreadAuthor || (rootMessage ? (channelProps?.canDeleteMessages?.(rootMessage) ?? false) : false);

  const isClosed = rootMessage?.threadMeta?.isClosed ?? false;
  const canReopen =
    isThreadAuthor || (rootMessage ? (channelProps?.canDeleteMessages?.(rootMessage) ?? false) : false);

  // Typing indicator scope — 'thread' kind scopes typing to this specific thread,
  // distinct from the parent channel scope.
  const typingScope = useMemo<TypingScope | null>(
    () => {
      if (!channelProps?.spaceId || !channelProps?.channelId || !threadId) return null;
      return { kind: 'thread', spaceId: channelProps.spaceId, channelId: channelProps.channelId, threadId };
    },
    [channelProps?.spaceId, channelProps?.channelId, threadId],
  );

  const canSendMessage = !isClosed;

  // Thread read time tracking — same 2s interval pattern as Channel.tsx
  const latestThreadTimestampRef = useRef<number>(0);
  const lastSavedThreadTimestampRef = useRef<number>(0);

  const { mutate: updateThreadReadTime } = useUpdateThreadReadTime({
    spaceId: channelProps?.spaceId || '',
  });

  // Track latest message timestamp
  useEffect(() => {
    if (threadMessages.length > 0) {
      latestThreadTimestampRef.current = threadMessages.reduce(
        (max, msg) => Math.max(max, msg.createdDate || 0), 0
      );
    }
  }, [threadMessages]);

  // Periodic save every 2 seconds
  useEffect(() => {
    if (!threadId || !channelProps?.channelId) return;

    const intervalId = setInterval(() => {
      if (
        latestThreadTimestampRef.current > 0 &&
        latestThreadTimestampRef.current > lastSavedThreadTimestampRef.current
      ) {
        updateThreadReadTime({
          threadId,
          channelId: channelProps.channelId,
          timestamp: latestThreadTimestampRef.current,
        });
        lastSavedThreadTimestampRef.current = latestThreadTimestampRef.current;
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [threadId, channelProps?.channelId, updateThreadReadTime]);

  // Save immediately when closing thread (component unmount or thread change)
  useEffect(() => {
    const currentThreadId = threadId;
    const currentChannelId = channelProps?.channelId;

    return () => {
      if (
        currentThreadId &&
        currentChannelId &&
        latestThreadTimestampRef.current > lastSavedThreadTimestampRef.current
      ) {
        updateThreadReadTime({
          threadId: currentThreadId,
          channelId: currentChannelId,
          timestamp: latestThreadTimestampRef.current,
        });
      }
    };
  }, [threadId, channelProps?.channelId, updateThreadReadTime]);

  // Access store to clear targetMessageId after scroll processing
  const threadStore = useThreadContextStore();

  // Clear targetMessageId after thread messages load and scroll is triggered.
  // MessageList internally tracks "hasProcessedScrollTo" so it only scrolls once per value,
  // but we clear the context to keep state clean.
  useEffect(() => {
    if (targetMessageId && threadMessages.length > 0) {
      // Delay to let MessageList detect and process scrollToMessageId
      const timer = setTimeout(() => {
        const currentState = threadStore.getThreadState();
        if (currentState.targetMessageId) {
          threadStore.setThreadState({ ...currentState, targetMessageId: null });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [targetMessageId, threadMessages.length, threadStore]);

  const handleStarterClick = useCallback((e: React.MouseEvent) => {
    if (starterUser && channelProps?.onUserClick) {
      channelProps.onUserClick(starterUser, e, {
        type: 'message-avatar',
        element: e.currentTarget as HTMLElement,
      });
    }
  }, [starterUser, channelProps]);

  const listHeaderContent = useMemo(() => (
    <div className="thread-panel__list-header">
      <div className="thread-panel__list-title">{threadTitle}</div>
      {starterUser && (
        <div className="thread-panel__list-started-by">
          {t`Started by`}{' '}
          <span
            role="button"
            tabIndex={0}
            className="thread-panel__list-starter-name"
            onClick={handleStarterClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStarterClick(e as any); }}
          >
            {/* Bounded single-person surface (the thread's starter) — enrich
                so a QNS-verified starter shows their ".q", matching every
                other "Started by" / header-style surface already migrated. */}
            <MemberName address={starterUser.address} enrich />
          </span>
        </div>
      )}
    </div>
  ), [threadTitle, starterUser, handleStarterClick]);

  // Message resolves its sender through src/identity, which throws outside a
  // provider. ThreadPanel is a SIBLING of Channel in Space.tsx (not a
  // descendant), so it does NOT inherit Channel's IdentityScopeProvider —
  // it needs its own. `channelProps.rosterRows` is the EXACT object
  // Channel.tsx's own provider is built from (raw `members`) — see the
  // field's doc comment in ThreadContext.tsx for why re-deriving from the
  // public-profile-backfilled `effectiveMembers` map is a trap: it happens
  // to read the same today only because resolveIdentity's space!==global
  // guard neutralises the difference, not because the two sources agree.
  // `channelProps.members` (passed to the message list below) is now ALSO
  // the raw roster, not `effectiveMembers` — see that field's own doc comment
  // in ThreadContext.tsx (the membership/kicked gate reads it). Always
  // computed (never inside the early-return below) so hook order stays fixed.
  const rostersBySpace = useMemo(
    () => (channelProps?.spaceId ? { [channelProps.spaceId]: channelProps.rosterRows ?? {} } : {}),
    [channelProps?.spaceId, channelProps?.rosterRows],
  );

  if (!isOpen || !threadId || !channelProps) return null;

  return (
    <IdentityScopeProvider
      spaceId={channelProps.spaceId}
      rostersBySpace={rostersBySpace}
      selfAddress={channelProps.currentUserAddress ?? null}
    >
    <div
      className="thread-panel-wrapper"
      ref={panelRef}
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle — outside overflow:hidden panel so it stays visible */}
      <div
        className="thread-panel__resize-handle"
        onMouseDown={handleResizeStart}
      />
      <div className="thread-panel">
      {/* Header: compact icon + title + actions */}
      <div className="thread-panel__header chat-header">
        <div className="thread-panel__header-left">
          <Icon
            name="messages"
            size="lg"
            className="thread-panel__header-icon"
          />
          <span className="thread-panel__header-title">{threadTitle}</span>
        </div>
        <div className="thread-panel__header-actions">
          {canManage && rootMessage && (
            <Tooltip id="thread-settings-tooltip" content={t`Thread settings`} place="bottom" showOnTouch={false}>
              <Button
                type="unstyled"
                onClick={() => openThreadSettings({
                  threadId: threadId!,
                  rootMessage,
                  threadMessages,
                  channelProps,
                  updateTitle,
                  setThreadClosed,
                  updateThreadSettings,
                  removeThread,
                })}
                className="header-icon-button"
                aria-label={t`Thread settings`}
                iconName="settings"
                iconSize="lg"
                iconOnly
              />
            </Tooltip>
          )}
          <Button
            type="unstyled"
            onClick={closeThread}
            className="header-icon-button"
            iconName="close"
            iconSize="lg"
            iconOnly
          />
        </div>
      </div>

      {/* Thread messages — uses the same MessageList as main chat */}
      <div className="thread-panel__messages">
        {isLoading ? (
          <div className="thread-panel__loading">
            <Icon name="spinner" className="loading-icon icon-spin" />
            <span>{t`Loading thread...`}</span>
          </div>
        ) : (
          <MessageList
            ref={messageListRef}
            stickers={channelProps.stickers}
            roles={channelProps.roles}
            canDeleteMessages={channelProps.canDeleteMessages}
            canPinMessages={channelProps.canPinMessages}
            channel={channelProps.channel}
            isSpaceOwner={channelProps.isSpaceOwner}
            editor={textareaRef}
            messageList={allThreadMessages}
            setInReplyTo={composer.setInReplyTo}
            customEmoji={channelProps.customEmoji}
            // RAW roster — see ThreadChannelProps.members's doc comment.
            // The membership/kicked GATE below reads this directly; it must
            // be the same raw source Channel's own per-space message list
            // uses, not the public-profile-backfilled effectiveMembers map.
            members={channelProps.members}
            // Same enriched mapper the channel view uses. Without it MessageList
            // falls back to its internal mapper, and thread author names lose
            // their QNS `.q` name to a truncated address — while this very
            // panel's other surfaces (thread header, participant list) already
            // used the enriched mapper. Threads are a space context, so the
            // override-aware resolver runs and a substituted address wins.
            mapSenderToUser={channelProps.mapSenderToUser}
            submitMessage={handleSubmitMessage}
            onUserClick={channelProps.onUserClick}
            lastReadTimestamp={undefined}
            onChannelClick={channelProps.onChannelClick}
            spaceChannels={channelProps.spaceChannels}
            fetchPreviousPage={() => {}}
            fetchNextPage={() => {}}
            hasNextPage={false}
            spaceName={channelProps.spaceName}
            users={channelProps.users}
            mentionRoles={channelProps.mentionRoles}
            groups={channelProps.spaceGroups}
            canUseEveryone={channelProps.canUseEveryone}
            alignToTop={false}
            headerContent={listHeaderContent}
            scrollToMessageId={targetMessageId ?? undefined}
            highlightOnScroll={true}
            anchorQueryKeyPrefix={anchorQueryKeyPrefix}
          />
        )}
      </div>

      {/* Thread composer — uses the same MessageComposer as main chat, or closed notice */}
      <div className="thread-panel__composer">
        {/* Enriches (see ThreadTypingIndicator above) — matches Channel's
            typing indicator so the same person's name never disagrees
            between the two surfaces. */}
        <ThreadTypingIndicator scope={typingScope} />
        {isClosed ? (
          <div className="message-composer-container">
            <div className="message-composer-row">
              <Button
                type="unstyled"
                iconName="lock"
                iconSize="lg"
                iconOnly
                className="message-composer-upload-btn message-composer-disabled-icon"
                style={{ pointerEvents: 'none' }}
              />
              <span className="message-composer-disabled-text">{t`This thread has been closed`}</span>
              {canReopen && (
                <span
                  role="button"
                  tabIndex={0}
                  className="message-composer-disabled-action"
                  onClick={() => setThreadClosed(threadId!, false)}
                  onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? setThreadClosed(threadId!, false) : undefined}
                >
                  {t`Reopen`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <MessageComposer
            ref={composerRef}
            canUseEveryone={channelProps.canUseEveryone}
            value={composer.pendingMessage}
            onChange={composer.setPendingMessage}
            onKeyDown={composer.handleKeyDown}
            placeholder={t`Reply in thread...`}
            calculateRows={composer.calculateRows}
            getRootProps={composer.getRootProps}
            getInputProps={composer.getInputProps}
            processedImage={composer.processedImage}
            clearFile={composer.clearFile}
            onSubmitMessage={composer.submitMessage}
            onShowStickers={handleShowEmojiPanel}
            inReplyTo={composer.inReplyTo}
            setInReplyTo={composer.setInReplyTo}
            mapSenderToUser={channelProps.mapSenderToUser}
            users={channelProps.users}
            roles={channelProps.mentionRoles}
            groups={channelProps.spaceGroups}
            fileError={composer.fileError}
            isProcessingImage={composer.isProcessingImage}
            mentionError={composer.mentionError}
            messageValidation={composer.messageValidation}
            characterCount={composer.characterCount}
            showSigningToggle={channelProps.isRepudiable}
            skipSigning={channelProps.skipSigning}
            onSigningToggle={channelProps.onSigningToggle}
            typingScope={typingScope}
            canSendMessage={canSendMessage}
          />
        )}
      </div>

      </div>

      {/* Emoji & Stickers panel for thread — rendered in wrapper to avoid overflow:hidden clipping */}
      {composer.showStickers && (
        <>
          <div
            className="stickers-backdrop"
            onClick={() => composer.setShowStickers(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') composer.setShowStickers(false);
            }}
          />
          <div
            className="stickers-panel-wrapper thread-panel__stickers-panel-wrapper"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                composer.setShowStickers(false);
                composerRef.current?.focus();
              }
            }}
          >
            <div className={`stickers-panel${hasStickers ? '' : ' stickers-panel--emoji-only'}`}>
              {/* Tabs only when the channel has stickers; otherwise emoji-only. */}
              {hasStickers && (
                <div className="stickers-panel-tabs">
                  <button
                    className={`stickers-panel-tab ${panelTab === 'emojis' ? 'active' : ''}`}
                    onClick={() => setPanelTab('emojis')}
                  >
                    {t`Emojis`}
                  </button>
                  <button
                    className={`stickers-panel-tab ${panelTab === 'stickers' ? 'active' : ''}`}
                    onClick={() => setPanelTab('stickers')}
                  >
                    {t`Stickers`}
                  </button>
                </div>
              )}

              {!hasStickers || panelTab === 'emojis' ? (
                <div className="stickers-panel-emoji-content">
                  <Suspense fallback={<div className="emoji-picker-loading" />}>
                    <LazyEmojiPicker
                      customEmojis={customEmojis}
                      onEmojiClick={(e: EmojiData) => handleComposerEmojiClick(e.emoji)}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="stickers-panel-grid">
                  {channelProps.stickers && Object.values(channelProps.stickers).map((s) => (
                    <div
                      key={'sticker-' + s.id}
                      className="sticker-item"
                      onClick={() => {
                        composer.submitSticker(s.id);
                      }}
                    >
                      <img src={s.imgUrl} alt="sticker" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </IdentityScopeProvider>
  );
};

export default ThreadPanel;
