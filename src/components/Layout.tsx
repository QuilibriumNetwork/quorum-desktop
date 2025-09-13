import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import CloseButton from './CloseButton';
import { ResponsiveContainer, Container } from './primitives';
import CreateSpaceModal from './modals/CreateSpaceModal';
import ConfirmationModal from './modals/ConfirmationModal';
import { ConfirmationModalProvider } from './context/ConfirmationModalProvider';
import Connecting from './Connecting';
import { useModalManagement, useElectronDetection } from '../hooks';
import { useNavigationHotkeys } from '@/hooks/platform/interactions/useNavigationHotkeys';
import { useSidebar } from './context/SidebarProvider';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
}> = (props) => {
  const { 
    createSpaceVisible, 
    showCreateSpaceModal, 
    hideCreateSpaceModal,
    confirmationModal,
    showConfirmationModal,
    hideConfirmationModal,
  } = useModalManagement();
  const { isElectron } = useElectronDetection();
  const { showRightSidebar, setShowRightSidebar, rightSidebarContent } =
    useSidebar();
  useNavigationHotkeys();

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={hideCreateSpaceModal}
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
      
      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
      <NavMenu
        showCreateSpaceModal={showCreateSpaceModal}
        showJoinSpaceModal={() => {
          /*setJoinSpaceVisible(true)*/
        }}
      />
      <Container>{isElectron && <CloseButton />}</Container>
      <ConfirmationModalProvider showConfirmationModal={showConfirmationModal}>
        <ResponsiveContainer>{props.children}</ResponsiveContainer>
      </ConfirmationModalProvider>

      {/* Mobile overlay - backdrop for sidebar below 1024px */}
      {showRightSidebar && (
        <div
          className="fixed inset-0 bg-mobile-overlay z-[9999] lg:hidden"
          onClick={() => setShowRightSidebar(false)}
        />
      )}

      {/* Mobile sidebar content - rendered at Layout level to avoid stacking context issues */}
      {rightSidebarContent && (
        <div
          className={
            'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto ' +
            'transition-transform duration-300 ease-in-out ' +
            (showRightSidebar ? 'translate-x-0' : 'translate-x-full') +
            ' fixed top-0 right-0 h-full z-[10000] lg:hidden'
          }
        >
          {rightSidebarContent}
        </div>
      )}
    </React.Suspense>
  );
};

export default Layout;
