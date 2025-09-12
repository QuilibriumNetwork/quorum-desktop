import { useState, useCallback } from 'react';

interface UseCopyToClipboardLogicOptions {
  onCopy?: () => void;
  timeout?: number;
  touchTimeout?: number;
}

interface ClipboardAdapter {
  copy: (text: string) => Promise<void>;
  isTouch: boolean;
}

interface UseCopyToClipboardLogicReturn {
  copied: boolean;
  copyToClipboard: (text: string) => Promise<void>;
  error: Error | null;
}

export const useCopyToClipboardLogic = (
  adapter: ClipboardAdapter,
  options: UseCopyToClipboardLogicOptions = {}
): UseCopyToClipboardLogicReturn => {
  const { onCopy, timeout = 2000, touchTimeout = 3000 } = options;

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await adapter.copy(text);

        setCopied(true);
        setError(null);

        if (onCopy) {
          onCopy();
        }

        // Auto-reset copied state after timeout
        const timeoutDuration = adapter.isTouch ? touchTimeout : timeout;
        setTimeout(() => {
          setCopied(false);
        }, timeoutDuration);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to copy text');
        setError(error);
        setCopied(false);
        console.error('Failed to copy text:', err);
      }
    },
    [adapter, onCopy, timeout, touchTimeout]
  );

  return {
    copied,
    copyToClipboard,
    error,
  };
};
