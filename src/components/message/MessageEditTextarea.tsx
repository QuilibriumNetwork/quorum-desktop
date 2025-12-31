import { logger } from '@quilibrium/quorum-shared';
import React, { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InfiniteData } from '@tanstack/react-query';
import { Container, FlexRow, Text, Button } from '../primitives';
import { MarkdownToolbar } from './MarkdownToolbar';
import { calculateToolbarPosition } from '../../utils/toolbarPositioning';
import type { FormatFunction } from '../../utils/markdownFormatting';
import type { Message as MessageType, PostMessage } from '../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
import { useMessageDB } from '../context/useMessageDB';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';
import { isTouchDevice } from '../../utils/platform';
import { ENABLE_MARKDOWN, ENABLE_DM_ACTION_QUEUE } from '../../config/features';

/**
 * DM context for action queue handlers.
 * Required for DM edits to use Double Ratchet encryption.
 */
export interface DmContext {
  self: secureChannel.UserRegistration;
  counterparty: secureChannel.UserRegistration;
}

interface MessageEditTextareaProps {
  message: MessageType;
  initialText: string;
  onCancel: () => void;
  submitMessage: (message: any) => Promise<void>;
  mapSenderToUser: (senderId: string) => any;
  /** DM context for offline-resilient edits (optional - only for DMs) */
  dmContext?: DmContext;
}

/**
 * Message edit textarea with markdown toolbar
 * Extracted from Message.tsx for better maintainability
 */
export function MessageEditTextarea({
  message,
  initialText,
  onCancel,
  submitMessage,
  mapSenderToUser,
  dmContext,
}: MessageEditTextareaProps) {
  const queryClient = useQueryClient();
  const { messageDB, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // Edit state
  const [editText, setEditText] = useState(initialText);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Markdown toolbar state
  const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  // Handle text selection for markdown toolbar
  const handleTextareaMouseUp = useCallback(() => {
    // Skip markdown toolbar if feature is disabled or on touch devices
    if (!ENABLE_MARKDOWN || isTouchDevice()) return;

    const textarea = editTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (end > start) {
      // Text is selected
      setSelectionRange({ start, end });

      // Calculate smart position centered above selection
      const position = calculateToolbarPosition(textarea);
      if (position) {
        setToolbarPosition(position);
        setShowMarkdownToolbar(true);
      } else {
        setShowMarkdownToolbar(false);
      }
    } else {
      setShowMarkdownToolbar(false);
    }
  }, []);

  // Handle markdown formatting
  const handleMarkdownFormat = useCallback(
    (formatFn: FormatFunction) => {
      const result = formatFn(editText, selectionRange.start, selectionRange.end);
      setEditText(result.newText);

      // Restore selection and focus
      setTimeout(() => {
        editTextareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
        editTextareaRef.current?.focus();
        setShowMarkdownToolbar(false);
      }, 0);
    },
    [editText, selectionRange]
  );

  const handleSaveEdit = async () => {
    const editNonce = crypto.randomUUID();
    const editedAt = Date.now();
    const editedTextArray = editText.split('\n');
    const editedText = editedTextArray.length === 1 ? editedTextArray[0] : editedTextArray;

    const currentSpaceId = message.spaceId;
    const currentChannelId = message.channelId;
    const isDM = currentSpaceId === currentChannelId;

    // Preserve current content in edits array before updating
    const currentText = message.content.type === 'post' ? message.content.text : '';
    const existingEdits = message.edits || [];

    // Build edits array optimistically
    const edits = message.modifiedDate === message.createdDate
      ? // First edit: add original content to edits array
        [
          {
            text: currentText,
            modifiedDate: message.createdDate,
            lastModifiedHash: message.nonce,
          },
        ]
      : existingEdits.length > 0
      ? // Subsequent edits: add current version
        [
          ...existingEdits,
          {
            text: currentText,
            modifiedDate: message.modifiedDate,
            lastModifiedHash: message.lastModifiedHash || message.nonce,
          },
        ]
      : existingEdits;

    // Create updated message object
    const updatedMessage: MessageType = {
      ...message,
      modifiedDate: editedAt,
      lastModifiedHash: editNonce,
      content: {
        ...message.content,
        text: editedText,
      } as PostMessage,
      edits: edits,
    };

    // Update React Query cache IMMEDIATELY
    queryClient.setQueryData(
      buildMessagesKey({ spaceId: currentSpaceId, channelId: currentChannelId }),
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;

        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => {
            return {
              ...page,
              messages: [
                ...page.messages.map((m: MessageType) => {
                  if (m.messageId === message.messageId && m.content.type === 'post') {
                    return updatedMessage;
                  }
                  return m;
                }),
              ],
              nextCursor: page.nextCursor,
              prevCursor: page.prevCursor,
            };
          }),
        };
      }
    );

    // Close edit UI IMMEDIATELY
    onCancel();

    // Update IndexedDB and send asynchronously
    (async () => {
      try {

        // Check if saveEditHistory is enabled
        let saveEditHistoryEnabled = false;

        try {
          const conversationId = `${currentSpaceId}/${currentChannelId}`;
          if (isDM) {
            const conversationData = await messageDB.getConversation({ conversationId });
            saveEditHistoryEnabled = conversationData?.conversation?.saveEditHistory ?? false;
          } else {
            const space = await messageDB.getSpace(currentSpaceId);
            saveEditHistoryEnabled = space?.saveEditHistory ?? false;
          }
        } catch (error) {
          console.error('Failed to get saveEditHistory setting:', error);
          saveEditHistoryEnabled = false;
        }

        // If saveEditHistory is disabled, clear edits array
        if (!saveEditHistoryEnabled && edits.length > 0) {
          const correctedMessage: MessageType = {
            ...updatedMessage,
            edits: [],
          };

          // Update IndexedDB with corrected edits array
          await messageDB.saveMessage(
            correctedMessage,
            message.createdDate,
            currentSpaceId,
            isDM ? 'direct' : 'group',
            DefaultImages.UNKNOWN_USER,
            t`Unknown User`
          );

          // Update React Query cache with corrected edits array
          queryClient.setQueryData(
            buildMessagesKey({ spaceId: currentSpaceId, channelId: currentChannelId }),
            (oldData: InfiniteData<any>) => {
              if (!oldData?.pages) return oldData;
              return {
                pageParams: oldData.pageParams,
                pages: oldData.pages.map((page) => {
                  return {
                    ...page,
                    messages: [
                      ...page.messages.map((m: MessageType) => {
                        if (m.messageId === message.messageId && m.content.type === 'post') {
                          return correctedMessage;
                        }
                        return m;
                      }),
                    ],
                    nextCursor: page.nextCursor,
                    prevCursor: page.prevCursor,
                  };
                }),
              };
            }
          );
        }

        // Get conversation info for saveMessage
        let conversationIcon: string = DefaultImages.UNKNOWN_USER;
        let conversationDisplayName: string = t`Unknown User`;

        try {
          const conversationId = `${currentSpaceId}/${currentChannelId}`;
          const conversationData = await messageDB.getConversation({ conversationId });
          if (conversationData?.conversation) {
            conversationIcon = conversationData.conversation.icon || DefaultImages.UNKNOWN_USER;
            conversationDisplayName = conversationData.conversation.displayName || t`Unknown User`;
          } else if (isDM) {
            const senderInfo = mapSenderToUser(message.content.senderId);
            conversationIcon = senderInfo.userIcon || DefaultImages.UNKNOWN_USER;
            conversationDisplayName = senderInfo.displayName || t`Unknown User`;
          }
        } catch (error) {
          console.error('Failed to get conversation info:', error);
          const senderInfo = mapSenderToUser(message.content.senderId);
          conversationIcon = senderInfo.userIcon || DefaultImages.UNKNOWN_USER;
          conversationDisplayName = senderInfo.displayName || t`Unknown User`;
        }

        // Update IndexedDB
        await messageDB.saveMessage(
          updatedMessage,
          message.createdDate,
          currentSpaceId,
          isDM ? 'direct' : 'group',
          conversationIcon,
          conversationDisplayName
        );

        // Build the edit message object
        const editMessage = {
          type: 'edit-message' as const,
          originalMessageId: message.messageId,
          editedText,
          editedAt,
          editNonce,
        };

        // Route to appropriate handler based on DM vs Space
        if (actionQueueService && currentPasskeyInfo) {
          if (isDM) {
            // DM: Use Double Ratchet encryption via edit-dm handler (if enabled and offline)
            // When online, use legacy path to handle new devices properly
            const isOnline = navigator.onLine;
            if (ENABLE_DM_ACTION_QUEUE && dmContext?.self && !isOnline) {
              await actionQueueService.enqueue(
                'edit-dm',
                {
                  address: currentSpaceId,
                  messageId: message.messageId,
                  editMessage,
                  selfUserAddress: dmContext.self.user_address,
                  senderDisplayName: currentPasskeyInfo.displayName,
                  senderUserIcon: currentPasskeyInfo.pfpUrl,
                },
                `edit-dm:${currentSpaceId}:${message.messageId}`
              );
            } else {
              // Fallback to legacy path if DM context unavailable or feature disabled
              await submitMessage(editMessage);
            }
          } else {
            // Space: Use Triple Ratchet encryption via edit-message handler
            await actionQueueService.enqueue(
              'edit-message',
              {
                messageId: message.messageId,
                spaceId: currentSpaceId,
                channelId: currentChannelId,
                editMessage,
                currentPasskeyInfo,
              },
              `edit:${currentSpaceId}:${currentChannelId}:${message.messageId}`
            );
          }
        } else {
          // Fallback for missing context
          await submitMessage(editMessage);
        }
      } catch (error) {
        console.error('Failed to save/send edit:', error);
      }
    })();
  };

  return (
    <Container className="message-edit-container">
      {/* Markdown Toolbar */}
      <MarkdownToolbar
        visible={showMarkdownToolbar}
        position={toolbarPosition}
        onFormat={handleMarkdownFormat}
      />

      {/* Edit Textarea */}
      <textarea
        ref={editTextareaRef}
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onMouseUp={handleTextareaMouseUp}
        onFocus={(e) => {
          // Move cursor to end of text
          const textarea = e.target as HTMLTextAreaElement;
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveEdit().catch((error) => {
              console.error('Failed to save edit:', error);
            });
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        className="message-edit-textarea"
        autoFocus
        rows={Math.min(editText.split('\n').length, 10)}
      />

      {/* Action Buttons */}
      <FlexRow className="message-edit-actions" justify="between" align="start">
        <Text variant="muted" size="sm" className="message-edit-hint hidden sm:block">
          {t`Press Enter to save, Shift+Enter for new line, Esc to cancel`}
        </Text>
        <FlexRow gap="xs">
          <Button
            type="subtle"
            size="sm"
            onClick={onCancel}
          >
            {t`Cancel`}
          </Button>
          <Button
            type="primary"
            size="sm"
            onClick={() => {
              handleSaveEdit().catch((error) => {
                console.error('Failed to save edit:', error);
              });
            }}
            disabled={!editText.trim()}
          >
            {t`Save`}
          </Button>
        </FlexRow>
      </FlexRow>
    </Container>
  );
}
