import React from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUploadWebProps, FileUploadFile } from './types';
import { t } from '@lingui/core/macro';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return t`0 Bytes`;
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

  if (i === 0) return t`${size} Bytes`;
  if (i === 1) return t`${size} KB`;
  if (i === 2) return t`${size} MB`;
  if (i === 3) return t`${size} GB`;
  return t`${size} TB`;
};

/**
 * Web FileUpload component using react-dropzone
 * Maintains existing API compatibility with zero changes required
 */
export const FileUpload: React.FC<FileUploadWebProps> = ({
  onFilesSelected,
  accept,
  multiple = false,
  maxSize,
  minSize,
  disabled = false,
  onError,
  onDragActiveChange,
  validator,
  children,
  testId,
}) => {
  const handleDrop = async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle validation errors
    if (rejectedFiles.length > 0 && onError) {
      const firstRejection = rejectedFiles[0];
      const originalError = firstRejection.errors?.[0]?.message || '';
      const errorCode = firstRejection.errors?.[0]?.code || '';

      let errorMessage = '';

      // Translate common error messages using Lingui
      if (
        errorCode === 'file-too-large' ||
        originalError.includes('larger than')
      ) {
        const maxSizeMB = formatFileSize(maxSize || 0);
        errorMessage = t`File size too large. Maximum size: ${maxSizeMB}`;
      } else if (
        errorCode === 'file-too-small' ||
        originalError.includes('smaller than')
      ) {
        const minSizeMB = formatFileSize(minSize || 0);
        errorMessage = t`File size too small. Minimum size: ${minSizeMB}`;
      } else if (
        errorCode === 'file-invalid-type' ||
        originalError.includes('type')
      ) {
        errorMessage = t`Invalid file type. Please check accepted file formats.`;
      } else if (errorCode === 'too-many-files') {
        errorMessage = t`Too many files selected. Please select fewer files.`;
      } else if (errorCode === 'custom-validation-error') {
        errorMessage = originalError; // Custom validation errors are already handled by user
      } else {
        errorMessage = t`File validation failed. Please try again.`;
      }

      onError(new Error(errorMessage));
    }

    // Convert File objects to FileUploadFile interface with proper data handling
    const convertedFiles: FileUploadFile[] = await Promise.all(
      acceptedFiles.map(async (file) => {
        // Read file as ArrayBuffer for permanent storage
        const arrayBuffer = await file.arrayBuffer();

        // Create data URL for preview (permanent, not a blob URL)
        const dataUrl = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`;

        return {
          uri: dataUrl, // Use data URL instead of blob URL
          name: file.name,
          size: file.size,
          type: file.type,
          file: file, // Include original File object
          data: arrayBuffer, // Include ArrayBuffer for easy processing
        };
      })
    );

    if (convertedFiles.length > 0) {
      onFilesSelected(convertedFiles);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    onDrop: handleDrop,
    multiple,
    maxSize,
    minSize,
    disabled,
    noClick: false,
    noKeyboard: false,
    noDrag: false,
    noDragEventsBubbling: false,
    preventDropOnDocument: true,
    validator: validator
      ? (file: File) => {
          const result = validator(file);
          return result
            ? { code: 'custom-validation-error', message: result }
            : null;
        }
      : undefined,
  });

  // Notify parent of drag state changes
  React.useEffect(() => {
    if (onDragActiveChange) {
      onDragActiveChange(isDragActive);
    }
  }, [isDragActive, onDragActiveChange]);

  return (
    <div {...getRootProps()} data-testid={testId}>
      <input {...getInputProps()} />
      {children}
    </div>
  );
};
