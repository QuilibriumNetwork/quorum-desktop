import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import CloseButton from './CloseButton';
import { ResponsiveContainer, Container } from './primitives';
import CreateSpaceModal from './modals/CreateSpaceModal';
import NewDirectMessageModal from './modals/NewDirectMessageModal';
import Connecting from './Connecting';
import KickUserModal from './modals/KickUserModal';
import { useModalContext } from './context/ModalProvider';
import { useModalManagement, useElectronDetection } from '../hooks';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
}> = (props) => {
  const { createSpaceVisible, showCreateSpaceModal, hideCreateSpaceModal } = useModalManagement();
  const { isElectron } = useElectronDetection();
  const { isNewDirectMessageOpen, closeNewDirectMessage } = useModalContext();

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={hideCreateSpaceModal}
        />
      )}
      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
      {isNewDirectMessageOpen && (
        <NewDirectMessageModal
          visible={isNewDirectMessageOpen}
          onClose={closeNewDirectMessage}
        />
      )}
      {props.kickUserAddress && (
        <KickUserModal
          visible={!!props.kickUserAddress}
          kickUserAddress={props.kickUserAddress}
          onClose={() => {
            props.setKickUserAddress(undefined);
          }}
        />
      )}
      <NavMenu
        showCreateSpaceModal={showCreateSpaceModal}
        showJoinSpaceModal={() => {
          /*setJoinSpaceVisible(true)*/
        }}
      />
      <Container>
        {isElectron && <CloseButton />}
      </Container>
      <ResponsiveContainer>{props.children}</ResponsiveContainer>
    </React.Suspense>
  );
};

export default Layout;
