import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Button, FlexRow, Tooltip, Icon, TextArea } from '../primitives';
import { t } from '@lingui/core/macro';
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
  
  // State
  inReplyTo?: any;
}

export interface MessageComposerRef {
  focus: () => void;
}

export const MessageComposer = forwardRef<MessageComposerRef, MessageComposerProps>(({
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
  inReplyTo,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  return (
    <div className="message-editor-container pr-6 lg:pr-8">

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
        className={
          'message-editor w-full items-center gap-2 ' +
          (inReplyTo ? 'message-editor-reply' : '')
        }
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
            // Override any default styling  
            border: 'none',
            boxShadow: 'none',
            backgroundColor: 'transparent',
            minHeight: '28px',
            maxHeight: '112px',
            height: value ? 'auto' : '28px',
          }}
        />
        
        <Tooltip id="add-sticker" content={t`add sticker`} place="top">
          <Button
            type="unstyled"
            className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
            onClick={onShowStickers}
            iconName="smile"
            iconOnly
          />
        </Tooltip>
        
        <div
          className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
          onClick={onSubmitMessage}
        />
      </FlexRow>
    </div>
  );
});


export { MessageComposer as default };