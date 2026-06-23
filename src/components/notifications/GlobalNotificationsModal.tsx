import React, { Suspense } from 'react';
import { useSpaces } from '../../hooks/queries/spaces';
import { useGlobalSenderResolver } from '../../hooks/business/notifications';
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
  const resolveGlobalSender = useGlobalSenderResolver(spaces);

  return (
    <NotificationPanel
      global
      isOpen={isOpen}
      onClose={onClose}
      spaces={spaces}
      resolveGlobalSender={resolveGlobalSender}
      // Required by the shared props but unused in global mode.
      spaceId=""
      channelIds={[]}
      mapSenderToUser={() => undefined}
    />
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
