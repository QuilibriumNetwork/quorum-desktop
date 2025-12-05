import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea, Callout } from '../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import type { AttachmentProcessingResult } from '../../utils/imageProcessing';
import { useMentionInput, type MentionOption } from '../../hooks/business/mentions';
import type { Group } from '../../api/quorumApi';
import { truncateAddress } from '../../utils';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { isTouchDevice } from '../../utils/platform';
import './MessageComposer.scss';
import { UserAvatar } from '../user/UserAvatar';
import { MarkdownToolbar } from './MarkdownToolbar';
import type { FormatFunction } from '../../utils/markdownFormatting';
import { calculateToolbarPosition } from '../../utils/toolbarPositioning';
import { ENABLE_MARKDOWN } from '../../config/features';

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
        textareaRef.current?.focus();
      },
    }));

    // Handle mention selection (updated for users, roles, channels, and @everyone with enhanced readable format)
    const handleMentionSelect = useCallback(
      (option: MentionOption, mentionStart: number, mentionEnd: number) => {
        let insertText: string;

        if (option.type === 'user') {
          // Users: @[Display Name]<address> (new readable format with display name)
          const displayName = option.data.displayName || 'Unknown User';
          // Escape brackets in display names to prevent format conflicts
          const escapedDisplayName = displayName.replace(/[[\]]/g, '');
          insertText = `@[${escapedDisplayName}]<${option.data.address}>`;
        } else if (option.type === 'role') {
          // Roles: @roleTag (NO brackets, unchanged)
          insertText = `@${option.data.roleTag}`;
        } else if (option.type === 'channel') {
          // Channels: #[Channel Name]<channelId> (new readable format with channel name)
          const channelName = option.data.channelName || 'Unknown Channel';
          // Escape brackets in channel names to prevent format conflicts
          const escapedChannelName = channelName.replace(/[[\]]/g, '');
          insertText = `#[${escapedChannelName}]<${option.data.channelId}>`;
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
      [value, onChange]
    );

    // Use mention input hook (now supports roles and grouped channels)
    const mentionInput = useMentionInput({
      textValue: value,
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

    // Handle key down with mention support
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Let mention dropdown handle keys first
        if (mentionInput.handleKeyDown(e)) {
          return;
        }
        // Otherwise pass to original handler
        onKeyDown(e);
        // Update cursor position
        setTimeout(() => {
          setCursorPosition(textareaRef.current?.selectionStart || 0);
        }, 0);
      },
      [mentionInput, onKeyDown]
    );

    // Update cursor position on click/selection
    const handleSelect = useCallback(() => {
      setCursorPosition(textareaRef.current?.selectionStart || 0);
    }, []);

    // Handle text selection for markdown toolbar
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

    // Handle markdown formatting
    const handleMarkdownFormat = useCallback(
      (formatFn: FormatFunction) => {
        const result = formatFn(value, selectionRange.start, selectionRange.end);
        onChange(result.newText);

        // Restore selection and focus (same pattern as handleMentionSelect)
        setTimeout(() => {
          textareaRef.current?.setSelectionRange(result.newStart, result.newEnd);
          textareaRef.current?.focus();
          setShowMarkdownToolbar(false);
        }, 0);
      },
      [value, selectionRange, onChange]
    );

    // Manage dropdown open state based on mentionInput
    useEffect(() => {
      setDropdownOpen(mentionInput.showDropdown);
    }, [mentionInput.showDropdown]);

    // Track typing state for mobile button hiding
    useEffect(() => {
      setIsTyping(value.length > 0);
    }, [value]);

    // Auto-resize textarea based on content
    useEffect(() => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;

        // For empty textarea, use fixed height that matches button height
        if (!value || value.trim() === '') {
          textarea.style.height = '32px'; // With box-sizing: border-box, this includes padding
          textarea.style.overflowY = 'hidden';
          setIsMultiline(false);
          return;
        }

        // For content, calculate based on scrollHeight
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = isDesktop ? 240 : 100;

        const newHeight = Math.min(scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';

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
                  onClick={() => option.type !== 'group-header' && mentionInput.selectOption(option)}
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
                          {truncateAddress(option.data.address)}
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
            <TextArea
              ref={textareaRef}
              value={value}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
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
