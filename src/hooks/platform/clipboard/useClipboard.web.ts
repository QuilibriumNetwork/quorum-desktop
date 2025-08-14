import { isTouchDevice } from '../../../utils/platform';

interface ClipboardAdapter {
  copy: (text: string) => Promise<void>;
  isTouch: boolean;
}

export const useClipboardAdapter = (): ClipboardAdapter => {
  const copy = async (text: string): Promise<void> => {
    // Check for Electron clipboard API first
    if ((window as any).electron?.clipboard?.writeText) {
      (window as any).electron.clipboard.writeText(text);
      return;
    }

    // Modern browser clipboard API
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };

  return {
    copy,
    isTouch: isTouchDevice(),
  };
};