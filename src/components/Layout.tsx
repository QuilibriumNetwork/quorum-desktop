import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import { CloseButton } from './ui';
import { Container, Callout, Portal } from './primitives';
import { useResponsiveLayoutContext } from './context/ResponsiveLayoutProvider';
import CreateSpaceModal from './modals/CreateSpaceModal';
import AddSpaceModal from './modals/AddSpaceModal';
import ConfirmationModal from './modals/ConfirmationModal';
import ImageModal from './modals/ImageModal';
import { EditHistoryModal } from './modals/EditHistoryModal';
import { ReactionsModal } from './modals/ReactionsModal';
import { ConfirmationModalProvider } from './context/ConfirmationModalProvider';
import { ImageModalProvider } from './context/ImageModalProvider';
import { EditHistoryModalProvider } from './context/EditHistoryModalProvider';
import { ReactionsModalProvider } from './context/ReactionsModalProvider';
import Connecting from './Connecting';
import { useModalManagement, useElectronDetection } from '../hooks';
import { useNavigationHotkeys } from '@/hooks/platform/interactions/useNavigationHotkeys';
import { useSidebar } from './context/SidebarProvider';
import { OfflineBanner } from './ui/OfflineBanner';
import { useMutedConversationsSync } from '../hooks/business/dm/useMutedConversationsSync';

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
  } = useModalManagement();
  const { isElectron } = useElectronDetection();
  const { showRightSidebar, setShowRightSidebar, rightSidebarContent } =
    useSidebar();
  const { navMenuOpen } = useResponsiveLayoutContext();
  useNavigationHotkeys();

  // Sync muted conversations to NotificationService for desktop notification filtering
  useMutedConversationsSync();

  const [toast, setToast] = React.useState<{
    id?: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
    persistent?: boolean;
    bottomFixed?: boolean;
  } | null>(null);

  // Store timer ref for cleanup (prevents memory leak)
  const toastTimerRef = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    const showToast = (
      message: string,
      variant: 'info' | 'success' | 'warning' | 'error',
      id?: string,
      persistent?: boolean,
      bottomFixed?: boolean
    ) => {
      // Clear any existing timer
      clearTimeout(toastTimerRef.current);

      // Show new toast
      setToast({ id, message, variant, persistent, bottomFixed });

      // Only set auto-dismiss timer for non-persistent toasts
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
      // Clean up timer on unmount
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
          onCreateSpace={() => {
            hideAddSpaceModal();
            showCreateSpaceModal();
          }}
        />
      )}

      {/* Confirmation Modal */}
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

      {/* Image Modal */}
      {imageModal.visible && (
        <ImageModal
          visible={imageModal.visible}
          imageUrl={imageModal.imageUrl}
          onClose={hideImageModal}
        />
      )}

      {/* Edit History Modal */}
      {editHistoryModal.visible && editHistoryModal.message && (
        <EditHistoryModal
          visible={editHistoryModal.visible}
          message={editHistoryModal.message}
          onClose={hideEditHistoryModal}
        />
      )}

      {/* Reactions Modal */}
      {reactionsModal.visible && reactionsModal.reactions.length > 0 && (
        <ReactionsModal
          visible={reactionsModal.visible}
          reactions={reactionsModal.reactions}
          customEmojis={reactionsModal.customEmojis}
          members={reactionsModal.members}
          onClose={hideReactionsModal}
        />
      )}

      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
      <OfflineBanner />
      <NavMenu
        showCreateSpaceModal={showAddSpaceModal}
        showJoinSpaceModal={() => {}}
      />
      <Container>{isElectron && <CloseButton />}</Container>
      <ConfirmationModalProvider showConfirmationModal={showConfirmationModal}>
        <ImageModalProvider showImageModal={showImageModal}>
          <EditHistoryModalProvider showEditHistoryModal={showEditHistoryModal}>
            <ReactionsModalProvider showReactionsModal={showReactionsModal}>
              <div className={`main-content${!navMenuOpen ? ' nav-hidden' : ''}`}>
            {props.children}
            {toast && (
              <Portal>
                <div className={`toast-container${toast.bottomFixed ? ' bottom-fixed' : ''}`}>
                  <Callout
                    variant={toast.variant || 'info'}
                    size="sm"
                    dismissible
                    autoClose={0}
                    onClose={() => {
                      // Clear timer when manually dismissed
                      clearTimeout(toastTimerRef.current);
                      setToast(null);
                    }}
                  >
                    {toast.message}
                  </Callout>
                </div>
              </Portal>
            )}
              </div>
            </ReactionsModalProvider>
          </EditHistoryModalProvider>
        </ImageModalProvider>
      </ConfirmationModalProvider>
    </React.Suspense>
  );
};

export default Layout;
