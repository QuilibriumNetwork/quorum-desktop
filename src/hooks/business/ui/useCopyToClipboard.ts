import { useState, useCallback } from 'react';
import { isWeb } from '../../../utils/platform';

interface UseCopyToClipboardOptions {
  onCopy?: () => void;
  timeout?: number;
  touchTimeout?: number;
}

interface UseCopyToClipboardReturn {
  copied: boolean;
  copyToClipboard: (text: string) => Promise<void>;
  error: Error | null;
}

export const useCopyToClipboard = (options: UseCopyToClipboardOptions = {}): UseCopyToClipboardReturn => {
  const { 
    onCopy, 
    timeout = 2000,
    touchTimeout = 3000 
  } = options;
  
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (isWeb && typeof window !== 'undefined') {
        // Check for Electron clipboard API first
        if ((window as any).electron?.clipboard?.writeText) {
          (window as any).electron.clipboard.writeText(text);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        // For native, we'll use Clipboard from react-native
        // import { Clipboard } from '@react-native-clipboard/clipboard';
        // await Clipboard.setString(text);
        console.log('Native clipboard not implemented yet');
      }

      setCopied(true);
      setError(null);
      
      if (onCopy) {
        onCopy();
      }

      // Auto-reset copied state after timeout
      const timeoutDuration = isTouchDevice() ? touchTimeout : timeout;
      setTimeout(() => {
        setCopied(false);
      }, timeoutDuration);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to copy text');
      setError(error);
      setCopied(false);
      console.error('Failed to copy text:', err);
    }
  }, [onCopy, timeout, touchTimeout]);

  return {
    copied,
    copyToClipboard,
    error
  };
};

// Helper function to detect touch devices
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
};