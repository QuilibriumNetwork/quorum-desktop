import { useState, useRef, useCallback, useEffect } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import {
  Message as MessageType,
  EmbedMessage,
  StickerMessage,
} from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';
import { processAttachmentImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import type { AttachmentProcessingResult } from '../../../utils/imageProcessing';
import { extractMentionsFromText, MAX_MENTIONS_PER_MESSAGE } from '../../../utils/mentionUtils';
import { useMessageValidation, getMessageCounterText } from '../validation';

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
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Mention validation state
  const [mentionError, setMentionError] = useState<string | null>(null);

  // Message validation state
  const messageValidation = useMessageValidation(pendingMessage);

  // Ref for textarea
  const editor = useRef<HTMLTextAreaElement>(null);

  // Clear mention error when message changes
  useEffect(() => {
    if (mentionError) {
      setMentionError(null);
    }
  }, [pendingMessage]); // Clear error when user types

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
          setIsProcessingImage(true);
          setFileError(null); // Clear any previous errors
          const file = acceptedFiles[0];

          const result = await processImage(file);
          setProcessedImage(result);
        } catch (error) {
          console.error('Error processing image:', error);
          setFileError(error instanceof Error ? error.message : 'Unable to process image. Please use a smaller image.');
        } finally {
          setIsProcessingImage(false);
        }
      })();
    }
  }, [acceptedFiles]);

  // Simple row calculation - let CSS handle the auto-resize
  const calculateRows = useCallback(() => {
    // Return 1 for empty, otherwise return a default value
    return pendingMessage === '' ? 1 : 3;
  }, [pendingMessage]);

  // Validate mentions count
  const validateMentions = useCallback((text: string): boolean => {
    if (!text.trim()) return true; // Empty messages are fine

    try {
      // Extract mentions to count them (syntax-only counting for rate limiting)
      const mentions = extractMentionsFromText(text, {
        allowEveryone: true, // Allow counting @everyone syntax
      });

      // Use the total mention count for proper rate limiting validation
      const totalMentions = mentions.totalMentionCount || 0;

      if (totalMentions > MAX_MENTIONS_PER_MESSAGE) {
        setMentionError(t`Too many mentions in message. Maximum ${MAX_MENTIONS_PER_MESSAGE} allowed.`);
        return false;
      }

      // Clear any existing mention error
      setMentionError(null);
      return true;
    } catch (error) {
      // If extraction fails, allow the message (don't block on validation errors)
      setMentionError(null);
      return true;
    }
  }, []);

  // Submit message
  const submitMessage = useCallback(async () => {
    if ((pendingMessage || processedImage) && !isSubmitting) {
      // Validate mentions before submission
      if (pendingMessage && !validateMentions(pendingMessage)) {
        return; // Block submission if mentions are invalid
      }

      // Validate message length before submission
      if (pendingMessage && messageValidation.isOverLimit) {
        return; // Block submission if message is too long
      }

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
    validateMentions,
    messageValidation.isOverLimit,
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
    isProcessingImage,
    clearFile,

    // Mention validation state
    mentionError,

    // Message validation state
    messageValidation,
    characterCount: getMessageCounterText(messageValidation.messageLength),

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
