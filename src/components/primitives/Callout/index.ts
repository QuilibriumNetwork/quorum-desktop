// Cross-platform Callout primitive exports
// Let bundler resolve: Callout.web.tsx for web, Callout.native.tsx for React Native
// @ts-ignore - Platform-specific files (.web.tsx/.native.tsx) resolved by bundler
export { default } from './Callout';
export type { CalloutProps, CalloutVariant, CalloutSize, CalloutLayout } from './types';