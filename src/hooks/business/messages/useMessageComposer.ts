import { useState, useRef, useCallback, useEffect } from 'react';
import { FileWithPath, useDropzone } from 'react-dropzone';
import Compressor from 'compressorjs';
import {
  Message as MessageType,
  EmbedMessage,
  StickerMessage,
} from '../../../api/quorumApi';
import { t } from '@lingui/core/macro';

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

  // Image compression
  const compressImage = async (
    file: FileWithPath,
    acceptedFiles: FileWithPath[]
  ) => {
    return new Promise<File>((resolve, reject) => {
      if (acceptedFiles[0].type === 'image/gif') {
        resolve(acceptedFiles[0] as File);
      } else {
        new Compressor(file, {
          quality: 0.8,
          convertSize: Infinity,
          retainExif: false,
          mimeType: file.type,
          success(result: Blob) {
            const newFile = new File([result], acceptedFiles[0].name, {
              type: result.type,
            });
            resolve(newFile);
          },
          error(err) {
            reject(err);
          },
        });
      }
    });
  };

  // File dropzone
  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    },
    minSize: 0,
    maxSize: 2 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setFileError(t`File cannot be larger than 2MB`);
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
        const file = await compressImage(acceptedFiles[0], [...acceptedFiles]);
        setFileData(await file.arrayBuffer());
        setFileType(file.type);
      })();
    }
  }, [acceptedFiles]);

  // Calculate textarea rows
  const calculateRows = useCallback(() => {
    const rowCount = pendingMessage.split('').filter((c) => c === '\n').length + 1;

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
    if (!(pendingMessage || fileData)) return;

    // Snapshot current values and clear UI immediately to avoid any locking
    const text = pendingMessage;
    const buf = fileData;
    const mime = fileType;
    const replyId = inReplyTo?.messageId;

    setPendingMessage('');
    setFileData(undefined);
    setFileType(undefined);
    setInReplyTo(undefined);

    // Fire-and-forget sends to keep the UI responsive
    if (text) {
      void onSubmitMessage(text, replyId);
    }
    if (buf) {
      const embedMessage: EmbedMessage = {
        type: 'embed',
        imageUrl: `data:${mime};base64,${Buffer.from(buf).toString('base64')}`,
      } as EmbedMessage;
      void onSubmitMessage(embedMessage, replyId);
    }
  }, [pendingMessage, fileData, fileType, onSubmitMessage, inReplyTo]);

  // Submit sticker
  const submitSticker = useCallback(async (stickerId: string) => {
    if (!onSubmitSticker) return;
    const replyId = inReplyTo?.messageId;
    setInReplyTo(undefined);
    setShowStickers(false);
    void onSubmitSticker(stickerId, replyId);
  }, [onSubmitSticker, inReplyTo]);

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
