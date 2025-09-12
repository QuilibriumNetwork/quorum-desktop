import { ReactNode } from 'react';

// File object interface compatible between platforms
export interface FileUploadFile {
  uri: string; // For display/preview only - should be data URL or temporary URL
  name: string;
  size: number;
  type: string;
  file?: File; // Original File object (web only)
  data?: ArrayBuffer; // File data as ArrayBuffer
}

// Accept object for file type filtering
export interface FileAccept {
  [mimeType: string]: string[];
}

// Base FileUpload component props
export interface FileUploadBaseProps {
  /** Function called when files are selected */
  onFilesSelected: (files: FileUploadFile[]) => void;
  /** MIME types and extensions to accept */
  accept?: FileAccept;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Minimum file size in bytes */
  minSize?: number;
  /** Children content (upload area) */
  children: ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Test ID for testing */
  testId?: string;
}

// Web-specific props (extends base with react-dropzone features)
export interface FileUploadWebProps extends FileUploadBaseProps {
  /** Drag and drop active state callback */
  onDragActiveChange?: (isDragActive: boolean) => void;
  /** Custom validation function */
  validator?: (file: File) => string | null;
}

// Native-specific props (extends base with mobile-specific features)
export interface FileUploadNativeProps extends FileUploadBaseProps {
  /** Show camera option for image uploads */
  showCameraOption?: boolean;
  /** Image quality (0-1) for image uploads */
  imageQuality?: number;
  /** Allow image editing after selection */
  allowsEditing?: boolean;
}

// Union type for platform-specific usage
export type FileUploadProps = FileUploadWebProps | FileUploadNativeProps;
