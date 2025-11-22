import * as React from 'react';
import DirectMessageContact from './DirectMessageContact';
import './DirectMessageContactsList.scss';
import { Trans } from '@lingui/react/macro';
import {
  Button,
  Container,
  FlexColumn,
  FlexBetween,
} from '../primitives';
import { useModalContext } from '../context/ModalProvider';
import { useConversationPolling } from '../../hooks';
import { useConversationPreviews } from '../../hooks/business/conversations/useConversationPreviews';

const DirectMessageContactsList: React.FC<{}> = ({}) => {
  const { conversations: conversationsList } = useConversationPolling();
  const { data: conversationsWithPreviews = conversationsList } =
    useConversationPreviews(conversationsList);
  const { openNewDirectMessage } = useModalContext();

  return (
    <Container className="direct-messages-list-wrapper list-bottom-fade flex flex-col h-full z-0 flex-grow select-none">
      <FlexBetween className="direct-messages-header px-4 pt-4 pb-2 lg:py-2 font-semibold flex-shrink-0">
        <Container>
          <Trans>Direct Messages</Trans>
        </Container>
        <FlexColumn className="justify-around">
          <Button
            type="primary"
            size="small"
            iconName="user-plus"
            iconSize="lg"
            iconOnly
            onClick={openNewDirectMessage}
            tooltip="Add a friend"
          />
        </FlexColumn>
      </FlexBetween>
      <Container className="direct-messages-list flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {conversationsList.length === 0 ? (
          <FlexColumn className="justify-center items-center flex-1 px-4">
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
            {conversationsWithPreviews.map((c) => {
              return (
                <DirectMessageContact
                  unread={(c.lastReadTimestamp ?? 0) < c.timestamp}
                  key={'dmc-' + c.address}
                  address={c.address}
                  userIcon={c.icon}
                  displayName={c.displayName}
                  lastMessagePreview={c.preview}
                  previewIcon={c.previewIcon}
                  timestamp={c.timestamp}
                />
              );
            })}
          </Container>
        )}
      </Container>
    </Container>
  );
};

export default DirectMessageContactsList;
