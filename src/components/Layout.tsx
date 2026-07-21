import * as React from 'react';
import { AppShell } from './shell/AppShell';
import { StartupEffects } from './StartupEffects';
import { CloseButton } from './ui';
import { Callout, Portal } from './primitives';
import CreateSpaceModal from './modals/CreateSpaceModal';
import AddSpaceModal from './modals/AddSpaceModal';
import ConfirmationModal from './modals/ConfirmationModal';
import ImageModal from './modals/ImageModal';
import { EditHistoryModal } from './modals/EditHistoryModal';
import { ReactionsModal } from './modals/ReactionsModal';
import { ThreadSettingsModal } from './modals/ThreadSettingsModal';
import { ConfirmationModalProvider } from './context/ConfirmationModalProvider';
import { ImageModalProvider } from './context/ImageModalProvider';
import { EditHistoryModalProvider } from './context/EditHistoryModalProvider';
import { ReactionsModalProvider } from './context/ReactionsModalProvider';
import { ThreadSettingsModalProvider } from './context/ThreadSettingsModalProvider';
import { SpaceModalsProvider } from './context/SpaceModalsProvider';
import Connecting from './Connecting';
import { useModalManagement, useElectronDetection } from '../hooks';
import { useNavigationHotkeys } from '@/hooks/platform/interactions/useNavigationHotkeys';
import { useSidebar } from './context/SidebarProvider';
import { OfflineBanner } from './ui/OfflineBanner';
import { useMutedConversationsSync } from '../hooks/business/dm/useMutedConversationsSync';
import { useMigrateConversationSettings } from '../hooks/business/dm/useMigrateConversationSettings';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
}> = (props) => {
  const {
    addSpaceVisible,
    showAddSpaceModal,
    hideAddSpaceModal,
    createSpaceVisible,
    showCreateSpaceModal,
    hideCreateSpaceModal,
    confirmationModal,
    showConfirmationModal,
    hideConfirmationModal,
    imageModal,
    showImageModal,
    hideImageModal,
    editHistoryModal,
    showEditHistoryModal,
    hideEditHistoryModal,
    reactionsModal,
    showReactionsModal,
    hideReactionsModal,
    threadSettingsModal,
    showThreadSettingsModal,
    hideThreadSettingsModal,
  } = useModalManagement();
  const { isElectron } = useElectronDetection();
  // Mounted for its side-effects (right-sidebar context). The destructured
  // values aren't read here but the hook still needs to run.
  useSidebar();
  useNavigationHotkeys();

  // Sync muted conversations to NotificationService for desktop notification filtering
  useMutedConversationsSync();
  useMigrateConversationSettings();

  const [toast, setToast] = React.useState<{
    id?: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
    persistent?: boolean;
    bottomFixed?: boolean;
  } | null>(null);

  // Store timer ref for cleanup (prevents memory leak)
  const toastTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  React.useEffect(() => {
    const showToast = (
      message: string,
      variant: 'info' | 'success' | 'warning' | 'error',
      id?: string,
      persistent?: boolean,
      bottomFixed?: boolean
    ) => {
      clearTimeout(toastTimerRef.current);
      setToast({ id, message, variant, persistent, bottomFixed });
      if (!persistent) {
        toastTimerRef.current = setTimeout(() => setToast(null), 5000);
      }
    };

    const kickHandler = (e: any) => {
      showToast(
        `You've been kicked from ${e.detail?.spaceName || 'a space'}`,
        'warning'
      );
    };

    const genericHandler = (e: any) => {
      showToast(
        e.detail?.message || 'Notification',
        e.detail?.variant || 'info',
        e.detail?.id,
        e.detail?.persistent,
        e.detail?.bottomFixed
      );
    };

    const dismissHandler = (e: any) => {
      const dismissId = e.detail?.id;
      if (dismissId) {
        setToast((current) => (current?.id === dismissId ? null : current));
      }
    };

    (window as any).addEventListener('quorum:kick-toast', kickHandler);
    (window as any).addEventListener('quorum:toast', genericHandler);
    (window as any).addEventListener('quorum:toast-dismiss', dismissHandler);

    return () => {
      clearTimeout(toastTimerRef.current);
      (window as any).removeEventListener('quorum:kick-toast', kickHandler);
      (window as any).removeEventListener('quorum:toast', genericHandler);
      (window as any).removeEventListener('quorum:toast-dismiss', dismissHandler);
    };
  }, []);

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={hideCreateSpaceModal}
        />
      )}

      {addSpaceVisible && (
        <AddSpaceModal
          visible={addSpaceVisible}
          onClose={hideAddSpaceModal}
        />
      )}

      {confirmationModal.visible && confirmationModal.config && (
        <ConfirmationModal
          visible={confirmationModal.visible}
          title={confirmationModal.config.title}
          message={confirmationModal.config.message}
          preview={confirmationModal.config.preview}
          confirmText={confirmationModal.config.confirmText}
          cancelText={confirmationModal.config.cancelText}
          variant={confirmationModal.config.variant}
          protipAction={confirmationModal.config.protipAction}
          onConfirm={() => {
            confirmationModal.config?.onConfirm();
            hideConfirmationModal();
          }}
          onCancel={confirmationModal.config.onCancel}
        />
      )}

      {imageModal.visible && (
        <ImageModal
          visible={imageModal.visible}
          imageUrl={imageModal.imageUrl}
          onClose={hideImageModal}
        />
      )}

      {editHistoryModal.visible && editHistoryModal.message && (
        <EditHistoryModal
          visible={editHistoryModal.visible}
          message={editHistoryModal.message}
          onClose={hideEditHistoryModal}
        />
      )}

      {reactionsModal.visible && reactionsModal.reactions.length > 0 && (
        <ReactionsModal
          visible={reactionsModal.visible}
          reactions={reactionsModal.reactions}
          customEmojis={reactionsModal.customEmojis}
          members={reactionsModal.members}
          onClose={hideReactionsModal}
        />
      )}

      {threadSettingsModal.visible && threadSettingsModal.config && (
        <ThreadSettingsModal
          visible={threadSettingsModal.visible}
          threadId={threadSettingsModal.config.threadId}
          rootMessage={threadSettingsModal.config.rootMessage}
          threadMessages={threadSettingsModal.config.threadMessages}
          channelProps={threadSettingsModal.config.channelProps}
          updateTitle={threadSettingsModal.config.updateTitle}
          setThreadClosed={threadSettingsModal.config.setThreadClosed}
          updateThreadSettings={threadSettingsModal.config.updateThreadSettings}
          removeThread={threadSettingsModal.config.removeThread}
          onClose={hideThreadSettingsModal}
        />
      )}

      <OfflineBanner />
      <div>{isElectron && <CloseButton />}</div>
      <ThreadSettingsModalProvider openThreadSettings={showThreadSettingsModal}>
        <ConfirmationModalProvider showConfirmationModal={showConfirmationModal}>
          <ImageModalProvider showImageModal={showImageModal}>
            <EditHistoryModalProvider showEditHistoryModal={showEditHistoryModal}>
              <ReactionsModalProvider showReactionsModal={showReactionsModal}>
                <SpaceModalsProvider
                  showAddSpaceModal={showAddSpaceModal}
                  showCreateSpaceModal={showCreateSpaceModal}
                >
                  <AppShell
                    onAddSpace={showAddSpaceModal}
                    onCreateSpace={showCreateSpaceModal}
                  >
                    <StartupEffects />
                    {props.children}
                    {toast && (
                      <Portal>
                        <div
                          className={`toast-container${toast.bottomFixed ? ' bottom-fixed' : ''}`}
                          role="status"
                          aria-live="polite"
                        >
                          <Callout
                            variant={toast.variant || 'info'}
                            size="sm"
                            dismissible
                            autoClose={0}
                            onClose={() => {
                              clearTimeout(toastTimerRef.current);
                              setToast(null);
                            }}
                          >
                            {toast.message}
                          </Callout>
                        </div>
                      </Portal>
                    )}
                  </AppShell>
                </SpaceModalsProvider>
              </ReactionsModalProvider>
            </EditHistoryModalProvider>
          </ImageModalProvider>
        </ConfirmationModalProvider>
      </ThreadSettingsModalProvider>
    </React.Suspense>
  );
};

export default Layout;
