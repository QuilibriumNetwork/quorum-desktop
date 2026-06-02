import * as React from 'react';
import { useParams } from 'react-router';
import Channel from './Channel';
import { useSpace } from '../../hooks';
import { ThreadProvider } from '../context/ThreadContext';
import { ThreadPanel } from '../thread/ThreadPanel';

import './Space.scss';

const Space: React.FunctionComponent = () => {
  const params = useParams<{ spaceId: string; channelId: string }>();
  const { data: space } = useSpace({ spaceId: params.spaceId! });

  if (!space || !params.spaceId || !params.channelId) {
    return <></>;
  }

  return (
    <ThreadProvider>
      <div className="space-container">
        <Channel
          key={`${params.spaceId}-${params.channelId}`}
          spaceId={params.spaceId}
          channelId={params.channelId}
        />
        <ThreadPanel />
      </div>
    </ThreadProvider>
  );
};

export default Space;
