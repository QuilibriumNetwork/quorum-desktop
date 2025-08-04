import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import CloseButton from './CloseButton';
import { ResponsiveContainer, Container } from './primitives';
import CreateSpaceModal from './modals/CreateSpaceModal';
import Connecting from './Connecting';
import { useModalManagement, useElectronDetection } from '../hooks';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
}> = (props) => {
  const { createSpaceVisible, showCreateSpaceModal, hideCreateSpaceModal } = useModalManagement();
  const { isElectron } = useElectronDetection();

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={hideCreateSpaceModal}
        />
      )}
      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
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
