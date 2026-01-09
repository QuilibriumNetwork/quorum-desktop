import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea, Callout } from '../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import type { AttachmentProcessingResult } from '../../utils/imageProcessing';
import { useMentionInput, type MentionOption, useMentionPillEditor } from '../../hooks/business/mentions';
import type { Group } from '../../api/quorumApi';
import { getAddressSuffix } from '../../utils';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { isTouchDevice } from '../../utils/platform';
import './MessageComposer.scss';
import { UserAvatar } from '../user/UserAvatar';
import { MarkdownToolbar } from './MarkdownToolbar';
import type { FormatFunction } from '../../utils/markdownFormatting';
import { toggleBold, toggleItalic, toggleStrikethrough, wrapCode } from '../../utils/markdownFormatting';
import { calculateToolbarPosition } from '../../utils/toolbarPositioning';
import { ENABLE_MARKDOWN, ENABLE_MENTION_PILLS } from '../../config/features';

interface User {
  address: string;
  displayName?: string;
  userIcon?: string;
}

interface Role {
  roleId: string;
  displayName: string;
  roleTag: string;
  color: string;
}

interface MessageComposerProps {
  // Textarea props
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  calculateRows: () => number;

  // File upload props
  getRootProps: () => any;
  getInputProps: () => any;
  processedImage?: AttachmentProcessingResult;
  clearFile: () => void;

  // Actions
  onSubmitMessage: () => void;
  onShowStickers: () => void;
  hasStickers?: boolean;

  // Reply-to and error handling
  inReplyTo?: any;
  fileError?: string | null;
  mentionError?: string | null;
  isProcessingImage?: boolean;
  mapSenderToUser?: (senderId: string) => { displayName?: string };
  setInReplyTo?: (inReplyTo: any) => void;

  // Message validation props
  messageValidation?: {
    isOverLimit: boolean;
    isApproachingLimit: boolean;
    shouldShowCounter: boolean;
    remainingChars: number;
    messageLength: number;
    maxLength: number;
    isValid: boolean;
  };
  characterCount?: string;

  // Signing toggle props
  showSigningToggle?: boolean;
  skipSigning?: boolean;
  onSigningToggle?: () => void;

  // Read-only channel support
  disabled?: boolean;
  disabledMessage?: string;

  // Mention support
  users?: User[];
  roles?: Role[];
  groups?: Group[]; // Changed from channels to groups for grouped channel mentions
  canUseEveryone?: boolean;
}

export interface MessageComposerRef {
  focus: () => void;
}

export const MessageComposer = forwardRef<
  MessageComposerRef,
  MessageComposerProps
>(
  (
    {
      value,
      onChange,
      onKeyDown,
      placeholder,
      calculateRows: _calculateRows,
      getRootProps,
      getInputProps,
      processedImage,
      clearFile,
      onSubmitMessage,
      onShowStickers,
      hasStickers = true,
      inReplyTo,
      fileError,
      mentionError,
      isProcessingImage = false,
      mapSenderToUser,
      setInReplyTo,
      messageValidation,
      characterCount,
      showSigningToggle = false,
      skipSigning = false,
      onSigningToggle,
      disabled = false,
      disabledMessage,
      users = [],
      roles = [],
      groups = [],
      canUseEveryone = false,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isMultiline, setIsMultiline] = useState(false);
    const [responsivePlaceholder, setResponsivePlaceholder] = useState(placeholder);
    const { isDesktop } = useResponsiveLayout();

    // Mention pill editor hook (for contentEditable mode)
    const pillEditor = useMentionPillEditor({
      onTextChange: onChange,
    });
    const { editorRef, extractVisualText, extractStorageText, getCursorPosition, insertPill } = pillEditor;

    // Markdown toolbar state
    const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
    const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
    const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

    // Update placeholder for extra small screens (< 480px)
    useEffect(() => {
      const updatePlaceholder = () => {
        if (window.innerWidth <= 480) {
          setResponsivePlaceholder(t`Message...`);
        } else {
          setResponsivePlaceholder(placeholder);
        }
      };
      updatePlaceholder();
      window.addEventListener('resize', updatePlaceholder);
      return () => window.removeEventListener('resize', updatePlaceholder);
    }, [placeholder]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (ENABLE_MENTION_PILLS) {
          editorRef.current?.focus();
        } else {
          textareaRef.current?.focus();
        }
      },
    }));

    // Handle mention selection (updated for users, roles, channels, and @everyone with enhanced readable format)
    const handleMentionSelect = useCallback(
      (option: MentionOption, mentionStart: number, mentionEnd: number) => {
        // If mention pills are enabled, use contentEditable pill insertion
        if (ENABLE_MENTION_PILLS) {
          insertPill(option, mentionStart, mentionEnd);
          return;
        }

        // Otherwise, use the original text-based insertion
        let insertText: string;

        if (option.type === 'user') {
          // Users: @<address> (legacy format - consistent with pills-enabled mode)
          insertText = `@<${option.data.address}>`;
        } else if (option.type === 'role') {
          // Roles: @roleTag (NO brackets, unchanged)
          insertText = `@${option.data.roleTag}`;
        } else if (option.type === 'channel') {
          // Channels: #<channelId> (legacy format - consistent with pills-enabled mode)
          insertText = `#<${option.data.channelId}>`;
        } else {
          // @everyone: plain @everyone (NO brackets, unchanged)
          insertText = '@everyone';
        }

        const newValue =
          value.substring(0, mentionStart) +
          insertText +
          value.substring(mentionEnd);
        onChange(newValue);

        // Set cursor position after the mention
        setTimeout(() => {
          const newPosition = mentionStart + insertText.length;
          textareaRef.current?.setSelectionRange(newPosition, newPosition);
          textareaRef.current?.focus();
        }, 0);
      },
      [value, onChange, insertPill]
    );

    // Use mention input hook (now supports roles and grouped channels)
    const mentionInput = useMentionInput({
      textValue: ENABLE_MENTION_PILLS ? extractVisualText() : value,
      cursorPosition,
      users,
      roles,
      groups,
      canUseEveryone,
      onMentionSelect: handleMentionSelect,
    });


    // Track cursor position
    const handleTextareaChange = useCallback(
      (newValue: string) => {
        onChange(newValue);
        setTimeout(() => {
          setCursorPosition(textareaRef.current?.selectionStart || 0);
        }, 0);
      },
      [onChange]
    );

    // Handle input changes for contentEditable
    const handleEditorInput = useCallback(() => {
      const newText = extractStorageText();
      onChange(newText);
      setCursorPosition(getCursorPosition());
    }, [extractStorageText, onChange, getCursorPosition]);

    // Handle copy/paste for contentEditable
    const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
      handleEditorInput();
    }, [handleEditorInput]);

    const handleEditorCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = extractStorageText();
      e.clipboardData.setData('text/plain', text);
    }, [extractStorageText]);

    // Handle key down for contentEditable (with pill deletion)
    const handleEditorKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Let mention dropdown handle keys first
        if (mentionInput.handleKeyDown(e as any)) {
          return;
        }

        // Handle backspace to delete pills
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;

          const range = selection.getRangeAt(0);
          if (!range.collapsed) return; // Let default behavior handle text selection

          // Check if cursor is right after a pill
          const { startContainer, startOffset } = range;

          if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
            const prevSibling = startContainer.previousSibling;
            if (prevSibling && (prevSibling as HTMLElement).dataset?.mentionType) {
              e.preventDefault();
              prevSibling.remove();
              handleEditorInput();
              return;
            }
          } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
            const prevChild = (startContainer as HTMLElement).childNodes[startOffset - 1];
            if (prevChild && (prevChild as HTMLElement).dataset?.mentionType) {
              e.preventDefault();
              prevChild.remove();
              handleEditorInput();
              return;
            }
          }
        }

        // Pass to original handler (cast to expected type)
        onKeyDown(e as any);
        // Update cursor position
        setTimeout(() => {
          setCursorPosition(getCursorPosition());
        }, 0);
      },
      [mentionInput, onKeyDown, handleEditorInput, getCursorPosition]
    );

    // Handle key down for textarea (original implementation)
    const handleTextareaKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Let mention dropdown handle keys first
        if (mentionInput.handleKeyDown(e)) {
          return;
        }

        // Markdown keyboard shortcuts (Ctrl/Cmd + key)
        if (ENABLE_MARKDOWN && (e.ctrlKey || e.metaKey)) {
          const textarea = textareaRef.current;
          if (!textarea) return;

          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;

          // Helper to apply formatting
          const applyFormat = (formatFn: FormatFunction) => {
            e.preventDefault();
            const result = formatFn(value, start, end);
            onChange(result.newText);
            setTimeout(() => {
              textareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
              textareaRef.current?.focus();
            }, 0);
          };

          // Ctrl/Cmd + B: Bold
          if (e.key === 'b' && !e.shiftKey) {
            applyFormat(toggleBold);
            return;
          }

          // Ctrl/Cmd + I: Italic
          if (e.key === 'i' && !e.shiftKey) {
            applyFormat(toggleItalic);
            return;
          }

          // Ctrl/Cmd + Shift + X: Strikethrough
          if (e.key === 'X' && e.shiftKey) {
            applyFormat(toggleStrikethrough);
            return;
          }

          // Ctrl/Cmd + Shift + M: Inline code
          if (e.key === 'M' && e.shiftKey) {
            applyFormat(wrapCode);
            return;
          }
        }

        // Otherwise pass to original handler
        onKeyDown(e);
        // Update cursor position
        setTimeout(() => {
          setCursorPosition(textareaRef.current?.selectionStart || 0);
        }, 0);
      },
      [mentionInput, onKeyDown, value, onChange]
    );

    // Update cursor position on click/selection
    const handleSelect = useCallback(() => {
      setCursorPosition(textareaRef.current?.selectionStart || 0);
    }, []);

    // Handle text selection for markdown toolbar (textarea version)
    const handleTextareaMouseUp = useCallback(() => {
      // Skip markdown toolbar if feature is disabled or on touch devices
      if (!ENABLE_MARKDOWN || isTouchDevice()) return;

      const textarea = textareaRef.current;
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

    // Handle text selection for markdown toolbar (contentEditable version)
    const handleEditorMouseUp = useCallback(() => {
      // Skip markdown toolbar if feature is disabled or on touch devices
      if (!ENABLE_MARKDOWN || isTouchDevice()) return;

      const editor = editorRef.current;
      if (!editor) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowMarkdownToolbar(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = range.toString();

      if (selectedText.length > 0) {
        // Text is selected - get character positions
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const start = preCaretRange.toString().length;
        const end = start + selectedText.length;

        setSelectionRange({ start, end });

        // Calculate position using native Selection API (works for contentEditable)
        const rangeRect = range.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();

        // Calculate centered position above the selection
        const TOOLBAR_OFFSET = 52;
        const TOOLBAR_WIDTH = 240;
        const VIEWPORT_PADDING = 16;

        const selectionCenterX = rangeRect.left + (rangeRect.width / 2);
        let toolbarLeft = selectionCenterX - (TOOLBAR_WIDTH / 2);

        // Clamp to viewport boundaries
        const maxLeft = window.innerWidth - TOOLBAR_WIDTH - VIEWPORT_PADDING;
        toolbarLeft = Math.max(VIEWPORT_PADDING, Math.min(toolbarLeft, maxLeft));

        const toolbarTop = rangeRect.top - TOOLBAR_OFFSET;

        // Only show if there's enough space above
        if (toolbarTop > 10) {
          setToolbarPosition({ top: toolbarTop, left: toolbarLeft });
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
        if (ENABLE_MENTION_PILLS && editorRef.current) {
          // For contentEditable: use visual text for formatting
          const visualText = extractVisualText();
          const result = formatFn(visualText, selectionRange.start, selectionRange.end);

          // For now, we'll just insert the formatted text as plain text
          // TODO: A more sophisticated approach would preserve pills while formatting
          editorRef.current.textContent = result.newText;

          // Restore selection
          setTimeout(() => {
            const selection = window.getSelection();
            if (selection && editorRef.current) {
              const range = document.createRange();
              const textNode = editorRef.current.firstChild;
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                range.setStart(textNode, Math.min(result.newStart, textNode.textContent?.length || 0));
                range.setEnd(textNode, Math.min(result.newEnd, textNode.textContent?.length || 0));
                selection.removeAllRanges();
                selection.addRange(range);
              }
              editorRef.current.focus();
            }
            setShowMarkdownToolbar(false);

            // Update the value
            const newText = extractStorageText();
            onChange(newText);
          }, 0);
        } else {
          // For textarea: original behavior
          const result = formatFn(value, selectionRange.start, selectionRange.end);
          onChange(result.newText);

          // Restore selection and focus (same pattern as handleMentionSelect)
          setTimeout(() => {
            textareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
            textareaRef.current?.focus();
            setShowMarkdownToolbar(false);
          }, 0);
        }
      },
      [value, selectionRange, onChange, extractVisualText, extractStorageText]
    );

    // Manage dropdown open state based on mentionInput
    useEffect(() => {
      setDropdownOpen(mentionInput.showDropdown);
    }, [mentionInput.showDropdown]);

    // Track typing state for mobile button hiding
    useEffect(() => {
      setIsTyping(value.length > 0);
    }, [value]);

    // Sync contentEditable editor with value prop (clear editor when value is empty)
    useEffect(() => {
      if (ENABLE_MENTION_PILLS && editorRef.current) {
        // If value is empty, clear the editor content
        if (!value || value.trim() === '') {
          if (editorRef.current.textContent !== '') {
            editorRef.current.innerHTML = '';
          }
        }
      }
    }, [value]);

    // Update cursor position when contentEditable changes (for mention detection)
    useEffect(() => {
      if (ENABLE_MENTION_PILLS && editorRef.current) {
        const updateCursor = () => {
          setCursorPosition(getCursorPosition());
        };

        // Update cursor on selection change
        document.addEventListener('selectionchange', updateCursor);
        return () => document.removeEventListener('selectionchange', updateCursor);
      }
    }, [getCursorPosition]);

    // Auto-resize textarea/editor based on content
    useEffect(() => {
      const element = ENABLE_MENTION_PILLS ? editorRef.current : textareaRef.current;
      if (element) {
        // For empty content, use fixed height that matches button height
        if (!value || value.trim() === '') {
          element.style.height = '32px'; // With box-sizing: border-box, this includes padding
          element.style.overflowY = 'hidden';
          // Delay multiline state change to allow CSS height transition to complete
          // This prevents the pill shape from appearing while element is still visually tall
          setTimeout(() => setIsMultiline(false), 100);
          return;
        }

        // For content, calculate based on scrollHeight
        element.style.height = 'auto';
        const scrollHeight = element.scrollHeight;
        const maxHeight = isDesktop ? 240 : 100;

        const newHeight = Math.min(scrollHeight, maxHeight);
        element.style.height = `${newHeight}px`;
        element.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';

        // Update multiline state based on height - consider multiline if height > 32px (single line)
        setIsMultiline(newHeight > 32);
      }
    }, [value, isDesktop]);
    // If disabled, show a message instead of the composer
    if (disabled) {
      return (
        <div className="message-composer-container">
          <div className="message-composer-disabled">
            <Icon name="lock" size="sm" className="message-composer-disabled-icon" />
            <span className="message-composer-disabled-text">
              {disabledMessage || t`You cannot post in this channel`}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="message-composer-container">
        {/* Error, processing indicator, character counter, and reply-to display */}
        {(fileError || mentionError || inReplyTo || isProcessingImage || (messageValidation?.shouldShowCounter)) && (
          <div className="message-composer-info-container">
            {isProcessingImage && (
              <div className="message-composer-callout">
                <Callout
                  variant="warning"
                  layout="minimal"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Icon name="spinner" size="xs" className="icon-spin" />
                  {t`Processing image... This may take a moment for large files.`}
                </Callout>
              </div>
            )}
            {/* Combined character counter and errors */}
            {((messageValidation?.shouldShowCounter && characterCount) || fileError || mentionError) && (
              <div className="message-composer-callout">
                <div className="message-composer-errors-container">
                  {messageValidation?.shouldShowCounter && characterCount && (
                    <div
                      className={`message-composer-character-counter ${
                        messageValidation.isOverLimit ? 'error' : ''
                      }`}
                    >
                      {characterCount}
                    </div>
                  )}
                  {messageValidation?.shouldShowCounter && characterCount && (fileError || mentionError) && (
                    <div className="message-composer-error-separator">|</div>
                  )}
                  <div className="message-composer-error-messages">
                    {fileError && (
                      <Callout
                        variant="error"
                        layout="minimal"
                        size="sm"
                      >
                        {fileError}
                      </Callout>
                    )}
                    {mentionError && (
                      <Callout
                        variant="error"
                        layout="minimal"
                        size="sm"
                      >
                        {mentionError}
                      </Callout>
                    )}
                  </div>
                </div>
              </div>
            )}
            {inReplyTo && mapSenderToUser && setInReplyTo && (
              <div
                onClick={() => setInReplyTo(undefined)}
                className="message-composer-reply-bar flex items-center min-w-0"
              >
                <span className="message-composer-reply-text flex items-center min-w-0 flex-1">
                  <span className="flex-shrink-0">{i18n._('Replying to')}</span>
                  <span className="ml-1 truncate-user-name-chat">
                    {mapSenderToUser(inReplyTo.content.senderId).displayName}
                  </span>
                </span>
                <Icon
                  name="close"
                  size="sm"
                  className="message-composer-reply-close flex-shrink-0 ml-2"
                  onClick={() => {
                    setInReplyTo(undefined);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* File preview */}
        {processedImage && (
          <div className="message-composer-file-preview">
            <div className="message-composer-file-container">
              <Button
                className="message-composer-file-close"
                type="subtle"
                size="small"
                onClick={clearFile}
              >
                <Icon name="close" size="sm" />
              </Button>
              <div className="relative">
                <img
                  className="message-composer-file-image"
                  src={
                    processedImage.thumbnail
                      ? URL.createObjectURL(processedImage.thumbnail.file)
                      : URL.createObjectURL(processedImage.full.file)
                  }
                  alt="File preview"
                />
                {processedImage.isLargeGif && processedImage.thumbnail && (
                  <div className="message-composer-gif-overlay">
                    <div className="message-composer-play-icon">
                      <svg className="message-composer-play-svg" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mention Dropdown - positioned above the input */}
        {dropdownOpen && mentionInput.filteredOptions.length > 0 && (
          <div className="message-composer-mention-dropdown">
            <div className="message-composer-mention-container">
              {mentionInput.filteredOptions.map((option, index) => (
                <div
                  key={option.type === 'user' ? option.data.address :
                       option.type === 'role' ? option.data.roleId :
                       option.type === 'channel' ? option.data.channelId :
                       option.type === 'group-header' ? `group-${option.data.groupName}` :
                       'everyone'}
                  className={`${option.type === 'group-header' ? 'message-composer-group-header' : 'message-composer-mention-item'} ${
                    option.type !== 'group-header' && index === mentionInput.selectedIndex ? 'selected' : ''
                  } ${
                    index === 0 ? 'first' : ''
                  } ${
                    index === mentionInput.filteredOptions.length - 1 ? 'last' : ''
                  } ${option.type === 'role' ? 'role-item' :
                      option.type === 'everyone' ? 'everyone-item' :
                      option.type === 'channel' ? 'channel-item' :
                      option.type === 'group-header' ? 'group-item' : 'user-item'}`}
                  onMouseDown={(e) => {
                    // Prevent focus loss from contentEditable when clicking dropdown
                    e.preventDefault();
                  }}
                  onClick={() => {
                    if (option.type !== 'group-header') {
                      mentionInput.selectOption(option);
                    }
                  }}
                >
                  {option.type === 'group-header' ? (
                    <>
                      {option.data.icon && (
                        <div
                          className="message-composer-group-icon"
                          style={{ color: option.data.iconColor }}
                        >
                          <Icon name={option.data.icon as any} size="sm" />
                        </div>
                      )}
                      <span className="message-composer-group-name">
                        {option.data.groupName}
                      </span>
                    </>
                  ) : option.type === 'user' ? (
                    <>
                      <UserAvatar
                        userIcon={option.data.userIcon}
                        displayName={option.data.displayName || t`Unknown User`}
                        address={option.data.address}
                        size={32}
                        className="message-composer-mention-avatar"
                      />
                      <div className="message-composer-mention-info">
                        <span className="message-composer-mention-name">
                          {option.data.displayName || t`Unknown User`}
                        </span>
                        <span className="message-composer-mention-address">
                          {getAddressSuffix(option.data.address)}
                        </span>
                      </div>
                    </>
                  ) : option.type === 'role' ? (
                    <>
                      <div
                        className="message-composer-role-badge"
                        style={{ backgroundColor: option.data.color }}
                      >
                        <Icon name="users" size="sm" />
                      </div>
                      <div className="message-composer-mention-info">
                        <span className="message-composer-mention-name">
                          {option.data.displayName}
                        </span>
                        <span className="message-composer-mention-role-tag">
                          @{option.data.roleTag}
                        </span>
                      </div>
                    </>
                  ) : option.type === 'channel' ? (
                    <>
                      <div
                        className="message-composer-channel-badge"
                        style={option.data.icon && option.data.iconColor ? { color: option.data.iconColor } : undefined}
                      >
                        <Icon
                          name={option.data.icon || "hashtag"}
                          size="sm"
                        />
                      </div>
                      <div className="message-composer-mention-info">
                        <span className="message-composer-mention-name">
                          {option.data.channelName}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="message-composer-everyone-badge">
                        <Icon name="globe" size="sm" />
                      </div>
                      <div className="message-composer-mention-info">
                        <span className="message-composer-mention-name">
                          @everyone
                        </span>
                        <span className="message-composer-mention-address">
                          {t`Notify all members`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Markdown Toolbar */}
        <MarkdownToolbar
          visible={showMarkdownToolbar}
          position={toolbarPosition}
          onFormat={handleMarkdownFormat}
        />

        {/* Message input row */}
        <FlexRow
          ref={composerRef}
          className={`message-composer-row ${inReplyTo ? 'has-reply' : ''} ${isTyping ? 'typing' : ''} ${isMultiline ? 'multiline' : ''} ${messageValidation?.isOverLimit ? 'character-limit-exceeded' : ''}`}
        >
          <Tooltip id="attach-image" content={t`attach image`} place="top" showOnTouch={false}>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                type="unstyled"
                onClick={() => {}} // onClick handled by dropzone
                className="message-composer-upload-btn"
                iconName="paperclip"
                iconSize="lg"
                iconOnly
              />
            </div>
          </Tooltip>

          <div className="message-composer-textarea-container">
            {ENABLE_MENTION_PILLS ? (
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleEditorPaste}
                onCopy={handleEditorCopy}
                onMouseUp={handleEditorMouseUp}
                className="message-composer-contenteditable"
                data-placeholder={responsivePlaceholder}
                suppressContentEditableWarning
              />
            ) : (
              <TextArea
                ref={textareaRef}
                value={value}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                onSelect={handleSelect}
                onMouseUp={handleTextareaMouseUp}
                placeholder={responsivePlaceholder}
                autoResize={false}
                rows={1}
                variant="filled"
                noFocusStyle={true}
                resize={false}
                className="message-composer-textarea"
              />
            )}
          </div>

          {hasStickers && (
            <Tooltip id="add-sticker" content={t`add sticker`} place="top" showOnTouch={false}>
              <Button
                type="unstyled"
                className="message-composer-sticker-btn"
                onClick={onShowStickers}
                iconName="smile"
                iconSize="lg"
                iconOnly
              />
            </Tooltip>
          )}

          {showSigningToggle && (
            <Tooltip
              id="composer-signing-toggle"
              content={
                skipSigning
                  ? t`Messages are NOT signed!`
                  : t`Messages are signed!`
              }
              place="top"
              showOnTouch={false}
              autoHideAfter={1500}
            >
              <Button
                type="unstyled"
                onClick={onSigningToggle}
                className={`message-composer-signing-btn ${
                  skipSigning ? 'unsigned' : 'signed'
                }`}
                iconName={skipSigning ? 'unlock' : 'lock'}
                iconSize="lg"
                iconOnly
              />
            </Tooltip>
          )}

          <Button
            type="unstyled"
            onClick={messageValidation?.isOverLimit ? undefined : onSubmitMessage}
            className={`message-composer-send-btn ${messageValidation?.isOverLimit ? 'disabled' : ''}`}
          />
        </FlexRow>
      </div>
    );
  }
);

export { MessageComposer as default };
