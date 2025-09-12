// import { Clipboard } from '@react-native-clipboard/clipboard';

interface ClipboardAdapter {
  copy: (text: string) => Promise<void>;
  isTouch: boolean;
}

export const useClipboardAdapter = (): ClipboardAdapter => {
  const copy = async (text: string): Promise<void> => {
    // TODO: Uncomment when @react-native-clipboard/clipboard is installed
    // await Clipboard.setString(text);
    // TODO: Uncomment when @react-native-clipboard/clipboard is installed
    // Temporary no-op implementation for development
  };

  return {
    copy,
    isTouch: true, // Native is always touch-based
  };
};
