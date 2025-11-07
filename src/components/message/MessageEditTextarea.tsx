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
import { DefaultImages } from '../../utils';

interface MessageEditTextareaProps {
  message: MessageType;
  initialText: string;
  onCancel: () => void;
  submitMessage: (message: any) => Promise<void>;
  mapSenderToUser: (senderId: string) => any;
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
}: MessageEditTextareaProps) {
  const queryClient = useQueryClient();
  const { messageDB } = useMessageDB();

  // Edit state
  const [editText, setEditText] = useState(initialText);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Markdown toolbar state
  const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  // Handle text selection for markdown toolbar
  const handleTextareaMouseUp = useCallback(() => {
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
    console.time('[Edit] Total handleSaveEdit');
    console.time('[Edit] 1. Initial setup');

    const editNonce = crypto.randomUUID();
    const editedAt = Date.now();
    const editedTextArray = editText.split('\n');
    const editedText = editedTextArray.length === 1 ? editedTextArray[0] : editedTextArray;

    const currentSpaceId = message.spaceId;
    const currentChannelId = message.channelId;
    const isDM = currentSpaceId === currentChannelId;

    console.timeEnd('[Edit] 1. Initial setup');
    console.time('[Edit] 2. Build edits array (optimistic - will check saveEditHistory async)');

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

    console.timeEnd('[Edit] 2. Build edits array (optimistic - will check saveEditHistory async)');
    console.time('[Edit] 3. Create updatedMessage object');

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

    console.timeEnd('[Edit] 3. Create updatedMessage object');
    console.time('[Edit] 4. Update React Query cache');

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

    console.timeEnd('[Edit] 4. Update React Query cache');
    console.time('[Edit] 5. Close edit UI');

    // Close edit UI IMMEDIATELY
    onCancel();

    console.timeEnd('[Edit] 5. Close edit UI');
    console.timeEnd('[Edit] Total handleSaveEdit');
    console.log('[Edit] Synchronous operations complete, starting async operations...');

    // Update IndexedDB and send asynchronously
    (async () => {
      console.time('[Edit] Async: Total async operations');
      try {
        console.time('[Edit] Async: 0. Check saveEditHistory setting');

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

        console.timeEnd('[Edit] Async: 0. Check saveEditHistory setting');
        console.time('[Edit] Async: 1. Get conversation info');

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

        console.timeEnd('[Edit] Async: 1. Get conversation info');
        console.time('[Edit] Async: 2. Save to IndexedDB');

        // Update IndexedDB
        await messageDB.saveMessage(
          updatedMessage,
          message.createdDate,
          currentSpaceId,
          isDM ? 'direct' : 'group',
          conversationIcon,
          conversationDisplayName
        );

        console.timeEnd('[Edit] Async: 2. Save to IndexedDB');
        console.time('[Edit] Async: 3. Send edit message');

        // Send edit message
        await submitMessage({
          type: 'edit-message',
          originalMessageId: message.messageId,
          editedText,
          editedAt,
          editNonce,
        });

        console.timeEnd('[Edit] Async: 3. Send edit message');
        console.timeEnd('[Edit] Async: Total async operations');
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
            console.time('[Edit] onKeyDown: Enter pressed to handleSaveEdit complete');
            console.log('[Edit] onKeyDown: Enter key pressed, calling handleSaveEdit...');
            handleSaveEdit().catch((error) => {
              console.error('Failed to save edit:', error);
            });
            console.timeEnd('[Edit] onKeyDown: Enter pressed to handleSaveEdit complete');
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
              console.time('[Edit] onClick: Save button clicked to handleSaveEdit complete');
              console.log('[Edit] onClick: Save button clicked, calling handleSaveEdit...');
              handleSaveEdit().catch((error) => {
                console.error('Failed to save edit:', error);
              });
              console.timeEnd('[Edit] onClick: Save button clicked to handleSaveEdit complete');
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
