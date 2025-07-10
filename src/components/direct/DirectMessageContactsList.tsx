import * as React from 'react';
import DirectMessageContact from './DirectMessageContact';
import { Link } from 'react-router-dom';
import './DirectMessageContactsList.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useConversations } from '../../hooks';
import { Trans } from '@lingui/react/macro';

const DirectMessageContactsList: React.FC<{}> = ({}) => {
  const { data: conversations, refetch: refetchConversations } =
    useConversations({ type: 'direct' });

  React.useEffect(() => {
    const i = setInterval(() => {
      refetchConversations({ cancelRefetch: true });
    }, 2000);
    return () => {
      clearInterval(i);
    };
  }, []);

  return (
    <div className="direct-messages-list">
      <div className="px-4 py-2 font-semibold flex flex-row justify-between">
        <div><Trans>Direct Messages</Trans></div>
        <div className="flex flex-col justify-around pr-2">
          <Link to="/messages/new">
            <FontAwesomeIcon className="cursor-pointer text-accent hover:text-accent-300 h-5" icon={faPlusCircle} />
          </Link>
        </div>
      </div>
      {[...conversations.pages.flatMap((c: any) => c.conversations)]
        .filter((c) => c)
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((c) => {
          return (
            <DirectMessageContact
              unread={(c.lastReadTimestamp ?? 0) < c.timestamp}
              key={'dmc-' + c.address}
              address={c.address}
              userIcon={c.icon}
              displayName={c.displayName}
            />
          );
        })}
    </div>
  );
};

export default DirectMessageContactsList;
