import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useElectronDetection } from '@/hooks/business/ui/useElectronDetection';
import { useConfig } from '@/hooks/queries/config/useConfig';
import { useSpaces } from '@/hooks/queries/spaces/useSpaces';
import { useSpaceOrdering } from '@/hooks/business/spaces/useSpaceOrdering';
import { useConversationPolling } from '@/hooks/business/conversations/useConversationPolling';

/**
 * Global navigation hotkeys (Web/Electron)
 * - Ctrl/Cmd + S: jump to Spaces (current or first)
 * - Ctrl/Cmd + S + ArrowUp/ArrowDown: cycle through Spaces
 * - Ctrl/Cmd + D: jump to Direct Messages
 * - Ctrl/Cmd + D + ArrowUp/ArrowDown: cycle through Direct Message conversations
 */
export function useNavigationHotkeys() {
  const { isElectron } = useElectronDetection();
  const isElectronDetected = useMemo(() => {
    if (isElectron) return true;
    if (typeof window !== 'undefined' && (window as any).electron) return true;
    return false;
  }, [isElectron]);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: routeSpaceId } = useParams<{ spaceId: string }>();
  const { address: routeDmAddress } = useParams<{ address: string }>();

  // Spaces ordering and navigation data
  const user = usePasskeysContext();
  const { data: spaces } = useSpaces({});
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo!.address,
  });
  const { mappedSpaces } = useSpaceOrdering(spaces, config);

  const orderedSpaceIds = useMemo(
    () => mappedSpaces.map((s) => s.spaceId),
    [mappedSpaces]
  );

  // DM conversations ordered by recent activity (descending)
  const { conversations } = useConversationPolling();
  const orderedDmAddresses = useMemo(
    () => conversations.map((c: any) => c.address),
    [conversations]
  );

  // Track chord intent: whether we are in a Space or DM chord after Ctrl+S/D
  const activeChordRef = useRef<null | 'spaces' | 'dms'>(null);
  const chordTimeoutRef = useRef<number | null>(null);

  const clearChord = useCallback(() => {
    activeChordRef.current = null;
    if (chordTimeoutRef.current) {
      window.clearTimeout(chordTimeoutRef.current);
      chordTimeoutRef.current = null;
    }
  }, []);

  const startChord = useCallback((type: 'spaces' | 'dms') => {
    activeChordRef.current = type;
    if (chordTimeoutRef.current) window.clearTimeout(chordTimeoutRef.current);
    chordTimeoutRef.current = window.setTimeout(() => {
      activeChordRef.current = null;
      chordTimeoutRef.current = null;
    }, 1500);
  }, []);

  const isTypingInInput = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (active.isContentEditable) return true;
    return false;
  }, []);

  const navigateToSpaceIndex = useCallback(
    (index: number) => {
      if (orderedSpaceIds.length === 0) return;
      const safeIndex =
        ((index % orderedSpaceIds.length) + orderedSpaceIds.length) %
        orderedSpaceIds.length;
      const targetSpace = mappedSpaces[safeIndex];
      if (!targetSpace) return;
      const defaultChannelId =
        targetSpace.defaultChannelId || '00000000-0000-0000-0000-000000000000';
      navigate(`/spaces/${targetSpace.spaceId}/${defaultChannelId}`);
    },
    [mappedSpaces, navigate, orderedSpaceIds.length]
  );

  const navigateToDmIndex = useCallback(
    (index: number) => {
      if (orderedDmAddresses.length === 0) return;
      const safeIndex =
        ((index % orderedDmAddresses.length) + orderedDmAddresses.length) %
        orderedDmAddresses.length;
      const address = orderedDmAddresses[safeIndex];
      if (!address) return;
      navigate(`/messages/${address}`);
    },
    [navigate, orderedDmAddresses]
  );

  // Compute current indices
  const currentSpaceIndex = useMemo(() => {
    if (!routeSpaceId) return 0;
    const idx = orderedSpaceIds.indexOf(routeSpaceId);
    return idx >= 0 ? idx : 0;
  }, [orderedSpaceIds, routeSpaceId]);

  const currentDmIndex = useMemo(() => {
    if (!routeDmAddress) return 0;
    const idx = orderedDmAddresses.indexOf(routeDmAddress);
    return idx >= 0 ? idx : 0;
  }, [orderedDmAddresses, routeDmAddress]);

  useEffect(() => {
    if (!isElectronDetected) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTypingInInput()) return;

      // Space chord entry + cycling on repeated presses
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        startChord('spaces');
        if (orderedSpaceIds.length === 0) return;
        if (location.pathname.startsWith('/spaces/')) {
          // Already in spaces: cycle to next space
          navigateToSpaceIndex(currentSpaceIndex + 1);
        } else {
          // Jump into spaces
          navigateToSpaceIndex(currentSpaceIndex);
        }
        return;
      }

      // DM chord entry + cycling on repeated presses
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        startChord('dms');
        if (orderedDmAddresses.length === 0) {
          // No conversations; just ensure we're on messages root
          if (!location.pathname.startsWith('/messages')) {
            navigate('/messages');
          }
          return;
        }
        if (location.pathname.startsWith('/messages')) {
          // Already in DMs: cycle to next conversation (or open first if none selected)
          if (routeDmAddress) {
            navigateToDmIndex(currentDmIndex + 1);
          } else {
            navigateToDmIndex(0);
          }
        } else {
          // Jump directly to current (or first) conversation
          navigateToDmIndex(currentDmIndex);
        }
        return;
      }

      // Cycling with arrow keys while chord is active
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const chord = activeChordRef.current;
        if (!chord) return;
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? -1 : 1;

        if (chord === 'spaces') {
          const nextIndex = currentSpaceIndex + delta;
          navigateToSpaceIndex(nextIndex);
          return;
        }

        if (chord === 'dms') {
          const nextIndex = currentDmIndex + delta;
          navigateToDmIndex(nextIndex);
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Clear chord on releasing S or D or modifier
      if (
        e.key.toLowerCase() === 's' ||
        e.key.toLowerCase() === 'd' ||
        e.key === 'Meta' ||
        e.key === 'Control'
      ) {
        clearChord();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      clearChord();
    };
  }, [
    isElectronDetected,
    clearChord,
    currentDmIndex,
    currentSpaceIndex,
    isTypingInInput,
    location.pathname,
    navigate,
    navigateToDmIndex,
    navigateToSpaceIndex,
    startChord,
  ]);
}
