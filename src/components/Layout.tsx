import * as React from 'react';
import NavMenu from './navbar/NavMenu';
import CloseButton from './CloseButton';
import Container from './Container';
import CreateSpaceModal from './modals/CreateSpaceModal';
import NewDirectMessageModal from './modals/NewDirectMessageModal';
import Connecting from './Connecting';
import { useNavigate } from 'react-router';
import KickUserModal from './modals/KickUserModal';

const Layout: React.FunctionComponent<{
  children: React.ReactNode;
  newDirectMessage?: boolean;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
}> = (props) => {
  let [createSpaceVisible, setCreateSpaceVisible] = React.useState(false);
  // let [joinSpaceVisible, setJoinSpaceVisible] = React.useState(false);
  let navigate = useNavigate();

  return (
    <React.Suspense fallback={<Connecting />}>
      {createSpaceVisible && (
        <CreateSpaceModal
          visible={createSpaceVisible}
          onClose={() => setCreateSpaceVisible(false)}
        />
      )}
      {/* {joinSpaceVisible && <JoinSpaceModal visible={joinSpaceVisible} onClose={() => setJoinSpaceVisible(false)}/>} */}
      {props.newDirectMessage && (
        <NewDirectMessageModal
          visible={props.newDirectMessage ?? false}
          onClose={() => navigate(-1)}
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
      <Container>{props.children}</Container>
    </React.Suspense>
  );
};

export default Layout;
