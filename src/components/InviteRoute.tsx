import React from 'react';
import { useNavigate } from 'react-router';
import JoinSpaceModal from './modals/JoinSpaceModal';
import { ModalProvider } from './context/ModalProvider';
import { MobileProvider } from './context/MobileProvider';
import { SidebarProvider } from './context/SidebarProvider';
import Layout from './Layout';

const InviteRoute: React.FC = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    // Check if there's meaningful browser history to go back to
    if (window.history.length > 1 && document.referrer) {
      // There's previous history and a referrer, safe to go back
      window.history.back();
    } else {
      // No meaningful history or came directly to this page, go to messages
      navigate('/messages');
    }
  };

  return (
    <div className="min-h-screen w-full">
      <JoinSpaceModal visible={true} onClose={handleClose} />
      <ModalProvider>
        <MobileProvider>
          <SidebarProvider>
            <Layout>
              <div />
            </Layout>
          </SidebarProvider>
        </MobileProvider>
      </ModalProvider>
    </div>
  );
};

export default InviteRoute;
