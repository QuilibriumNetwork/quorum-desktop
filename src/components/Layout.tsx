import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import CloseButton from './CloseButton';
import { ResponsiveContainer } from './primitives/ResponsiveContainer';
import CreateSpaceModal from './modals/CreateSpaceModal';
import NewDirectMessageModal from './modals/NewDirectMessageModal';
import Connecting from './Connecting';
import KickUserModal from './modals/KickUserModal';
import { useModalContext } from './AppWithSearch';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
}> = (props) => {
  let [createSpaceVisible, setCreateSpaceVisible] = React.useState(false);
  // let [joinSpaceVisible, setJoinSpaceVisible] = React.useState(false);
  const { isNewDirectMessageOpen, closeNewDirectMessage } = useModalContext();

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={() => setCreateSpaceVisible(false)}
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
        showCreateSpaceModal={() => setCreateSpaceVisible(true)}
        showJoinSpaceModal={() => {
          /*setJoinSpaceVisible(true)*/
        }}
      />
      {(() =>
        typeof window !== 'undefined' &&
        typeof window.process === 'object' &&
        Object.keys(window.process).find((k) => k == 'type') !== undefined ? (
          <CloseButton />
        ) : (
          <></>
        ))()}
      <ResponsiveContainer>{props.children}</ResponsiveContainer>
    </React.Suspense>
  );
};

export default Layout;
