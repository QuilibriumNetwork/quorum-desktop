// Cross-platform Button primitive exports
// Let bundler resolve: Button.web.tsx for web, Button.native.tsx for React Native
// @ts-ignore - Platform-specific files (.web.tsx/.native.tsx) resolved by bundler
export { default } from './Button';
export type { WebButtonProps as ButtonProps } from './types';
