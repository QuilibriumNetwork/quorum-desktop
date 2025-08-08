// Platform resolution file - bundlers will use this to resolve the correct implementation
// This file enables the index.ts import to work with platform-specific bundler resolution

// For React Native (Metro bundler will resolve to .native.tsx)
export { FileUpload } from './FileUpload.native';

// For Web (Vite will resolve to .web.tsx) 
// This is handled by the bundler's platform extensions configuration