import React, { useCallback, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { Message as MessageType, Role, Channel, Sticker } from '../../api/quorumApi';
import MessagePreview from '../message/MessagePreview';
import {
  Flex,
  Button,
  Icon,
} from '../primitives';
import { DropdownPanel } from '../ui';
import { t } from '@lingui/core/macro';
import { useThreadMessages } from '../../hooks/business/threads';
import { formatMessageDate } from '../../utils/dateFormatting';
import './ThreadPanel.scss';

interface ThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  channelId: string;
  threadId: string | null;
  rootMessage: MessageType | null;
  mapSenderToUser: (senderId: string) => any;
  onSubmitThreadReply: (text: string) => void;
  stickers?: { [key: string]: Sticker };
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({
  isOpen,
  onClose,
  spaceId,
  channelId,
  threadId,
  rootMessage,
  mapSenderToUser,
  onSubmitThreadReply,
  stickers,
  spaceRoles,
  spaceChannels,
  onChannelClick,
}) => {
  const { data, isLoading } = useThreadMessages({
    spaceId,
    channelId,
    threadId,
    enabled: isOpen && !!threadId,
  });
  const [replyText, setReplyText] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = data?.messages ?? [];

  const handleSubmit = useCallback(() => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    onSubmitThreadReply(trimmed);
    setReplyText('');
  }, [replyText, onSubmitThreadReply]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!isOpen || !threadId) return null;

  const rootSender = rootMessage
    ? mapSenderToUser(rootMessage.content?.senderId)
    : null;

  const panelHeight = Math.min(window.innerHeight * 0.8, 600);

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={480}
      maxHeight={panelHeight}
      title={t`Thread`}
      className="thread-panel"
      showCloseButton={true}
    >
      <div className="thread-panel__content">
        {/* Root message */}
        {rootMessage && (
          <div className="thread-panel__root">
            <div className="thread-panel__root-header">
              <Icon name="user" className="thread-panel__user-icon" />
              <span className="thread-panel__sender">
                {rootSender?.displayName || t`Unknown User`}
              </span>
              <span className="thread-panel__date">
                {formatMessageDate(rootMessage.createdDate, true)}
              </span>
            </div>
            <MessagePreview
              message={rootMessage}
              mapSenderToUser={mapSenderToUser}
              stickers={stickers}
              showBackground={false}
              hideHeader={true}
              spaceRoles={spaceRoles}
              spaceChannels={spaceChannels}
              onChannelClick={onChannelClick}
              disableMentionInteractivity={true}
              currentSpaceId={spaceId}
            />
          </div>
        )}

        {/* Thread replies */}
        <div className="thread-panel__replies">
          {isLoading ? (
            <Flex justify="center" align="center" className="thread-panel__loading">
              <Icon name="spinner" className="loading-icon icon-spin" />
              <span>{t`Loading thread...`}</span>
            </Flex>
          ) : messages.length === 0 ? (
            <Flex justify="center" align="center" className="thread-panel__empty">
              <span className="text-subtle text-sm">{t`No replies yet. Start the conversation!`}</span>
            </Flex>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              style={{ height: Math.min(panelHeight - 200, 300) }}
              className="thread-panel__message-list"
              followOutput="smooth"
              initialTopMostItemIndex={messages.length - 1}
              itemContent={(_index, message) => {
                const sender = mapSenderToUser(message.content?.senderId);
                return (
                  <div className="thread-panel__reply-item">
                    <div className="thread-panel__reply-header">
                      <Icon name="user" className="thread-panel__user-icon" />
                      <span className="thread-panel__sender">
                        {sender?.displayName || t`Unknown User`}
                      </span>
                      <span className="thread-panel__date">
                        {formatMessageDate(message.createdDate, true)}
                      </span>
                    </div>
                    <MessagePreview
                      message={message}
                      mapSenderToUser={mapSenderToUser}
                      stickers={stickers}
                      showBackground={false}
                      hideHeader={true}
                      spaceRoles={spaceRoles}
                      spaceChannels={spaceChannels}
                      onChannelClick={onChannelClick}
                      disableMentionInteractivity={true}
                      currentSpaceId={spaceId}
                    />
                  </div>
                );
              }}
            />
          )}
        </div>

        {/* Composer */}
        <div className="thread-panel__composer">
          <textarea
            ref={textareaRef}
            className="thread-panel__input"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t`Reply in thread...`}
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!replyText.trim()}
            size="small"
            className="thread-panel__send"
          >
            <Icon name="send" />
          </Button>
        </div>
      </div>
    </DropdownPanel>
  );
};

export default ThreadPanel;
