import { useState, useRef, useCallback, useEffect } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import {
  Message as MessageType,
  EmbedMessage,
  StickerMessage,
} from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { processAttachmentImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import type { AttachmentProcessingResult } from '../../../utils/imageProcessing/processors/attachmentProcessor';

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
  const [processedImage, setProcessedImage] = useState<AttachmentProcessingResult | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);

  // Ref for textarea
  const editor = useRef<HTMLTextAreaElement>(null);

  // Image processing using standardized processor with thumbnail support
  const processImage = async (file: FileWithPath): Promise<AttachmentProcessingResult> => {
    try {
      const result = await processAttachmentImage(file);
      return result;
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          setFileError(t`File cannot be larger than 50MB`);
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
          const file = acceptedFiles[0];

          const result = await processImage(file);
          setProcessedImage(result);
          setFileError(null); // Clear any previous errors
        } catch (error) {
          console.error('Error processing image:', error);
          setFileError(error instanceof Error ? error.message : 'Unable to process image. Please use a smaller image.');
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
    if ((pendingMessage || processedImage) && !isSubmitting) {
      setIsSubmitting(true);
      try {
        if (pendingMessage) {
          await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
        }
        if (processedImage) {
          // Create base64 URLs for both thumbnail and full image
          const fullImageBuffer = await processedImage.full.file.arrayBuffer();
          const fullImageUrl = `data:${processedImage.full.file.type};base64,${Buffer.from(fullImageBuffer).toString('base64')}`;

          let thumbnailUrl: string | undefined;
          if (processedImage.thumbnail) {
            const thumbnailBuffer = await processedImage.thumbnail.file.arrayBuffer();
            thumbnailUrl = `data:${processedImage.thumbnail.file.type};base64,${Buffer.from(thumbnailBuffer).toString('base64')}`;
          }

          const embedMessage: EmbedMessage = {
            type: 'embed',
            imageUrl: fullImageUrl,
            thumbnailUrl,
            isLargeGif: processedImage.isLargeGif,
          } as EmbedMessage;
          await onSubmitMessage(embedMessage, inReplyTo?.messageId);
        }
        // Clear state after successful submission
        setPendingMessage('');
        setProcessedImage(undefined);
        setInReplyTo(undefined);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [
    pendingMessage,
    processedImage,
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
    setProcessedImage(undefined);
  }, []);

  return {
    // Message state
    pendingMessage,
    setPendingMessage,
    isSubmitting,
    inReplyTo,
    setInReplyTo,

    // File state
    processedImage,
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
