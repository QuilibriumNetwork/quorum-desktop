import { useState, useRef, useCallback, useEffect } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import {
  Message as MessageType,
  EmbedMessage,
  StickerMessage,
} from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { processAttachmentImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';

interface UseMessageComposerOptions {
  type: 'channel' | 'direct';
  onSubmitMessage: (
    message: string | object,
    inReplyTo?: string
  ) => Promise<void>;
  onSubmitSticker?: (stickerId: string, inReplyTo?: string) => Promise<void>;
  hasStickers?: boolean;
}

export function useMessageComposer(options: UseMessageComposerOptions) {
  const {
    type,
    onSubmitMessage,
    onSubmitSticker,
    hasStickers = false,
  } = options;

  // Message state
  const [pendingMessage, setPendingMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inReplyTo, setInReplyTo] = useState<MessageType>();
  const [showStickers, setShowStickers] = useState(false);

  // File upload state
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [fileType, setFileType] = useState<string>();
  const [fileError, setFileError] = useState<string | null>(null);

  // Ref for textarea
  const editor = useRef<HTMLTextAreaElement>(null);

  // Image compression using standardized processor
  const compressImage = async (file: FileWithPath): Promise<File> => {
    try {
      const result = await processAttachmentImage(file);
      return result.file;
    } catch (error) {
      throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // File dropzone
  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    minSize: 0,
    maxSize: FILE_SIZE_LIMITS.MAX_INPUT_SIZE,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setFileError(t`File cannot be larger than 25MB`);
        } else {
          setFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: () => {
      setFileError(null);
    },
  });

  // Process accepted files
  useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        try {
          const file = await compressImage(acceptedFiles[0]);
          setFileData(await file.arrayBuffer());
          setFileType(file.type);
          setFileError(null); // Clear any previous errors
        } catch (error) {
          console.error('Error compressing image:', error);
          setFileError(error instanceof Error ? error.message : 'Unable to compress image. Please use a smaller image.');
        }
      })();
    }
  }, [acceptedFiles]);

  // Calculate textarea rows
  const calculateRows = useCallback(() => {
    const rowCount =
      pendingMessage.split('').filter((c) => c === '\n').length + 1;

    if (rowCount > 4) return 4;
    if (pendingMessage === '') return 1;

    return Math.min(
      4,
      Math.max(
        rowCount,
        editor.current ? Math.round(editor.current.scrollHeight / 28) : rowCount
      )
    );
  }, [pendingMessage]);

  // Submit message
  const submitMessage = useCallback(async () => {
    if ((pendingMessage || fileData) && !isSubmitting) {
      setIsSubmitting(true);
      try {
        if (pendingMessage) {
          await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
        }
        if (fileData) {
          const embedMessage: EmbedMessage = {
            type: 'embed',
            imageUrl: `data:${fileType};base64,${Buffer.from(fileData).toString('base64')}`,
          } as EmbedMessage;
          await onSubmitMessage(embedMessage, inReplyTo?.messageId);
        }
        // Clear state after successful submission
        setPendingMessage('');
        setFileData(undefined);
        setFileType(undefined);
        setInReplyTo(undefined);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [
    pendingMessage,
    fileData,
    fileType,
    isSubmitting,
    onSubmitMessage,
    inReplyTo,
  ]);

  // Submit sticker
  const submitSticker = useCallback(
    async (stickerId: string) => {
      if (onSubmitSticker && !isSubmitting) {
        setIsSubmitting(true);
        try {
          await onSubmitSticker(stickerId, inReplyTo?.messageId);
          setInReplyTo(undefined);
          setShowStickers(false);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [onSubmitSticker, isSubmitting, inReplyTo]
  );

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    },
    [submitMessage]
  );

  // Clear file
  const clearFile = useCallback(() => {
    setFileData(undefined);
    setFileType(undefined);
  }, []);

  return {
    // Message state
    pendingMessage,
    setPendingMessage,
    isSubmitting,
    inReplyTo,
    setInReplyTo,

    // File state
    fileData,
    fileType,
    fileError,
    clearFile,

    // Sticker state
    showStickers,
    setShowStickers,

    // Functions
    submitMessage,
    submitSticker,
    handleKeyDown,
    calculateRows,

    // Refs and props
    editor,
    getRootProps,
    getInputProps,

    // Config
    hasStickers,
  };
}
