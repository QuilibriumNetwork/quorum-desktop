import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Icon,
  Container,
  FlexRow,
  Text,
} from '../primitives';
import '../../styles/_modal_common.scss';
import { useChannelManagement } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const ChannelEditor: React.FunctionComponent<{
  spaceId: string;
  groupName: string;
  channelId?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, channelId, dismiss }) => {
  const {
    channelName,
    channelTopic,
    hasMessages,
    showWarning,
    deleteConfirmationStep,
    isEditMode,
    handleChannelNameChange,
    handleChannelTopicChange,
    saveChanges,
    handleDeleteClick,
    setShowWarning,
  } = useChannelManagement({
    spaceId,
    groupName,
    channelId,
    onDeleteComplete: dismiss,
  });

  const handleSave = React.useCallback(async () => {
    await saveChanges();
    dismiss();
  }, [saveChanges, dismiss]);

  return (
    <Modal
      title={isEditMode ? t`Edit Channel` : t`Add Channel`}
      visible={true}
      onClose={dismiss}
      size="small"
    >
      <Container style={{ textAlign: 'left' }}>
        <Container className="mb-4 max-sm:mb-1">
          <Text className="small-caps">
            <Trans>Channel Name</Trans>
          </Text>
          <Input value={channelName} onChange={handleChannelNameChange} />
        </Container>
        <Container className="mb-4 max-sm:mb-1">
          <Text className="small-caps">
            <Trans>Channel Topic</Trans>
          </Text>
          <Input value={channelTopic} onChange={handleChannelTopicChange} />
        </Container>
        {hasMessages && showWarning && (
          <Container className="error-label mb-3 relative pr-8">
            <Trans>
              Are you sure? This channel contains messages. Deleting it will
              cause all content to be lost forever!
            </Trans>
            <Icon
              name="times"
              className="absolute top-2 right-2 cursor-pointer hover:opacity-70"
              onClick={() => setShowWarning(false)}
            />
          </Container>
        )}
        <FlexRow className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          {isEditMode && (
            <Button
              type="danger"
              className="max-sm:w-full max-sm:order-2"
              onClick={handleDeleteClick}
            >
              {deleteConfirmationStep === 0
                ? t`Delete Channel`
                : t`Click again to confirm`}
            </Button>
          )}
          <Button
            type="primary"
            className="max-sm:w-full max-sm:order-1"
            onClick={handleSave}
          >
            <Trans>Save Changes</Trans>
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default ChannelEditor;
