import * as React from 'react';
import { Button } from '../primitives';
import '../../styles/_modal_common.scss';
import { useSpace } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate, useParams } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const GroupEditor: React.FunctionComponent<{
  spaceId: string;
  groupName?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, dismiss }) => {
  let { data: space } = useSpace({ spaceId });
  let [group, setGroup] = React.useState<string>(groupName || '');
  let { channelId } = useParams();
  let [deleteStatus, setDeleteStatus] = React.useState<boolean>(false);
  let [deleteConfirmationStep, setDeleteConfirmationStep] = React.useState(0);
  let [hasMessages, setHasMessages] = React.useState<boolean>(false);
  let [showWarning, setShowWarning] = React.useState<boolean>(false);
  let [closing, setClosing] = React.useState<boolean>(false);
  let navigate = useNavigate();
  const { updateSpace, messageDB } = useMessageDB();

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      dismiss();
    }, 300);
  };

  // Check if any channel in the group has messages
  React.useEffect(() => {
    const checkGroupMessages = async () => {
      if (groupName && space && messageDB) {
        try {
          const group = space.groups.find((g) => g.groupName === groupName);
          if (group) {
            for (const channel of group.channels) {
              const messages = await messageDB.getMessages({
                spaceId,
                channelId: channel.channelId,
                limit: 1,
              });
              if (messages.messages.length > 0) {
                setHasMessages(true);
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error checking group messages:', error);
        }
      }
    };
    checkGroupMessages();
  }, [groupName, space, spaceId, messageDB]);

  const saveChanges = React.useCallback(async () => {
    if (
      !space!.groups.find((g) => g.groupName === group) &&
      groupName !== group &&
      group !== ''
    ) {
      if (groupName) {
        updateSpace({
          ...space!,
          groups: space!.groups.map((g) => {
            return {
              ...g,
              groupName: groupName === g.groupName ? group : g.groupName,
            };
          }),
        });
      } else {
        updateSpace({
          ...space!,
          groups: [...space!.groups, { groupName: group, channels: [] }],
        });
      }
    }
    handleDismiss();
  }, [space, group]);

  const deleteGroup = React.useCallback(async () => {
    if (groupName) {
      const withoutGroup = space!.groups.filter(
        (g) => g.groupName !== groupName
      );
      const updatedChannelId = withoutGroup.find((g) =>
        g.channels.find((c) => c.channelId == space?.defaultChannelId)
      )
        ? space!.defaultChannelId
        : withoutGroup.length > 0 && withoutGroup[0].channels.length > 0
          ? withoutGroup[0].channels[0].channelId
          : space!.defaultChannelId;
      if (
        !withoutGroup.find((g) =>
          g.channels.find((c) => c.channelId == channelId)
        )
      ) {
        navigate('/spaces/' + space?.spaceId + '/' + updatedChannelId);
      }
      updateSpace({
        ...space!,
        defaultChannelId: updatedChannelId,
        groups: space!.groups.filter((g) => g.groupName !== groupName),
      });
    }
    handleDismiss();
  }, [space, group]);

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
                <Trans>Group Name</Trans>
              </div>
              <input
                className="w-full quorum-input"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              />
            </div>
            {hasMessages && showWarning && (
              <div className="error-label mb-3 relative pr-8">
                <Trans>
                  Are you sure? This group contains channels with messages.
                  Deleting it will cause all content to be lost forever!
                </Trans>
                <FontAwesomeIcon
                  icon={faTimes}
                  className="absolute top-2 right-2 cursor-pointer hover:opacity-70"
                  onClick={() => setShowWarning(false)}
                />
              </div>
            )}
            <div className="modal-small-actions">
              {groupName && (
                <Button
                  type="danger"
                  onClick={() => {
                    if (deleteConfirmationStep === 0) {
                      setDeleteConfirmationStep(1);
                      if (hasMessages) {
                        setShowWarning(true);
                      }
                      // Reset confirmation after 5 seconds
                      setTimeout(() => setDeleteConfirmationStep(0), 5000);
                    } else {
                      deleteGroup();
                    }
                  }}
                >
                  {deleteConfirmationStep === 0
                    ? t`Delete Group`
                    : t`Click again to confirm`}
                </Button>
              )}
              <Button type="primary" onClick={() => saveChanges()}>
                {t`Save Changes`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupEditor;
