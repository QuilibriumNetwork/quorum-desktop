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
  Tooltip,
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
          <Input 
            value={channelName} 
            onChange={handleChannelNameChange}
            label={t`Channel Name`}
            labelType="static"
          />
        </Container>
        <Container className="mb-4">
          <Input 
            value={channelTopic} 
            onChange={handleChannelTopicChange}
            label={t`Channel Topic`}
            labelType="static"
          />
        </Container>

        <Container className="mb-2 max-sm:mb-1">
          <FlexRow className="items-center justify-between">
            <FlexRow className="items-center">
              <Text className="modal-text-small text-main">
                <Trans>Read only</Trans>
              </Text>
              <Tooltip
                id="read-only-tooltip"
                content={t`Select any existing role as managers for this channel. Managers have post, delete, and pin permissions on ANY message by default. If no managers are selected, only the Space owner can manage the channel.`}
                place="bottom"
                className="!w-[350px]"
                maxWidth={350}
              >
                <Icon
                  name="info-circle"
                  size="sm"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                />
              </Tooltip>
            </FlexRow>
            <Switch
              value={isReadOnly}
              onChange={handleReadOnlyChange}
              accessibilityLabel={t`Read only channel`}
            />
          </FlexRow>
        </Container>

        {isReadOnly && (
          <Container className="mb-4 max-sm:mb-1">
            <FlexRow className="items-center justify-between max-sm:flex-col max-sm:items-stretch">
              <Text className="modal-text-small text-main whitespace-nowrap max-sm:mb-2">
                <Trans>Channel Managers</Trans>
              </Text>
              <Select
                value={managerRoleIds}
                options={availableRoles.map((role) => ({
                  value: role.roleId,
                  label: role.displayName,
                }))}
                onChange={handleManagerRolesChange}
                placeholder={t`Select Roles`}
                multiple={true}
                className="flex-1 max-w-xs max-sm:max-w-full"
              />
            </FlexRow>
          </Container>
        )}

        <FlexRow className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          <Button type="primary" className="max-sm:w-full" onClick={handleSave}>
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
