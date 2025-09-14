// Platform-specific FileUpload component resolution
// Bundlers will resolve to the appropriate platform file automatically

// @ts-ignore - Platform-specific files (.web.tsx/.native.tsx) resolved by bundler
export { FileUpload } from './FileUpload';
export type { FileUploadProps, FileUploadFile } from './types';
