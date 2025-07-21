import * as React from 'react';
import Button from '../Button';
import '../../styles/_modal_common.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { Channel } from '../../api/quorumApi';
import { useNavigate, useParams } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const ChannelEditor: React.FunctionComponent<{
  spaceId: string;
  groupName: string;
  channelId?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, channelId, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let { channelId: routeChannelId } = useParams();
  let [channelName, setChannelName] = React.useState<string>(
    space?.groups
      .find((g) => g.groupName === groupName)
      ?.channels.find((c) => c.channelId === channelId)?.channelName || ''
  );
  let [channelTopic, setChannelTopic] = React.useState<string>(
    space?.groups
      .find((g) => g.groupName === groupName)
      ?.channels.find((c) => c.channelId === channelId)?.channelTopic || ''
  );
  let [deleteStatus, setDeleteStatus] = React.useState<boolean>(false);
  let [deleteConfirmationStep, setDeleteConfirmationStep] = React.useState(0);
  let [hasMessages, setHasMessages] = React.useState<boolean>(false);
  let [showWarning, setShowWarning] = React.useState<boolean>(false);
  let [closing, setClosing] = React.useState<boolean>(false);
  let navigate = useNavigate();
  const { updateSpace, createChannel, messageDB } = useMessageDB();

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      dismiss();
    }, 300);
  };

  // Check if channel has messages
  React.useEffect(() => {
    const checkMessages = async () => {
      if (channelId && messageDB) {
        try {
          const messages = await messageDB.getMessages({
            spaceId,
            channelId,
            limit: 1
          });
          setHasMessages(messages.messages.length > 0);
        } catch (error) {
          console.error('Error checking messages:', error);
        }
      }
    };
    checkMessages();
  }, [channelId, spaceId, messageDB]);

  const saveChanges = React.useCallback(async () => {
    if (channelId) {
      updateSpace({
        ...space!,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? g.channels.map((c) =>
                    c.channelId === channelId
                      ? {
                          ...c,
                          channelName: channelName,
                          channelTopic: channelTopic,
                          modifiedDate: Date.now(),
                        }
                      : c
                  )
                : g.channels,
          };
        }),
      });
    } else {
      const channelAddress = await createChannel(spaceId);
      updateSpace({
        ...space!,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels:
              groupName === g.groupName
                ? [
                    ...g.channels,
                    {
                      channelId: channelAddress,
                      spaceId: spaceId,
                      channelName: channelName,
                      channelTopic: channelTopic,
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                    } as Channel,
                  ]
                : g.channels,
          };
        }),
      });
    }
    handleDismiss();
  }, [space, channelName, channelTopic]);

  const deleteChannel = React.useCallback(async () => {
    if (channelId) {
      const updatedChannelId =
        space?.defaultChannelId == channelId
          ? (space.groups
              .find((g) => g.channels.find((c) => c.channelId != channelId))
              ?.channels.find((c) => c.channelId != channelId)?.channelId ??
            space.defaultChannelId)
          : space!.defaultChannelId;
      if (routeChannelId == channelId) {
        navigate('/spaces/' + spaceId + '/' + updatedChannelId);
      }
      updateSpace({
        ...space!,
        defaultChannelId: updatedChannelId,
        groups: space!.groups.map((g) => {
          return {
            ...g,
            channels: g.channels.filter((c) => c.channelId !== channelId),
          };
        }),
      });
      handleDismiss();
    }
  }, [space, channelName, channelTopic]);

  return (
    <div
      className={`modal-small-container${closing ? ' modal-small-closing' : ''}`}
    >
      <div className="modal-small-close-button" onClick={handleDismiss}>
        <FontAwesomeIcon icon={faTimes} />
      </div>
      <div className="modal-small-layout">
        <div className="modal-small-content">
          <div className="modal-content-section">
            <div className="modal-content-info">
              <div className="small-caps">
                <Trans>Channel Name</Trans>
              </div>
              <input
                className="w-full quorum-input"
                value={channelName}
                onChange={(e) =>
                  setChannelName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9\-]/gi, '')
                  )
                }
              />
            </div>
            <div className="modal-content-info">
              <div className="small-caps">
                <Trans>Channel Topic</Trans>
              </div>
              <input
                className="w-full quorum-input"
                value={channelTopic}
                onChange={(e) => setChannelTopic(e.target.value)}
              />
            </div>
            {hasMessages && showWarning && (
              <div className="error-label mb-3 relative pr-8">
                <Trans>Are you sure? This channel contains messages. Deleting it will cause all content to be lost forever!</Trans>
                <FontAwesomeIcon 
                  icon={faTimes} 
                  className="absolute top-2 right-2 cursor-pointer hover:opacity-70" 
                  onClick={() => setShowWarning(false)}
                />
              </div>
            )}
            <div className="modal-small-actions">
              {channelId && (
                <Button
                  type="danger"
                  onClick={() => {
                    if (deleteConfirmationStep === 0) {
                      setDeleteConfirmationStep(1);
                      if (hasMessages) {
                        setShowWarning(true);
                      }
                      // Reset confirmation after 5 seconds
                      setTimeout(
                        () => setDeleteConfirmationStep(0),
                        5000
                      );
                    } else {
                      deleteChannel();
                    }
                  }}
                >
                  {deleteConfirmationStep === 0 ? t`Delete Channel` : t`Click again to confirm`}
                </Button>
              )}
              <Button type="primary" onClick={() => saveChanges()}>
                <Trans>Save Changes</Trans>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelEditor;
