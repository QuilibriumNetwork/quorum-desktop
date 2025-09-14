// Platform-specific exports - bundler will resolve automatically
// Web: Text.web.tsx, Native: Text.native.tsx
// @ts-ignore - Platform-specific files (.web.tsx/.native.tsx) resolved by bundler
export { Text } from './Text';
export { Paragraph, Label, Caption, Title, InlineText } from './TextHelpers';
export type { TextProps, WebTextProps, NativeTextProps } from './types';
