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
import { IconPicker } from '../space/IconPicker';
import ConfirmationModal from './ConfirmationModal';
import ModalSaveOverlay from './ModalSaveOverlay';
import '../../styles/_modal_common.scss';
import { useChannelManagement, useModalSaveState } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const ChannelEditorModal: React.FunctionComponent<{
  spaceId: string;
  groupName: string;
  channelId?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, channelId, dismiss }) => {

  // Modal save state for save operations only
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 10000, // 10 second failsafe for channel operations
    onSaveComplete: dismiss,
    onSaveError: (error) => {
      console.error('Save failed:', error);
    },
  });

  const {
    channelName,
    channelTopic,
    isReadOnly,
    managerRoleIds,
    isPinned,
    icon,
    iconColor,
    iconVariant,
    isEditMode,
    availableRoles,
    channelNameValidationError,
    channelTopicValidationError,
    canSave,
    handleChannelNameChange,
    handleChannelTopicChange,
    handleReadOnlyChange,
    handleManagerRolesChange,
    handlePinChange,
    handleIconChange,
    saveChanges,
    handleDeleteClick: originalHandleDeleteClick,
    deleteConfirmation,
  } = useChannelManagement({
    spaceId,
    groupName,
    channelId,
    onDeleteComplete: dismiss, // Needed for double-click delete (channels without messages)
  });

  const handleSave = React.useCallback(async () => {
    await saveUntilComplete(async () => {
      await saveChanges();
    });
  }, [saveChanges, saveUntilComplete]);

  // Use original delete handler (ConfirmationModal will handle its own overlay)
  const handleDeleteClick = originalHandleDeleteClick;


  return (
    <Modal
      title={isEditMode ? t`Edit Channel` : t`Add Channel`}
      visible={true}
      onClose={isSaving ? undefined : dismiss}
      size="small"
      closeOnBackdropClick={false}
      closeOnEscape={!isSaving}
    >
      {/* Loading overlay for save operations only */}
      <ModalSaveOverlay
        visible={isSaving}
        message={t`Saving...`}
      />
      <Container style={{ textAlign: 'left' }}>
        <Container className="mb-4 max-sm:mb-1">
          <Input
            value={channelName}
            onChange={handleChannelNameChange}
            label={t`Channel Name`}
            labelType="static"
            error={!!channelNameValidationError}
            errorMessage={channelNameValidationError}
          />
        </Container>
        <Container className="mb-4">
          <Input
            value={channelTopic}
            onChange={handleChannelTopicChange}
            label={t`Channel Topic`}
            labelType="static"
            error={!!channelTopicValidationError}
            errorMessage={channelTopicValidationError}
          />
        </Container>

        <Container className="mb-4">
          <FlexRow className="items-center gap-2">
            <IconPicker
              selectedIcon={icon}
              selectedIconColor={iconColor}
              selectedIconVariant={iconVariant}
              onIconSelect={handleIconChange}
              defaultIcon="hashtag"
            />
            <div className="text-label-strong">
              <Trans>Channel Icon</Trans>
            </div>
          </FlexRow>
        </Container>

        {isEditMode && (
          <Container className="mb-2 max-sm:mb-1">
            <FlexRow className="items-center justify-between">
              <div className="text-label-strong">
                <Trans>Pin to top</Trans>
              </div>
              <Switch
                value={isPinned}
                onChange={handlePinChange}
                accessibilityLabel={t`Pin channel to top`}
              />
            </FlexRow>
          </Container>
        )}

        <Container className="mb-2 max-sm:mb-1">
          <FlexRow className="items-center justify-between">
            <div className="text-label-strong">
              <Trans>Read only</Trans>
            </div>
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
              <FlexRow className="items-center">
                <div className="text-label-strong whitespace-nowrap max-sm:mb-2">
                  <Trans>Channel Managers</Trans>
                </div>
                <Tooltip
                  id="channel-managers-tooltip"
                  content={t`Select any existing role as managers for this channel. Managers have post, delete, and pin permissions on ANY message by default. If no managers are selected, only the Space owner can manage the channel.`}
                  place="bottom"
                  className="!w-[350px]"
                  maxWidth={350}
                >
                  <Icon
                    name="info-circle"
                    size="sm"
                    className="text-main hover:text-strong cursor-pointer ml-2 max-sm:mb-2"
                  />
                </Tooltip>
              </FlexRow>
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
          <Button type="primary" className="max-sm:w-full" onClick={handleSave} disabled={!canSave || isSaving}>
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
            <FlexCenter>
              <Text
                variant="danger"
                className="cursor-pointer hover:text-danger-hover"
                onClick={(e) => handleDeleteClick(e)}
              >
                {deleteConfirmation.confirmationStep === 0
                  ? t`Delete Channel`
                  : t`Click again to confirm`}
              </Text>
            </FlexCenter>
          </>
        )}
      </Container>
      
      {/* Channel delete confirmation modal (for channels with messages) */}
      {deleteConfirmation?.modalConfig && (
        <ConfirmationModal
          visible={deleteConfirmation.showModal}
          title={deleteConfirmation.modalConfig.title}
          message={deleteConfirmation.modalConfig.message}
          preview={deleteConfirmation.modalConfig.preview}
          confirmText={deleteConfirmation.modalConfig.confirmText}
          cancelText={deleteConfirmation.modalConfig.cancelText}
          variant={deleteConfirmation.modalConfig.variant}
          onConfirm={deleteConfirmation.modalConfig.onConfirm}
          onCancel={deleteConfirmation.modalConfig.onCancel}
        />
      )}
    </Modal>
  );
};

export default ChannelEditorModal;
