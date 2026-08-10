import React, { Suspense } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useSpaces } from '../../hooks/queries/spaces';
import { useMultiSpaceRosters } from '../../hooks/business/identity';
import { IdentityScopeProvider } from '../../identity';
import { NotificationPanel } from './NotificationPanel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Suspense-isolated container for the global notification panel, rendered by
 * ModalProvider (router level) so its backdrop stacks above the AppShell chrome
 * — see .agents/docs/features/modals.md.
 *
 * `useSpaces` is suspense-backed and ModalProvider sits ABOVE the Layout's
 * Suspense boundary, so this wraps its own <Suspense> to keep a brief
 * spaces-load from bubbling to the router. The inner component only mounts when
 * `isOpen` (the Modal itself no-ops when not visible, but gating the data hooks
 * avoids fetching rosters for a closed panel).
 */
const GlobalNotificationsInner: React.FC<Props> = ({ isOpen, onClose }) => {
  const { data: spaces = [] } = useSpaces();
  const user = usePasskeysContext();
  const selfAddress = user?.currentPasskeyInfo?.address || null;

  // Detached surface: the global panel spans every space the user belongs
  // to, same shape as the standalone /bookmarks page — no single enclosing
  // <IdentityScopeProvider> exists for it. Each row resolves its sender via
  // <MemberName spaceId={row.spaceId} enrich />, which throws outside a
  // provider.
  const spaceIds = React.useMemo(() => spaces.map((s) => s.spaceId), [spaces]);
  const rostersBySpace = useMultiSpaceRosters(spaceIds);

  return (
    <IdentityScopeProvider rostersBySpace={rostersBySpace} selfAddress={selfAddress}>
      <NotificationPanel
        global
        isOpen={isOpen}
        onClose={onClose}
        spaces={spaces}
        // Required by the shared props. In global mode the panel resolves
        // in-body mentions through its own `useNameResolver()` call (bound
        // per-row to that row's spaceId), because a single per-space map
        // cannot cover a list that spans spaces. This stub is the
        // unreachable branch. It used to be reachable: the panel handed it
        // straight to NotificationItem for mention rendering, and returning
        // `undefined` there threw in render and took the whole panel down.
        spaceId=""
        channelIds={[]}
        mapSenderToUser={() => undefined}
      />
    </IdentityScopeProvider>
  );
};

export const GlobalNotificationsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <GlobalNotificationsInner isOpen={isOpen} onClose={onClose} />
    </Suspense>
  );
};

export default GlobalNotificationsModal;
