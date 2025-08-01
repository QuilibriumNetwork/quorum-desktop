import * as React from 'react';
import DirectMessageContact from './DirectMessageContact';
import './DirectMessageContactsList.scss';
import { Trans } from '@lingui/react/macro';
import { Button, Container, FlexRow, FlexColumn, FlexBetween, Icon } from '../primitives';
import { useModalContext } from '../context/ModalProvider';
import { useConversationPolling } from '../../hooks';

const DirectMessageContactsList: React.FC<{}> = ({}) => {
  const { conversations: conversationsList } = useConversationPolling();
  const { openNewDirectMessage } = useModalContext();

  return (
    <Container className="direct-messages-list flex flex-col h-full overflow-y-auto overflow-x-hidden z-0 flex-grow select-none">
      <FlexBetween className="px-4 pt-4 pb-2 lg:py-2 font-semibold flex-shrink-0">
        <Container>
          <Trans>Direct Messages</Trans>
        </Container>
        <FlexColumn className="justify-around">
          <Icon
            name="user-plus"
            className="cursor-pointer text-accent hover:text-accent-300 h-4"
            data-tooltip-id="add-friend-tooltip"
            onClick={openNewDirectMessage}
          />
        </FlexColumn>
      </FlexBetween>
      {conversationsList.length === 0 ? (
        <FlexColumn className="justify-center items-center flex-1 px-4">
          {/* <FlexColumn className="justify-center items-center sm:hidden mb-4">
            <img
              src="/stay-connected-stay-invisible.gif"
              alt="Stay connected, stay invisible"
              className="w-[200px] max-w-full mb-4"
            />
          </FlexColumn> */}
          <Container className="w-full text-center mb-4 text-subtle">
            <Trans>Ready to start a truly private conversation?</Trans>
          </Container>
          <Button
            type="primary"
            className="max-w-full"
            onClick={openNewDirectMessage}
          >
            <Trans>+ Add a friend</Trans>
          </Button>
        </FlexColumn>
      ) : (
        <Container className="flex-1 overflow-y-auto">
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
        </Container>
      )}
    </Container>
  );
};

export default DirectMessageContactsList;
