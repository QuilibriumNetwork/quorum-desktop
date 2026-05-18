import { useCallback, useEffect, useRef } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { TypingScope } from '@/types/typing';

/**
 * Hook used inside MessageComposer to broadcast typing signals.
 *
 * Usage:
 * - Call `notifyKeystroke()` on every onChange/input event. Throttling is
 *   handled internally by TypingService (one typing-start per 5s per scope).
 * - Call `notifyMessageSent()` when the user submits a message. This sends
 *   an explicit typing-stop.
 *
 * Lifecycle:
 * - Auto-sends typing-stop on scope change.
 * - Auto-sends typing-stop on unmount.
 * - Auto-sends typing-stop when the document becomes hidden (tab switch / window blur).
 *
 * Pass `scope=null` or `enabled=false` to make all calls no-ops (e.g., for
 * read-only channels where the user lacks message:send permission).
 */
export function useTypingNotifier(
  scope: TypingScope | null,
  enabled: boolean = true,
): { notifyKeystroke: () => void; notifyMessageSent: () => void } {
  const { typingService } = useMessageDB();
  const activeScopeRef = useRef<TypingScope | null>(null);

  const notifyKeystroke = useCallback(() => {
    if (!enabled || !scope || !typingService) return;
    typingService.notifyTyping(scope);
    activeScopeRef.current = scope;
  }, [enabled, scope, typingService]);

  const notifyMessageSent = useCallback(() => {
    if (!activeScopeRef.current || !typingService) return;
    typingService.notifyStopped(activeScopeRef.current);
    activeScopeRef.current = null;
  }, [typingService]);

  // Auto-stop on scope change or unmount
  useEffect(() => {
    return () => {
      const previous = activeScopeRef.current;
      if (previous && typingService) {
        typingService.notifyStopped(previous);
        activeScopeRef.current = null;
      }
    };
  }, [scope, typingService]);

  // Auto-stop on visibility change to hidden
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (document.visibilityState === 'hidden' && activeScopeRef.current && typingService) {
        typingService.notifyStopped(activeScopeRef.current);
        activeScopeRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, [typingService]);

  return { notifyKeystroke, notifyMessageSent };
}
