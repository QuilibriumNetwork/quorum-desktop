// Platform-specific exports - bundler will resolve automatically
// Web: Text.web.tsx, Native: Text.native.tsx
export { Text } from './Text';
export { Paragraph, Label, Caption, Title, InlineText } from './TextHelpers';
export type { TextProps, WebTextProps, NativeTextProps } from './types';
