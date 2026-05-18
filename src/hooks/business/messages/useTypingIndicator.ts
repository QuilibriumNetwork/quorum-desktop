import { useEffect, useState } from 'react';
import { logger } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { TypingScope } from '@/types/typing';

/**
 * Hook used by TypingIndicator to subscribe to the list of typists for a given scope.
 *
 * Returns an array of typist addresses currently active in the scope. Empty
 * when scope is null (no active conversation) or no one is typing.
 *
 * The hook re-subscribes when the scope changes. TypingService's TTL
 * mechanism keeps the list fresh — typists auto-expire after 8s without a
 * renewal.
 */
export function useTypingIndicator(scope: TypingScope | null): string[] {
  const { typingService } = useMessageDB();
  const [typists, setTypists] = useState<string[]>([]);

  // Build a stable dependency key from the scope. Re-subscribes when this changes.
  const scopeKey = scope
    ? scope.kind === 'dm'
      ? `dm:${scope.address}`
      : scope.kind === 'space-channel'
        ? `sc:${scope.spaceId}:${scope.channelId}`
        : `th:${scope.spaceId}:${scope.channelId}:${scope.threadId}`
    : null;

  useEffect(() => {
    if (!scope || !typingService) {
      logger.log('[Typing] useTypingIndicator skipped subscribe', { hasScope: !!scope, hasService: !!typingService });
      setTypists([]);
      return;
    }
    logger.log('[Typing] useTypingIndicator subscribing', { scopeKey });
    const unsubscribe = typingService.subscribe(scope, (next) => {
      logger.log('[Typing] useTypingIndicator received typists update', { scopeKey, next });
      setTypists(next);
    });
    return () => {
      logger.log('[Typing] useTypingIndicator unsubscribing', { scopeKey });
      unsubscribe();
      setTypists([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, typingService]);

  return typists;
}
