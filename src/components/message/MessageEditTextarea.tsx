import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InfiniteData } from '@tanstack/react-query';
import { Container, Flex } from '../primitives';
import { MarkdownToolbar } from './MarkdownToolbar';
import { MentionDropdown } from './MentionDropdown';
import { calculateToolbarPosition } from '../../utils/toolbarPositioning';
import type { FormatFunction } from '../../utils/markdownFormatting';
import type { Message as MessageType, PostMessage, Role, Channel } from '../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
import { useMessageDB } from '../context/useMessageDB';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { DefaultImages } from '../../utils';
import { isTouchDevice } from '../../utils/platform';
import { ENABLE_MARKDOWN, ENABLE_DM_ACTION_QUEUE, ENABLE_MENTION_PILLS } from '../../config/features';
import { createIPFSCIDRegex } from '../../utils/validation';
import { useMentionInput, type MentionOption, useMentionPillEditor } from '../../hooks/business/mentions';
import { extractMentionsFromText } from '../../utils/mentionUtils';
import { getCaretCoordinates, type CaretCoordinates } from '../../utils/caretCoordinates';

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
  /** Space roles for role mention validation (required for pills) */
  spaceRoles?: Role[];
  /** Space channels for channel mention validation (required for pills) */
  spaceChannels?: Channel[];
  /** Users for mention autocomplete */
  users?: Array<{ address: string; displayName?: string; userIcon?: string }>;
  /** Roles for mention autocomplete */
  roles?: Array<{ roleId: string; roleTag: string; displayName: string; color: string }>;
  /** Channel groups for mention autocomplete */
  groups?: Array<{ groupName: string; channels: Channel[]; icon?: string; iconColor?: string }>;
  /** Whether @everyone is allowed */
  canUseEveryone?: boolean;
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
  spaceRoles = [],
  spaceChannels = [],
  users = [],
  roles = [],
  groups = [],
  canUseEveryone = false,
}: MessageEditTextareaProps) {
  const queryClient = useQueryClient();
  const { messageDB, actionQueueService } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();

  // Edit state
  const [editText, setEditText] = useState(initialText);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mention pill editor hook (for contentEditable mode)
  const pillEditor = useMentionPillEditor({
    onTextChange: setEditText,
  });
  const { editorRef, extractVisualText, extractStorageText, getCursorPosition, insertPill } = pillEditor;

  // Markdown toolbar state
  const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  // Mention autocomplete state
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [caretCoords, setCaretCoords] = useState<CaretCoordinates | null>(null);

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

  // Parse mentions from stored text and create pills (with double validation)
  const parseMentionsAndCreatePills = useCallback(
    (text: string): DocumentFragment => {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      // Helper to create a pill element
      const createPillElement = (
        type: 'user' | 'role' | 'channel' | 'everyone',
        displayName: string,
        address: string
      ): HTMLSpanElement => {
        const pill = document.createElement('span');
        pill.contentEditable = 'false';
        pill.dataset.mentionType = type;
        pill.dataset.mentionAddress = address;
        pill.dataset.mentionDisplayName = displayName;

        // Use the same CSS classes as rendered mentions in Message.tsx
        const mentionClasses = {
          user: 'message-mentions-user',
          role: 'message-mentions-role',
          channel: 'message-mentions-channel',
          everyone: 'message-mentions-everyone',
        };

        pill.className = `${mentionClasses[type]} message-composer-pill`;
        pill.textContent = type === 'channel' ? `#${displayName}` : `@${displayName}`;

        return pill;
      };

      // Collect all mentions
      const mentions: Array<{ type: 'user' | 'role' | 'channel' | 'everyone'; displayName: string; address: string; index: number; length: number }> = [];

      // User mentions: @<address> (legacy format only)
      const userRegex = new RegExp(`@<(${createIPFSCIDRegex().source})>`, 'g');
      let match: RegExpMatchArray | null;
      while ((match = userRegex.exec(text)) !== null) {
        const address = match[1];
        const index = match.index ?? 0;

        // Layer 2: Verify mention exists in message.mentions
        if (message.mentions?.memberIds?.includes(address)) {
          // Layer 1: Lookup real display name
          const user = mapSenderToUser(address);
          const displayName = user?.displayName || `Unknown User`;
          mentions.push({ type: 'user', displayName, address, index, length: match[0].length });
        }
      }

      // Channel mentions: #<channelId> (legacy format only)
      const channelRegex = /#<([^>]+)>/g;
      while ((match = channelRegex.exec(text)) !== null) {
        const channelId = match[1];
        const index = match.index ?? 0;

        // Layer 2: Verify mention exists in message.mentions
        if (message.mentions?.channelIds?.includes(channelId)) {
          // Layer 1: Lookup real channel name
          const channel = spaceChannels.find(c => c.channelId === channelId);
          const displayName = channel?.channelName || 'Unknown Channel';
          mentions.push({ type: 'channel', displayName, address: channelId, index, length: match[0].length });
        }
      }

      // Role mentions: @roleTag (no brackets, not followed by <)
      const roleRegex = /@([a-zA-Z0-9_-]+)(?!<)/g;
      while ((match = roleRegex.exec(text)) !== null) {
        const roleTag = match[1];
        const index = match.index ?? 0;

        // Skip @everyone (handled separately)
        if (roleTag.toLowerCase() === 'everyone') {
          continue;
        }

        // Layer 1: Find role to get roleId
        const role = spaceRoles.find(r => r.roleTag.toLowerCase() === roleTag.toLowerCase());
        if (role && message.mentions?.roleIds?.includes(role.roleId)) {
          // Layer 2: Verified - mention exists in message.mentions
          mentions.push({ type: 'role', displayName: role.roleTag, address: role.roleTag, index, length: match[0].length });
        }
      }

      // @everyone mentions
      const everyoneRegex = /@everyone/gi;
      while ((match = everyoneRegex.exec(text)) !== null) {
        const index = match.index ?? 0;

        // Layer 2: Verify @everyone exists in message.mentions
        if (message.mentions?.everyone) {
          mentions.push({ type: 'everyone', displayName: 'everyone', address: 'everyone', index, length: match[0].length });
        }
      }

      // Sort mentions by index
      mentions.sort((a, b) => a.index - b.index);

      // Build fragment with pills and text nodes
      mentions.forEach(mention => {
        // Add text before mention
        if (mention.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, mention.index)));
        }

        // Add pill
        fragment.appendChild(createPillElement(mention.type, mention.displayName, mention.address));

        lastIndex = mention.index + mention.length;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      return fragment;
    },
    [message, mapSenderToUser, spaceRoles, spaceChannels]
  );

  // Handle mention selection from dropdown
  const handleMentionSelect = useCallback(
    (option: MentionOption, mentionStart: number, mentionEnd: number) => {
      if (ENABLE_MENTION_PILLS && editorRef.current) {
        // Insert pill in contentEditable
        insertPill(option, mentionStart, mentionEnd);
        return;
      }

      // Fallback: text-based insertion for textarea mode
      let insertText: string;

      if (option.type === 'user') {
        insertText = `@<${option.data.address}>`;
      } else if (option.type === 'role') {
        insertText = `@${option.data.roleTag}`;
      } else if (option.type === 'channel') {
        insertText = `#<${option.data.channelId}>`;
      } else {
        insertText = '@everyone';
      }

      const newValue =
        editText.substring(0, mentionStart) +
        insertText +
        ' ' +
        editText.substring(mentionEnd);

      setEditText(newValue);

      // Move cursor after inserted mention
      setTimeout(() => {
        const newCursorPos = mentionStart + insertText.length + 1;
        editTextareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        editTextareaRef.current?.focus();
      }, 0);
    },
    [editText, insertPill]
  );

  // Use mention input hook
  const mentionInput = useMentionInput({
    textValue: ENABLE_MENTION_PILLS ? extractVisualText() : editText,
    cursorPosition,
    users,
    roles,
    groups,
    canUseEveryone,
    onMentionSelect: handleMentionSelect,
  });

  // Handle input changes for contentEditable
  const handleEditorInput = useCallback(() => {
    const newText = extractStorageText();
    setEditText(newText);

    // Update cursor position for mention detection and capture caret coordinates
    setTimeout(() => {
      setCursorPosition(getCursorPosition());
      // Capture caret coordinates for dropdown positioning
      const coords = getCaretCoordinates(editorRef.current, true);
      setCaretCoords(coords);
    }, 0);
  }, [extractStorageText, getCursorPosition]);

  // Handle key down for contentEditable (forward declaration needed)
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Let mention dropdown handle navigation keys if it's open
      if (mentionInput.showDropdown) {
        const handled = mentionInput.handleKeyDown(e);
        if (handled) {
          return; // Mention dropdown handled it
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Call handleSaveEdit directly (defined below)
        handleSaveEdit().catch((error) => {
          console.error('Failed to save edit:', error);
        });
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCancel, mentionInput] // handleSaveEdit is defined below, so we can't include it here
  );

  // Sync dropdown state with mention input
  useEffect(() => {
    setDropdownOpen(mentionInput.showDropdown);
  }, [mentionInput.showDropdown]);

  // Update cursor position when contentEditable changes (for mention detection)
  useEffect(() => {
    if (ENABLE_MENTION_PILLS && editorRef.current) {
      const updateCursor = () => {
        setCursorPosition(getCursorPosition());
      };

      // Update cursor on selection change
      document.addEventListener('selectionchange', updateCursor);
      return () => {
        document.removeEventListener('selectionchange', updateCursor);
      };
    }
  }, [getCursorPosition]);

  // Initialize contentEditable with pills on mount
  useEffect(() => {
    if (ENABLE_MENTION_PILLS && editorRef.current && initialText) {
      const fragment = parseMentionsAndCreatePills(initialText);
      editorRef.current.innerHTML = '';
      editorRef.current.appendChild(fragment);

      // Focus and move cursor to end
      setTimeout(() => {
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          editorRef.current.focus();
        }
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - initialText and parseMentionsAndCreatePills are stable

  // Scroll edit container into view on mount (prevents being hidden by MessageComposer)
  useEffect(() => {
    if (containerRef.current) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, []);

  const handleSaveEdit = async () => {
    const editNonce = crypto.randomUUID();
    const editedAt = Date.now();

    // Extract text from contentEditable (with pills) or use textarea value
    const editedTextString = ENABLE_MENTION_PILLS && editorRef.current
      ? extractStorageText()
      : editText;

    const editedTextArray = editedTextString.split('\n');
    const editedText = editedTextArray.length === 1 ? editedTextArray[0] : editedTextArray;

    const currentSpaceId = message.spaceId;
    const currentChannelId = message.channelId;
    const isDM = currentSpaceId === currentChannelId;

    // Extract mentions from edited text
    const mentions = extractMentionsFromText(editedTextString, {
      allowEveryone: canUseEveryone,
      spaceRoles: spaceRoles.map(r => ({ roleId: r.roleId, roleTag: r.roleTag })),
      spaceChannels: spaceChannels.map(c => ({ channelId: c.channelId, channelName: c.channelName })),
    });

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
      mentions: mentions, // Update mentions with newly extracted mentions
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

        // Build the edit message object with extracted mentions
        const editMessage = {
          type: 'edit-message' as const,
          originalMessageId: message.messageId,
          editedText,
          editedAt,
          editNonce,
          mentions, // Include extracted mentions so they can be updated when message is received
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
    <Container ref={containerRef} className="message-edit-container">
      {/* Markdown Toolbar */}
      <MarkdownToolbar
        visible={showMarkdownToolbar}
        position={toolbarPosition}
        onFormat={handleMarkdownFormat}
      />

      {/* Mention Dropdown - positioned above the input using Portal */}
      <MentionDropdown
        isOpen={dropdownOpen}
        filteredOptions={mentionInput.filteredOptions}
        selectedIndex={mentionInput.selectedIndex}
        onSelectOption={mentionInput.selectOption}
        showEveryoneDescription={false}
        usePortal={true}
        portalTargetRef={ENABLE_MENTION_PILLS ? editorRef : editTextareaRef}
        caretPosition={caretCoords}
      />

      {/* Edit Input - ContentEditable or Textarea */}
      {ENABLE_MENTION_PILLS ? (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          className="message-edit-textarea message-edit-contenteditable"
          suppressContentEditableWarning
        />
      ) : (
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
      )}

      {/* Action Links */}
      <Flex className="message-edit-actions" justify="start" align="start">
        <span className="text-label text-muted message-edit-hint">
          {t`Esc to`}{' '}
          <span
            className="link"
            onClick={onCancel}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCancel();
              }
            }}
          >
            {t`CANCEL`}
          </span>
          {' - '}{t`Enter to`}{' '}
          <span
            className="link"
            onClick={() => {
              handleSaveEdit().catch((error) => {
                console.error('Failed to save edit:', error);
              });
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSaveEdit().catch((error) => {
                  console.error('Failed to save edit:', error);
                });
              }
            }}
          >
            {t`SAVE`}
          </span>
          {' - '}{t`Shift+Enter for new line`}
        </span>
      </Flex>
    </Container>
  );
}
