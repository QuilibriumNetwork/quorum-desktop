import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { PostMessage } from '../../api/quorumApi';
import { Button, Icon } from '../primitives';
import { t } from '@lingui/core/macro';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, { MessageComposerRef } from '../message/MessageComposer';
import { useMessageComposer } from '../../hooks';
import { useThreadContext, useThreadContextStore } from '../context/ThreadContext';
import './ThreadPanel.scss';

/**
 * Extract a title from the root message text.
 * Falls back to "Thread" if no text content.
 * CSS handles truncation via text-overflow: ellipsis based on available width.
 */
function getThreadTitle(rootMessage: { content?: any } | null): string {
  if (!rootMessage?.content) return 'Thread';
  const content = rootMessage.content as PostMessage;
  if (!content.text) return 'Thread';
  const text = Array.isArray(content.text) ? content.text.join(' ') : content.text;
  // Strip markdown/formatting for a clean title
  const clean = text.replace(/[*_~`#>[\]()!]/g, '').trim();
  return clean || 'Thread';
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
          <h2 className="thread-panel__title">{threadTitle}</h2>
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
          onShowStickers={channelProps.onShowStickers || (() => {})}
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
    </div>
  );
};

export default ThreadPanel;
