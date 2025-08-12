import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
// @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
import { TextInput } from 'react-native';
import { useTheme } from '../primitives/theme';

interface MessageTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  style?: any;
}

export const MessageTextInput = forwardRef<TextInput, MessageTextInputProps>(
  ({ value, onChange, onFocus, onBlur, placeholder, minRows = 1, maxRows = 5, style }, ref) => {
    const theme = useTheme();
    const [height, setHeight] = useState(32); // Start with compact single-line height
    const [isFocused, setIsFocused] = useState(false);
    const textInputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => textInputRef.current!);

    const handleContentSizeChange = (event: any) => {
      const { height: contentHeight } = event.nativeEvent.contentSize;
      const lineHeight = 18;
      const basePadding = 12; // 6px top + 6px bottom - compact
      
      // Calculate number of lines
      const lines = Math.max(minRows, Math.ceil((contentHeight) / lineHeight));
      const constrainedLines = Math.min(lines, maxRows);
      
      // Calculate height: base padding + (lines * line height)
      const newHeight = basePadding + (constrainedLines * lineHeight);
      setHeight(Math.max(32, newHeight)); // Minimum 32px height
    };

    return (
      <TextInput
        ref={textInputRef}
        value={value}
        onChangeText={onChange}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.field.placeholder}
        onContentSizeChange={handleContentSizeChange}
        multiline={true}
        scrollEnabled={false} // Disable scroll, let it grow
        textAlignVertical="center" // Center text vertically
        numberOfLines={minRows} // Start as single line
        style={[
          {
            height,
            paddingVertical: 6,
            paddingHorizontal: 8,
            fontSize: 15,
            color: theme.colors.field.text,
            backgroundColor: theme.colors.surface[0],
            borderWidth: 1,
            borderColor: isFocused ? theme.colors.field.borderFocus : 'transparent',
            borderRadius: 8,
            textAlignVertical: (value && value.includes('\n')) ? 'top' : 'center', // Center for single line, top for multiline
            includeFontPadding: false, // Remove extra font padding on Android
          },
          style,
        ]}
      />
    );
  }
);