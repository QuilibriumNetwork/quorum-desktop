import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea, Callout } from '../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { Buffer } from 'buffer';
import type { AttachmentProcessingResult } from '../../utils/imageProcessing';
import { useMentionInput } from '../../hooks/business/mentions';
import { truncateAddress } from '../../utils';
import { DefaultImages } from '../../utils';

interface User {
  address: string;
  displayName?: string;
  userIcon?: string;
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
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // Handle mention selection
    const handleMentionSelect = useCallback(
      (user: User, mentionStart: number, mentionEnd: number) => {
        const newValue =
          value.substring(0, mentionStart) +
          `@<${user.address}>` +
          value.substring(mentionEnd);
        onChange(newValue);
        // Set cursor position after the mention
        setTimeout(() => {
          const newPosition = mentionStart + user.address.length + 3; // +3 for @<>
          textareaRef.current?.setSelectionRange(newPosition, newPosition);
          textareaRef.current?.focus();
        }, 0);
      },
      [value, onChange]
    );

    // Use mention input hook
    const mentionInput = useMentionInput({
      textValue: value,
      cursorPosition,
      users,
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

    // If disabled, show a message instead of the composer
    if (disabled) {
      return (
        <div className="w-full pr-6 lg:pr-8">
          <div className="w-full items-center gap-2 ml-[11px] my-2 py-2 pl-4 pr-[6px] rounded-lg flex justify-start bg-chat-input">
            <Icon name="lock" size="xs" className="text-muted flex-shrink-0" />
            <span
              className="text-base font-normal"
              style={{ color: 'var(--color-field-placeholder)' }}
            >
              {disabledMessage || t`You cannot post in this channel`}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full pr-6 lg:pr-8">
        {/* Error, processing indicator, and reply-to display */}
        {(fileError || inReplyTo || isProcessingImage) && (
          <div className="flex flex-col w-full ml-[11px] mt-2 mb-0">
            {isProcessingImage && (
              <div className="ml-1 mt-3 mb-1">
                <Callout
                  variant="warning"
                  layout="minimal"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Icon name="spinner" size="xs" spin={true} />
                  {t`Processing image... This may take a moment for large files.`}
                </Callout>
              </div>
            )}
            {fileError && (
              <div className="ml-1 mt-3 mb-1">
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
                className="rounded-t-lg px-4 cursor-pointer py-1 text-xs flex flex-row justify-between items-center bg-surface-4"
              >
                <span className="text-subtle">
                  {i18n._('Replying to {user}', {
                    user: mapSenderToUser(inReplyTo.content.senderId)
                      .displayName,
                  })}
                </span>
                <Icon
                  name="times"
                  size="sm"
                  className="cursor-pointer hover:opacity-70"
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
          <div className="mx-3 mt-2">
            <div className="p-2 relative rounded-lg bg-surface-3 inline-block">
              <Button
                className="absolute top-1 right-1 w-6 h-6 p-0 bg-surface-7 hover:bg-surface-8 rounded-full z-10 shadow-sm flex items-center justify-center"
                type="subtle"
                size="small"
                onClick={clearFile}
              >
                <Icon name="times" size="sm" />
              </Button>
              <div className="relative">
                <img
                  style={{ maxWidth: 140, maxHeight: 140 }}
                  src={
                    processedImage.thumbnail
                      ? URL.createObjectURL(processedImage.thumbnail.file)
                      : URL.createObjectURL(processedImage.full.file)
                  }
                  alt="File preview"
                />
                {processedImage.isLargeGif && processedImage.thumbnail && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 rounded-full p-1">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
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
        {dropdownOpen && mentionInput.filteredUsers.length > 0 && (
          <div className="ml-[11px] mb-2 w-[250px] sm:w-[300px]">
            <div className="bg-surface-0 border border-default rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {mentionInput.filteredUsers.map((user, index) => (
                <div
                  key={user.address}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-2 ${
                    index === mentionInput.selectedIndex ? 'bg-surface-3' : ''
                  } ${
                    index === 0 ? 'rounded-t-lg' : ''
                  } ${
                    index === mentionInput.filteredUsers.length - 1 ? 'rounded-b-lg' : ''
                  }`}
                  onClick={() => mentionInput.selectUser(user)}
                >
                  <div
                    className="w-8 h-8 rounded-full bg-cover bg-center flex-shrink-0"
                    style={{
                      backgroundImage: user.userIcon?.includes(DefaultImages.UNKNOWN_USER)
                        ? 'var(--unknown-icon)'
                        : `url(${user.userIcon})`,
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-main truncate">
                      {user.displayName || t`Unknown User`}
                    </span>
                    <span className="text-xs text-subtle truncate">
                      {truncateAddress(user.address)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message input row */}
        <FlexRow
          ref={composerRef}
          className={`w-full items-center gap-2 ml-[11px] my-2 p-[6px] rounded-lg bg-chat-input ${inReplyTo ? 'rounded-t-none mt-0' : ''}`}
        >
          <Tooltip id="attach-image" content={t`attach image`} place="top" showOnTouch={false}>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                type="unstyled"
                onClick={() => {}} // onClick handled by dropzone
                className="w-7 h-7 rounded-full bg-surface-5 hover:bg-surface-6 cursor-pointer flex items-center justify-center flex-shrink-0"
                iconName="plus"
                iconOnly
              />
            </div>
          </Tooltip>

          <TextArea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            placeholder={placeholder}
            autoResize={false}
            rows={value ? calculateRows() : 1}
            variant="filled"
            noFocusStyle={true}
            resize={false}
            className="flex-1 bg-transparent border-0 outline-0 py-1 text-main"
            style={{
              border: 'none',
              boxShadow: 'none',
              backgroundColor: 'transparent',
              minHeight: '28px',
              maxHeight: '112px',
              height: value ? 'auto' : '28px',
              paddingLeft: '4px',
              paddingRight: '4px',
              whiteSpace: value ? 'pre-wrap' : 'nowrap',
              overflow: 'hidden',
            }}
          />

          {hasStickers && (
            <Tooltip id="add-sticker" content={t`add sticker`} place="top" showOnTouch={false}>
              <Button
                type="unstyled"
                className="w-8 h-8 p-0 rounded-md cursor-pointer flex items-center justify-center flex-shrink-0 text-surface-9 hover:text-main"
                onClick={onShowStickers}
                iconName="smile"
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
                className={`w-8 h-8 p-0 rounded-md cursor-pointer flex items-center justify-center flex-shrink-0 -ml-2 ${
                  skipSigning
                    ? 'text-warning'
                    : 'text-surface-9 hover:text-main'
                }`}
                iconName={skipSigning ? 'unlock' : 'lock'}
                iconOnly
              />
            </Tooltip>
          )}

          <Button
            type="unstyled"
            onClick={onSubmitMessage}
            className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
          />
        </FlexRow>
      </div>
    );
  }
);

export { MessageComposer as default };
