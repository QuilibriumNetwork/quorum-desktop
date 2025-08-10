import { useCopyToClipboardLogic } from './useCopyToClipboardLogic';
import { useClipboardAdapter } from '../../platform/clipboard/useClipboard';

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

export const useCopyToClipboard = (
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn => {
  const adapter = useClipboardAdapter();
  return useCopyToClipboardLogic(adapter, options);
};

// Note: isTouchDevice function moved to web-specific files only.
// Platform detection is now handled by the clipboard adapters.
