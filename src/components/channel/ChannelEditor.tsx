import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Icon,
  Container,
  FlexRow,
  FlexCenter,
  Text,
  Spacer,
  Switch,
  Select,
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
    isReadOnly,
    managerRoleIds,
    hasMessages,
    showWarning,
    deleteConfirmationStep,
    isEditMode,
    availableRoles,
    handleChannelNameChange,
    handleChannelTopicChange,
    handleReadOnlyChange,
    handleManagerRolesChange,
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
        
        <Container className="mb-4 max-sm:mb-1">
          <FlexRow className="items-center gap-3">
            <Switch 
              value={isReadOnly} 
              onChange={handleReadOnlyChange}
              accessibilityLabel={t`Read only channel`}
            />
            <Text className="text-sm">
              <Trans>Read only?</Trans>
            </Text>
          </FlexRow>
        </Container>
        
        {isReadOnly && (
          <Container className="mb-4 max-sm:mb-1">
            <p className="text-xs text-subtle mb-4 leading-tight">
              <Trans>Select any existing role as managers for this channel. Managers have post, delete, and pin permissions on ANY message by default. If no managers are selected, only the Space owner can manage the channel.</Trans>
            </p>
            <Select
              value={managerRoleIds}
              options={availableRoles.map(role => ({
                value: role.roleId,
                label: role.displayName,
              }))}
              onChange={handleManagerRolesChange}
              placeholder={t`Select Roles`}
              multiple={true}
              className="w-full"
            />
          </Container>
        )}
        
        <FlexRow className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          <Button
            type="primary"
            className="max-sm:w-full"
            onClick={handleSave}
          >
            <Trans>Save Changes</Trans>
          </Button>
        </FlexRow>
        {isEditMode && (
          <>
            <Spacer 
              spaceBefore="lg" 
              spaceAfter="md"
              border 
              direction="vertical"
            />
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
            <FlexCenter>
              <Text 
                variant="danger"
                className="cursor-pointer hover:text-danger-hover" 
                onClick={handleDeleteClick}
              >
                {deleteConfirmationStep === 0
                  ? t`Delete Channel`
                  : t`Click again to confirm`}
              </Text>
            </FlexCenter>
          </>
        )}
      </Container>
    </Modal>
  );
};

export default ChannelEditor;
