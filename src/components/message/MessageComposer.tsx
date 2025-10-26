import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea, Callout } from '../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { Buffer } from 'buffer';
import type { AttachmentProcessingResult } from '../../utils/imageProcessing';
import { useMentionInput, type MentionOption } from '../../hooks/business/mentions';
import { truncateAddress } from '../../utils';
import { DefaultImages } from '../../utils';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import './MessageComposer.scss';
import { UserAvatar } from '../user/UserAvatar';

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
  isProcessingImage?: boolean;
  mapSenderToUser?: (senderId: string) => { displayName?: string };
  setInReplyTo?: (inReplyTo: any) => void;

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
      calculateRows,
      getRootProps,
      getInputProps,
      processedImage,
      clearFile,
      onSubmitMessage,
      onShowStickers,
      hasStickers = true,
      inReplyTo,
      fileError,
      isProcessingImage = false,
      mapSenderToUser,
      setInReplyTo,
      showSigningToggle = false,
      skipSigning = false,
      onSigningToggle,
      disabled = false,
      disabledMessage,
      users = [],
      roles = [],
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [responsivePlaceholder, setResponsivePlaceholder] = useState(placeholder);
    const { isMobile, isDesktop } = useResponsiveLayout();

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

    // Handle mention selection (updated for both users and roles)
    const handleMentionSelect = useCallback(
      (option: MentionOption, mentionStart: number, mentionEnd: number) => {
        let insertText: string;

        if (option.type === 'user') {
          // Users: @<address> (with brackets)
          insertText = `@<${option.data.address}>`;
        } else {
          // Roles: @roleTag (NO brackets)
          insertText = `@${option.data.roleTag}`;
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

    // Use mention input hook (now supports roles)
    const mentionInput = useMentionInput({
      textValue: value,
      cursorPosition,
      users,
      roles,
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
          return;
        }

        // For content, calculate based on scrollHeight
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = isDesktop ? 240 : 100;

        const newHeight = Math.min(scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
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
        {/* Error, processing indicator, and reply-to display */}
        {(fileError || inReplyTo || isProcessingImage) && (
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
            {fileError && (
              <div className="message-composer-callout">
                <Callout
                  variant="error"
                  layout="minimal"
                  size="sm"
                >
                  {fileError}
                </Callout>
              </div>
            )}
            {inReplyTo && mapSenderToUser && setInReplyTo && (
              <div
                onClick={() => setInReplyTo(undefined)}
                className="message-composer-reply-bar"
              >
                <span className="message-composer-reply-text">
                  {i18n._('Replying to {user}', {
                    user: mapSenderToUser(inReplyTo.content.senderId)
                      .displayName,
                  })}
                </span>
                <Icon
                  name="close"
                  size="sm"
                  className="message-composer-reply-close"
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
                  key={option.type === 'user' ? option.data.address : option.data.roleId}
                  className={`message-composer-mention-item ${
                    index === mentionInput.selectedIndex ? 'selected' : ''
                  } ${
                    index === 0 ? 'first' : ''
                  } ${
                    index === mentionInput.filteredOptions.length - 1 ? 'last' : ''
                  } ${option.type === 'role' ? 'role-item' : 'user-item'}`}
                  onClick={() => mentionInput.selectOption(option)}
                >
                  {option.type === 'user' ? (
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
                  ) : (
                    <>
                      <div
                        className="message-composer-role-badge"
                        style={{ backgroundColor: option.data.color }}
                      >
                        <Icon name="users" size="xs" />
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
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message input row */}
        <FlexRow
          ref={composerRef}
          className={`message-composer-row ${inReplyTo ? 'has-reply' : ''} ${isTyping ? 'typing' : ''}`}
        >
          <Tooltip id="attach-image" content={t`attach image`} place="top" showOnTouch={false}>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                type="unstyled"
                onClick={() => {}} // onClick handled by dropzone
                className="message-composer-upload-btn"
                iconName="plus"
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
            onClick={onSubmitMessage}
            className="message-composer-send-btn"
          />
        </FlexRow>
      </div>
    );
  }
);

export { MessageComposer as default };
