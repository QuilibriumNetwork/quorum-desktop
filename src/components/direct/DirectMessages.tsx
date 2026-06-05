import * as React from 'react';
import { useParams } from 'react-router';
import DirectMessage from './DirectMessage';
import { EmptyDirectMessage } from './EmptyDirectMessage';

import './DirectMessages.scss';
import { ReactTooltip } from '../ui';
import { t } from '@lingui/core/macro';

const DirectMessages: React.FunctionComponent = () => {
  const { address } = useParams<{ address: string }>();

  return (
    <div className="direct-messages-container">
      <React.Suspense>
        {address ? (
          <DirectMessage key={'messages-' + address} />
        ) : (
          <EmptyDirectMessage />
        )}
      </React.Suspense>
      <ReactTooltip
        id="add-friend-tooltip"
        content={t`Add friend`}
        place="right"
        className="z-[9999]"
      />
    </div>
  );
};

export default DirectMessages;
