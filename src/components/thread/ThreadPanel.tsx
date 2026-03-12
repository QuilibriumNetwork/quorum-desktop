import React, { Suspense, useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { PostMessage } from '../../api/quorumApi';
import { Button, Icon, Input } from '../primitives';
import { t } from '@lingui/core/macro';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, { MessageComposerRef } from '../message/MessageComposer';
import { useMessageComposer } from '../../hooks';
import { useThreadContext, useThreadContextStore } from '../context/ThreadContext';
import { useMobile } from '../context/MobileProvider';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import type { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import './ThreadPanel.scss';

const LazyEmojiPicker = React.lazy(() => import('emoji-picker-react'));

const THREAD_TITLE_MAX_CHARS = 100;

/**
 * Derive display title from root message.
 * Resolution order: customTitle → first 100 chars of message text → "Thread" fallback.
 */
function getThreadTitle(rootMessage: { content?: any; threadMeta?: { customTitle?: string } } | null): string {
  if (!rootMessage) return 'Thread';
  if (rootMessage.threadMeta?.customTitle) return rootMessage.threadMeta.customTitle;
  if (!rootMessage?.content) return 'Thread';
  const content = rootMessage.content as PostMessage;
  if (!content.text) return 'Thread';
  const text = Array.isArray(content.text) ? content.text.join(' ') : content.text;
  const clean = text.replace(/[*_~`#>[\]()!]/g, '').trim();
  if (!clean) return 'Thread';
  return clean.length > THREAD_TITLE_MAX_CHARS
    ? clean.substring(0, THREAD_TITLE_MAX_CHARS)
    : clean;
}

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
    channelProps,
    targetMessageId,
    updateTitle,
  } = useThreadContext();

  const messageListRef = useRef<MessageListRef>(null);
  const composerRef = useRef<MessageComposerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const composer = useMessageComposer({
    type: 'channel',
    onSubmitMessage: submitMessage,
    onSubmitSticker: submitSticker,
    hasStickers: !!channelProps?.stickers && Object.keys(channelProps.stickers).length > 0,
  });

  const { openMobileEmojiDrawer } = useMobile();
  const { isMobile } = useResponsiveLayoutContext();
  const [panelTab, setPanelTab] = useState<'emojis' | 'stickers'>('emojis');

  // Transform custom emoji data for emoji-picker-react
  const customEmojis: CustomEmoji[] = useMemo(() => {
    if (!channelProps?.customEmoji) return [];
    return channelProps.customEmoji.map((c) => ({
      names: [c.name],
      id: c.id,
      imgUrl: c.imgUrl,
    }));
  }, [channelProps?.customEmoji]);

  // Handle emoji selection — insert into thread composer
  const handleComposerEmojiClick = useCallback((emojiData: any) => {
    const emoji = emojiData.emoji || emojiData.imageUrl;
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
  const DEFAULT_WIDTH = 400;

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

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const isSavingTitle = useRef(false);

  const handleTitleClick = useCallback(() => {
    setTitleDraft(rootMessage?.threadMeta?.customTitle ?? '');
    setIsEditingTitle(true);
  }, [rootMessage]);

  const handleTitleSave = useCallback(() => {
    if (!rootMessage) return;
    if (isSavingTitle.current) return;
    isSavingTitle.current = true;
    const trimmed = titleDraft.trim();
    // Only broadcast if value actually changed
    const current = rootMessage.threadMeta?.customTitle ?? '';
    if (trimmed !== current) {
      // threadMeta may be undefined in a race (message arrived before thread 'create' broadcast)
      // updateTitle in Channel.tsx constructs updatedMeta from scratch, so passing undefined is safe
      updateTitle(rootMessage.messageId, rootMessage.threadMeta, trimmed);
    }
    setIsEditingTitle(false);
    // Reset guard after blur fires (browser queues blur after keydown handler returns)
    setTimeout(() => { isSavingTitle.current = false; }, 0);
  }, [titleDraft, rootMessage, updateTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      isSavingTitle.current = true; // Suppress the blur save on Escape
      setIsEditingTitle(false);
      setTimeout(() => { isSavingTitle.current = false; }, 0);
    }
  }, [handleTitleSave]);

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

  const threadTitle = useMemo(() => getThreadTitle(rootMessage), [rootMessage]);

  const starterName = useMemo(() => {
    if (!rootMessage?.content?.senderId || !channelProps) return null;
    const user = channelProps.mapSenderToUser(rootMessage.content.senderId);
    return user?.displayName || null;
  }, [rootMessage, channelProps]);

  const isThreadAuthor = useMemo(() => {
    if (!rootMessage?.threadMeta?.createdBy || !channelProps?.currentUserAddress) return false;
    return rootMessage.threadMeta.createdBy === channelProps.currentUserAddress;
  }, [rootMessage, channelProps?.currentUserAddress]);

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

  if (!isOpen || !threadId || !channelProps) return null;

  return (
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
      {/* Header — Discord-style: title + "Started by X" + close */}
      <div className="thread-panel__header">
        <div className="thread-panel__header-content">
          <div className="thread-panel__title-area">
              {isEditingTitle ? (
                <Input
                  variant="minimal"
                  value={titleDraft}
                  onChange={(val: string) => setTitleDraft(val.slice(0, 100))}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  placeholder={threadTitle}
                  autoFocus
                  className="thread-panel__title-input"
                />
              ) : isThreadAuthor ? (
                <div
                  className="thread-panel__title"
                  onClick={handleTitleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
                  aria-label={t`Edit thread title`}
                >
                  {threadTitle}
                </div>
              ) : (
                <div className="thread-panel__title thread-panel__title--readonly">
                  {threadTitle}
                </div>
              )}
            </div>
          {starterName && (
            <span className="thread-panel__started-by">
              {t`Started by`} <strong>{starterName}</strong>
            </span>
          )}
        </div>
        <Button
          type="unstyled"
          onClick={closeThread}
          className="thread-panel__close"
        >
          <Icon name="close" size="md" />
        </Button>
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
            members={channelProps.members}
            submitMessage={submitMessage}
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
            alignToTop={true}
            scrollToMessageId={targetMessageId ?? undefined}
            highlightOnScroll={true}
          />
        )}
      </div>

      {/* Thread composer — uses the same MessageComposer as main chat */}
      <div className="thread-panel__composer">
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
        />
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
            <div className="stickers-panel">
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

              {panelTab === 'emojis' ? (
                <div className="stickers-panel-emoji-content">
                  <Suspense fallback={<div className="emoji-picker-loading" />}>
                    <LazyEmojiPicker
                      width={300}
                      height={358}
                      suggestedEmojisMode={SuggestionMode.FREQUENT}
                      customEmojis={customEmojis}
                      getEmojiUrl={(unified) => '/twitter/64/' + unified + '.png'}
                      skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                      theme={Theme.DARK}
                      onEmojiClick={handleComposerEmojiClick}
                      lazyLoadEmojis={true}
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
  );
};

export default ThreadPanel;
