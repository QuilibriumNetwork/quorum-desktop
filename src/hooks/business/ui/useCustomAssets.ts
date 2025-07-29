import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { t } from '@lingui/core/macro';
import { Emoji, Sticker } from '../../../api/quorumApi';

export interface UseCustomAssetsOptions {
  initialEmojis?: Emoji[];
  initialStickers?: Sticker[];
  onEmojiFileError?: (error: string | null) => void;
  onStickerFileError?: (error: string | null) => void;
}

export interface UseCustomAssetsReturn {
  // Emoji management
  emojis: Emoji[];
  setEmojis: (emojis: Emoji[]) => void;
  currentEmojiFiles: File[] | undefined;
  emojiFileError: string | null;
  getEmojiRootProps: () => any;
  getEmojiInputProps: () => any;
  clearEmojiFileError: () => void;
  removeEmoji: (index: number) => void;
  canAddMoreEmojis: boolean;
  
  // Sticker management
  stickers: Sticker[];
  setStickers: (stickers: Sticker[]) => void;
  currentStickerFiles: File[] | undefined;
  stickerFileError: string | null;
  getStickerRootProps: () => any;
  getStickerInputProps: () => any;
  clearStickerFileError: () => void;
  removeSticker: (index: number) => void;
  canAddMoreStickers: boolean;
}

export const useCustomAssets = (
  options: UseCustomAssetsOptions = {}
): UseCustomAssetsReturn => {
  const { 
    initialEmojis = [], 
    initialStickers = [], 
    onEmojiFileError, 
    onStickerFileError 
  } = options;

  // State
  const [emojis, setEmojis] = useState<Emoji[]>(initialEmojis);
  const [stickers, setStickers] = useState<Sticker[]>(initialStickers);

  // Update emojis and stickers when initialData changes (e.g., when space data loads)
  useEffect(() => {
    setEmojis(initialEmojis);
  }, [initialEmojis]);

  useEffect(() => {
    setStickers(initialStickers);
  }, [initialStickers]);
  const [currentEmojiFiles, setCurrentEmojiFiles] = useState<File[] | undefined>();
  const [currentStickerFiles, setCurrentStickerFiles] = useState<File[] | undefined>();
  const [emojiFileError, setEmojiFileError] = useState<string | null>(null);
  const [stickerFileError, setStickerFileError] = useState<string | null>(null);

  const canAddMoreEmojis = emojis.length < 50;
  const canAddMoreStickers = stickers.length < 50;

  // Emoji dropzone
  const {
    getRootProps: getEmojiRootProps,
    getInputProps: getEmojiInputProps,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    multiple: true,
    maxFiles: Math.min(10, 50 - emojis.length),
    minSize: 0,
    maxSize: 256 * 1024,
    disabled: emojis.length >= 50,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          const error = t`File cannot be larger than 256KB`;
          setEmojiFileError(error);
          onEmojiFileError?.(error);
        } else if (rejection.errors.some((err) => err.code === 'too-many-files')) {
          const remaining = 50 - emojis.length;
          const error = t`Cannot upload more than ${Math.min(10, remaining)} files at once (${remaining} slots remaining)`;
          setEmojiFileError(error);
          onEmojiFileError?.(error);
        } else {
          const error = t`File rejected`;
          setEmojiFileError(error);
          onEmojiFileError?.(error);
        }
      }
    },
    onDropAccepted: (files) => {
      setEmojiFileError(null);
      onEmojiFileError?.(null);
      // Double-check we don't exceed the limit
      const allowedFiles = files.slice(0, 50 - emojis.length);
      setCurrentEmojiFiles(allowedFiles);
    },
  });

  // Sticker dropzone
  const {
    getRootProps: getStickerRootProps,
    getInputProps: getStickerInputProps,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    multiple: true,
    maxFiles: Math.min(10, 50 - stickers.length),
    minSize: 0,
    maxSize: 256 * 1024,
    disabled: stickers.length >= 50,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          const error = t`File cannot be larger than 256KB`;
          setStickerFileError(error);
          onStickerFileError?.(error);
        } else if (rejection.errors.some((err) => err.code === 'too-many-files')) {
          const remaining = 50 - stickers.length;
          const error = t`Cannot upload more than ${Math.min(10, remaining)} files at once (${remaining} slots remaining)`;
          setStickerFileError(error);
          onStickerFileError?.(error);
        } else {
          const error = t`File rejected`;
          setStickerFileError(error);
          onStickerFileError?.(error);
        }
      }
    },
    onDropAccepted: (files) => {
      setStickerFileError(null);
      onStickerFileError?.(null);
      // Double-check we don't exceed the limit
      const allowedFiles = files.slice(0, 50 - stickers.length);
      setCurrentStickerFiles(allowedFiles);
    },
  });

  // Process emoji files
  useEffect(() => {
    if (currentEmojiFiles && currentEmojiFiles.length > 0) {
      (async () => {
        const newEmojis = await Promise.all(
          currentEmojiFiles.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return {
              id: crypto.randomUUID(),
              name: file.name
                .split('.')[0]
                .toLowerCase()
                .replace(/[^a-z0-9\-]/gi, ''),
              imgUrl:
                'data:' +
                file.type +
                ';base64,' +
                Buffer.from(arrayBuffer).toString('base64'),
            };
          })
        );
        setEmojis((prev) => [...prev, ...newEmojis]);
        setCurrentEmojiFiles(undefined); // Clear after processing
      })();
    }
  }, [currentEmojiFiles]);

  // Process sticker files
  useEffect(() => {
    if (currentStickerFiles && currentStickerFiles.length > 0) {
      (async () => {
        const newStickers = await Promise.all(
          currentStickerFiles.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer();
            return {
              id: crypto.randomUUID(),
              name: file.name
                .split('.')[0]
                .toLowerCase()
                .replace(/[^a-z0-9\-]/gi, ''),
              imgUrl:
                'data:' +
                file.type +
                ';base64,' +
                Buffer.from(arrayBuffer).toString('base64'),
            };
          })
        );
        setStickers((prev) => [...prev, ...newStickers]);
        setCurrentStickerFiles(undefined); // Clear after processing
      })();
    }
  }, [currentStickerFiles]);

  // Helper functions
  const removeEmoji = (index: number) => {
    setEmojis(prev => prev.filter((_, i) => i !== index));
  };

  const removeSticker = (index: number) => {
    setStickers(prev => prev.filter((_, i) => i !== index));
  };

  const clearEmojiFileError = () => {
    setEmojiFileError(null);
    onEmojiFileError?.(null);
  };

  const clearStickerFileError = () => {
    setStickerFileError(null);
    onStickerFileError?.(null);
  };

  return {
    emojis,
    setEmojis,
    currentEmojiFiles,
    emojiFileError,
    getEmojiRootProps,
    getEmojiInputProps,
    clearEmojiFileError,
    removeEmoji,
    canAddMoreEmojis,
    
    stickers,
    setStickers,
    currentStickerFiles,
    stickerFileError,
    getStickerRootProps,
    getStickerInputProps,
    clearStickerFileError,
    removeSticker,
    canAddMoreStickers,
  };
};