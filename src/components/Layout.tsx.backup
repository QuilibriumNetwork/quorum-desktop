import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import { CloseButton } from './ui';
import { ResponsiveContainer, Container, Callout, Portal } from './primitives';
import CreateSpaceModal from './modals/CreateSpaceModal';
import AddSpaceModal from './modals/AddSpaceModal';
import ConfirmationModal from './modals/ConfirmationModal';
import ImageModal from './modals/ImageModal';
import { ConfirmationModalProvider } from './context/ConfirmationModalProvider';
import { ImageModalProvider } from './context/ImageModalProvider';
import Connecting from './Connecting';
import { useModalManagement, useElectronDetection } from '../hooks';
import { useNavigationHotkeys } from '@/hooks/platform/interactions/useNavigationHotkeys';
import { useSidebar } from './context/SidebarProvider';

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
  } = useModalManagement();
  const { isElectron } = useElectronDetection();
  const { showRightSidebar, setShowRightSidebar, rightSidebarContent } =
    useSidebar();
  useNavigationHotkeys();

  const [kickToast, setKickToast] = React.useState<{ message: string; variant?: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  React.useEffect(() => {
    const kickHandler = (e: any) => {
      setKickToast({ message: `You've been kicked from ${e.detail?.spaceName}`, variant: 'warning' });
    };
    const genericHandler = (e: any) => {
      setKickToast({ message: e.detail?.message, variant: e.detail?.variant || 'info' });
    };
    (window as any).addEventListener('quorum:kick-toast', kickHandler);
    (window as any).addEventListener('quorum:toast', genericHandler);
    return () => {
      (window as any).removeEventListener('quorum:kick-toast', kickHandler);
      (window as any).removeEventListener('quorum:toast', genericHandler);
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

      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
      <NavMenu
        showCreateSpaceModal={showAddSpaceModal}
        showJoinSpaceModal={() => {}}
      />
      <Container>{isElectron && <CloseButton />}</Container>
      <ConfirmationModalProvider showConfirmationModal={showConfirmationModal}>
        <ImageModalProvider showImageModal={showImageModal}>
          <ResponsiveContainer>
            {props.children}
            {kickToast && (
              <Portal>
                <div
                  className="fixed bottom-4 right-4 max-w-[360px]"
                  style={{ zIndex: 2147483647 }}
                >
                  <Callout
                    variant={kickToast.variant || 'info'}
                    size="sm"
                    dismissible
                    autoClose={5}
                    onClose={() => setKickToast(null)}
                  >
                    {kickToast.message}
                  </Callout>
                </div>
              </Portal>
            )}
          </ResponsiveContainer>
        </ImageModalProvider>
      </ConfirmationModalProvider>
    </React.Suspense>
  );
};

export default Layout;
