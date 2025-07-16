import * as React from 'react';
import DirectMessageContact from './DirectMessageContact';
import { Link } from 'react-router-dom';
import './DirectMessageContactsList.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useConversations } from '../../hooks';
import { Trans, t } from '@lingui/react/macro';
import Button from '../Button';

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

  const conversationsList = [...conversations.pages.flatMap((c: any) => c.conversations)]
    .filter((c) => c)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="direct-messages-list flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 lg:py-2 font-semibold flex flex-row justify-between flex-shrink-0">
        <div>
          <Trans>Direct Messages</Trans>
        </div>
        <div className="flex flex-col justify-around pr-2">
          <Link to="/messages/new">
            <FontAwesomeIcon
              className="cursor-pointer text-accent hover:text-accent-300 h-5"
              icon={faPlusCircle}
            />
          </Link>
        </div>
      </div>
      {conversationsList.length === 0 ? (
        <div className="flex flex-col justify-center items-center flex-1 px-4">
          <div className="w-full text-center mb-4 text-subtle">
            <Trans>Ready to start a truly private conversation?</Trans>
          </div>
          <Link to="/messages/new" className="inline-block max-w-full">
            <Button
              type="primary"
              className="max-w-full"
              onClick={() => {}}
            >
              <Trans>+ add friend</Trans>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {conversationsList.map((c) => {
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
      )}
    </div>
  );
};

export default DirectMessageContactsList;
