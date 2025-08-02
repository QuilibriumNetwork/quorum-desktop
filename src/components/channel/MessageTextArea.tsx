import React, { useRef } from 'react';

interface MessageTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  calculateRows: () => number;
}

export const MessageTextArea: React.FC<MessageTextAreaProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  calculateRows,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={textareaRef}
      className="flex-1 bg-transparent border-0 outline-0 py-1 resize-none placeholder:text-ellipsis placeholder:overflow-hidden placeholder:whitespace-nowrap text-main"
      style={{
        // Override any default styling
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
        minHeight: '28px', // Single line height
        maxHeight: '112px', // 4 lines max
        height: value ? undefined : '28px', // Force single line when empty
      }}
      placeholder={placeholder}
      rows={value ? calculateRows() : 1}
      value={value}
      onChange={handleChange}
      onKeyDown={onKeyDown}
    />
  );
};