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
  Callout,
} from '../primitives';
import { IconPicker } from '../space/IconPicker';
import ModalSaveOverlay from './ModalSaveOverlay';
import '../../styles/_modal_common.scss';
import { useGroupManagement } from '../../hooks';
import { useModalSaveState } from '../../hooks/business/ui/useModalSaveState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const GroupEditorModal: React.FunctionComponent<{
  spaceId: string;
  groupName?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, dismiss }) => {
  const {
    group,
    icon,
    iconColor,
    channelCount,
    showChannelError,
    deleteConfirmationStep,
    isEditMode,
    canSave,
    validationError,
    handleGroupNameChange,
    handleIconChange,
    saveChanges,
    handleDeleteClick,
    setShowChannelError,
  } = useGroupManagement({ spaceId, groupName, onDeleteComplete: dismiss });

  // Modal save state hook
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 10000, // 10 second failsafe for group operations
    onSaveComplete: dismiss,
  });

  const handleSave = React.useCallback(async () => {
    await saveUntilComplete(async () => {
      await saveChanges();
    });
  }, [saveUntilComplete, saveChanges]);

  return (
    <Modal
      title={isEditMode ? t`Edit Group` : t`Add Group`}
      visible={true}
      onClose={isSaving ? undefined : dismiss}
      closeOnBackdropClick={false}
      closeOnEscape={!isSaving}
      size="small"
    >
      <Container style={{ textAlign: 'left' }}>
        <Container className="mb-4 max-sm:mb-1">
          <Input
            value={group}
            onChange={handleGroupNameChange}
            label={t`Group Name`}
            labelType="static"
            error={!!validationError}
            errorMessage={validationError}
          />
        </Container>

        <Container className="mb-4">
          <FlexRow className="items-center gap-2">
            <IconPicker
              selectedIcon={icon}
              selectedIconColor={iconColor}
              onIconSelect={handleIconChange}
            />
            <div className="text-label-strong">
              <Trans>Group Icon (optional)</Trans>
            </div>
          </FlexRow>
        </Container>
        <FlexRow className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          <Button
            type="primary"
            className="max-sm:w-full"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {t`Save Changes`}
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
            {showChannelError && (
              <Callout
                variant="error"
                size="sm"
                className="mb-3"
                dismissible={true}
                onClose={() => setShowChannelError(false)}
              >
                <Trans>
                  You cannot delete a group that contains channels. Delete all {channelCount} channels in this group first.
                </Trans>
              </Callout>
            )}
            <FlexCenter>
              <Text
                variant="danger"
                className="cursor-pointer hover:text-danger-hover"
                onClick={handleDeleteClick}
              >
                {deleteConfirmationStep === 0
                  ? t`Delete Group`
                  : t`Click again to confirm`}
              </Text>
            </FlexCenter>
          </>
        )}
      </Container>

      {/* Modal save overlay */}
      <ModalSaveOverlay visible={isSaving} message={t`Saving...`} />
    </Modal>
  );
};

export default GroupEditorModal;
