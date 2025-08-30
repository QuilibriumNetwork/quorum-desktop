import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea } from '../primitives';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { Buffer } from 'buffer';

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
  fileData?: ArrayBuffer;
  fileType?: string;
  clearFile: () => void;

  // Actions
  onSubmitMessage: () => void;
  onShowStickers: () => void;
  hasStickers?: boolean;

  // Reply-to and error handling
  inReplyTo?: any;
  fileError?: string | null;
  mapSenderToUser?: (senderId: string) => { displayName?: string };
  setInReplyTo?: (inReplyTo: any) => void;
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
      fileData,
      fileType,
      clearFile,
      onSubmitMessage,
      onShowStickers,
      hasStickers = true,
      inReplyTo,
      fileError,
      mapSenderToUser,
      setInReplyTo,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));


    return (
      <div className="w-full pr-6 lg:pr-8">
        {/* Error and reply-to display */}
        {(fileError || inReplyTo) && (
          <div className="flex flex-col w-full ml-[11px] mt-2 mb-0">
            {fileError && (
              <div
                className="text-sm ml-1 mt-3 mb-1"
                style={{ color: 'var(--color-text-danger)' }}
              >
                {fileError}
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
        {fileData && (
          <div className="mx-3 mt-2">
            <div className="p-2 relative rounded-lg bg-surface-3 inline-block">
              <Button
                className="absolute p-1 px-2 m-1 bg-surface-7 rounded-full"
                type="subtle"
                size="small"
                onClick={clearFile}
              >
                <Icon name="x" size="xs" />
              </Button>
              <img
                style={{ maxWidth: 140, maxHeight: 140 }}
                src={
                  'data:' +
                  fileType +
                  ';base64,' +
                  Buffer.from(fileData).toString('base64')
                }
                alt="File preview"
              />
            </div>
          </div>
        )}

        {/* Message input row */}
        <FlexRow
          className={`w-full items-center gap-2 ml-[11px] my-2 p-[6px] rounded-lg ${inReplyTo ? 'rounded-t-none mt-0' : ''}`}
          style={{ background: 'var(--color-bg-chat-input)' }}
        >
          <Tooltip id="attach-image" content={t`attach image`} place="top">
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                type="unstyled"
                onClick={() => {}} // onClick handled by dropzone
                className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
                iconName="plus"
                iconOnly
              />
            </div>
          </Tooltip>

          <TextArea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
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
            }}
          />

          {hasStickers && (
            <Tooltip id="add-sticker" content={t`add sticker`} place="top">
              <Button
                type="unstyled"
                className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
                onClick={onShowStickers}
                iconName="smile"
                iconOnly
              />
            </Tooltip>
          )}

          <div
            className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
            onClick={onSubmitMessage}
          />
        </FlexRow>
      </div>
    );
  }
);

export { MessageComposer as default };
