import { useState, useRef, useCallback, useEffect } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import type {
  Message as MessageType,
  EmbedMessage,
  StickerMessage,
} from '@quilibrium/quorum-shared';
import { t } from '@lingui/core/macro';
import { processAttachmentImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import type { AttachmentProcessingResult } from '../../../utils/imageProcessing';
import { extractMentionsFromText, MAX_MENTIONS_PER_MESSAGE, SimpleRateLimiter, RATE_LIMITS, extractStandaloneYouTubeVideoIds, fetchYouTubeThumbnailAsBase64 } from '@quilibrium/quorum-shared';
import { useMessageValidation, getMessageCounterText } from '../validation';
import { showWarning } from '../../../utils/toast';

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

  // Rate limiter ref (persists across renders)
  const rateLimiter = useRef(
    new SimpleRateLimiter(RATE_LIMITS.UI.maxMessages, RATE_LIMITS.UI.windowMs)
  );

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
      // Block send while image is still being processed
      if (isProcessingImage) return;

      // Validate mentions before submission
      if (pendingMessage && !validateMentions(pendingMessage)) {
        return; // Block submission if mentions are invalid
      }

      // Validate message length before submission
      if (pendingMessage && messageValidation.isOverLimit) {
        return; // Block submission if message is too long
      }

      // Rate limit validation
      const rateCheck = rateLimiter.current.canSend();
      if (!rateCheck.allowed) {
        showWarning(t`You're sending messages too quickly. Please wait a moment.`);
        return; // Block submission if rate limited
      }

      setIsSubmitting(true);
      try {
        if (pendingMessage && processedImage) {
          // --- Combined: text + image → single PostMessage ---
          const key = crypto.randomUUID();

          // Encode full image
          const fullBuffer = await processedImage.full.file.arrayBuffer();
          const fullData = Buffer.from(fullBuffer).toString('base64');

          // Build media entries: thumbnail first, then full image
          const mediaEntries: Array<{ type: string; key: string; data: string; mimeType: string }> = [];
          if (processedImage.thumbnail) {
            const thumbBuffer = await processedImage.thumbnail.file.arrayBuffer();
            const thumbData = Buffer.from(thumbBuffer).toString('base64');
            mediaEntries.push({
              type: 'image-thumbnail',
              key,
              data: thumbData,
              mimeType: processedImage.thumbnail.file.type,
            });
          }
          mediaEntries.push({
            type: 'image',
            key,
            data: fullData,
            mimeType: processedImage.full.file.type,
          });

          // Also fetch YouTube thumbnails if text has standalone YouTube URLs
          const videoIds = extractStandaloneYouTubeVideoIds(pendingMessage);
          if (videoIds.length > 0) {
            const results = await Promise.all(
              videoIds.map(async (videoId) => {
                const data = await fetchYouTubeThumbnailAsBase64(videoId);
                if (!data) return null;
                return {
                  type: 'youtube-thumbnail',
                  key: videoId,
                  data,
                  mimeType: 'image/jpeg',
                };
              })
            );
            const youtubeEntries = results.filter(
              (r): r is NonNullable<typeof r> => r !== null
            );
            mediaEntries.push(...youtubeEntries);
          }

          await onSubmitMessage(
            { type: 'post' as const, text: pendingMessage, embeddedMedia: mediaEntries },
            inReplyTo?.messageId
          );
        } else if (pendingMessage) {
          // --- Text only ---
          const videoIds = extractStandaloneYouTubeVideoIds(pendingMessage);
          if (videoIds.length > 0) {
            const results = await Promise.all(
              videoIds.map(async (videoId) => {
                const data = await fetchYouTubeThumbnailAsBase64(videoId);
                if (!data) return null;
                return {
                  type: 'youtube-thumbnail',
                  key: videoId,
                  data,
                  mimeType: 'image/jpeg',
                };
              })
            );
            const embeddedMedia = results.filter(
              (r): r is NonNullable<typeof r> => r !== null
            );
            if (embeddedMedia.length > 0) {
              await onSubmitMessage(
                { type: 'post' as const, text: pendingMessage, embeddedMedia },
                inReplyTo?.messageId
              );
            } else {
              await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
            }
          } else {
            await onSubmitMessage(pendingMessage, inReplyTo?.messageId);
          }
        } else if (processedImage) {
          // --- Image only (EmbedMessage path) ---
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
    isProcessingImage,
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
