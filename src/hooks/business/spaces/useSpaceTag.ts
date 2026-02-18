import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { t } from '@lingui/core/macro';
import { SpaceTag } from '../../../api/quorumApi';
import { IconColor } from '../../../components/space/IconPicker/types';
import { processEmojiImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';

export interface UseSpaceTagOptions {
  initialTag?: SpaceTag;
}

export interface UseSpaceTagReturn {
  letters: string;
  setLetters: (letters: string) => void;
  backgroundColor: IconColor;
  setBackgroundColor: (color: IconColor) => void;
  tagImageUrl: string;
  tagImageFile: File | undefined;
  tagImageError: string | null;
  isTagImageUploading: boolean;
  isTagImageDragActive: boolean;
  getTagImageRootProps: () => any;
  getTagImageInputProps: () => any;
  clearTagImageError: () => void;
  removeTagImage: () => void;
  buildTag: () => SpaceTag | undefined;
}

export const useSpaceTag = ({
  initialTag,
}: UseSpaceTagOptions = {}): UseSpaceTagReturn => {
  const [letters, setLetters] = useState<string>(initialTag?.letters || '');
  const [backgroundColor, setBackgroundColor] = useState<IconColor>(
    initialTag?.backgroundColor || 'blue'
  );
  const [tagImageUrl, setTagImageUrl] = useState<string>(initialTag?.url || '');
  const [tagImageFile, setTagImageFile] = useState<File | undefined>();
  const [tagImageError, setTagImageError] = useState<string | null>(null);
  const [isTagImageUploading, setIsTagImageUploading] = useState(false);
  const [isTagImageDragActive, setIsTagImageDragActive] = useState(false);

  // Sync with initialTag changes (e.g., when space loads)
  useEffect(() => {
    setLetters(initialTag?.letters || '');
    setBackgroundColor(initialTag?.backgroundColor || 'blue');
    setTagImageUrl(initialTag?.url || '');
    setTagImageFile(undefined);
  }, [initialTag?.letters, initialTag?.backgroundColor, initialTag?.url]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    multiple: false,
    maxFiles: 1,
    minSize: 0,
    maxSize: FILE_SIZE_LIMITS.MAX_EMOJI_INPUT_SIZE,
    onDragEnter: () => setIsTagImageDragActive(true),
    onDragLeave: () => setIsTagImageDragActive(false),
    onDropRejected: (fileRejections) => {
      setIsTagImageDragActive(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setTagImageError(t`File cannot be larger than 5MB`);
        } else {
          setTagImageError(t`File rejected. Use PNG, JPG or GIF.`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsTagImageDragActive(false);
      setTagImageError(null);
      const file = files[0];
      setTagImageFile(file);
      setIsTagImageUploading(true);

      (async () => {
        try {
          const result = await processEmojiImage(file);
          const arrayBuffer = await result.file.arrayBuffer();
          const dataUrl =
            'data:' +
            result.file.type +
            ';base64,' +
            Buffer.from(arrayBuffer).toString('base64');
          setTagImageUrl(dataUrl);
        } catch (err) {
          console.error('Error processing tag image:', err);
          setTagImageError(
            err instanceof Error
              ? err.message
              : t`Unable to process image. Please try a different file.`
          );
          setTagImageFile(undefined);
        } finally {
          setIsTagImageUploading(false);
        }
      })();
    },
  });

  const clearTagImageError = useCallback(() => {
    setTagImageError(null);
  }, []);

  const removeTagImage = useCallback(() => {
    setTagImageUrl('');
    setTagImageFile(undefined);
    setTagImageError(null);
  }, []);

  const buildTag = useCallback((): SpaceTag | undefined => {
    if (!letters || letters.length !== 4) return undefined;
    return {
      letters,
      url: tagImageUrl,
      backgroundColor,
    };
  }, [letters, tagImageUrl, backgroundColor]);

  return {
    letters,
    setLetters,
    backgroundColor,
    setBackgroundColor,
    tagImageUrl,
    tagImageFile,
    tagImageError,
    isTagImageUploading,
    isTagImageDragActive: isDragActive || isTagImageDragActive,
    getTagImageRootProps: getRootProps,
    getTagImageInputProps: getInputProps,
    clearTagImageError,
    removeTagImage,
    buildTag,
  };
};
