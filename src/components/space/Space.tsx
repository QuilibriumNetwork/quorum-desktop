import * as React from 'react';
import { useParams } from 'react-router';
import ChannelList from '../channel/ChannelList';
import Channel from '../channel/Channel';
import UserStatus from '../user/UserStatus';
import { useSpace } from '../../hooks';

import './Space.scss';
import UserSettingsModal from '../modals/UserSettingsModal';

type SpaceProps = {
  user: any;
  setAuthState: React.Dispatch<React.SetStateAction<string | undefined>>;
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
};

const Space: React.FunctionComponent<SpaceProps> = (props) => {
  let params = useParams<{ spaceId: string; channelId: string }>();
  let { data: space } = useSpace({ spaceId: params.spaceId! });
  if (!props || !space || !params.spaceId || !params.channelId) {
    return <></>;
  }
  let [isUserSettingsOpen, setIsUserSettingsOpen] =
    React.useState<boolean>(false);

  return (
    <div className="space-container">
      {isUserSettingsOpen ? (
        <>
          <div className="invisible-dismissal invisible-dark">
            <UserSettingsModal
              setUser={props.setUser}
              dismiss={() => setIsUserSettingsOpen(false)}
            />
            <div
              className="invisible-dismissal"
              onClick={() => setIsUserSettingsOpen(false)}
            />
          </div>
        </>
      ) : (
        <></>
      )}
      <div className="space-container-channels">
        <ChannelList spaceId={params.spaceId} />
        <UserStatus
          setUser={props.setUser}
          setIsUserSettingsOpen={setIsUserSettingsOpen}
          setAuthState={props.setAuthState}
          user={props.user}
        />
      </div>
      <Channel spaceId={params.spaceId} channelId={params.channelId} />
    </div>
  );
};

export default Space;
