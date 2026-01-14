import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Container,
  Flex,
  Text,
  Spacer,
} from '../primitives';
import { IconPicker } from '../space/IconPicker';
import ModalSaveOverlay from './ModalSaveOverlay';
import '../../styles/_modal_common.scss';
import { useFolderManagement } from '../../hooks/business/folders';
import { useModalSaveState } from '../../hooks/business/ui/useModalSaveState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface FolderEditorModalProps {
  folderId?: string;
  onClose: () => void;
}

const FolderEditorModal: React.FC<FolderEditorModalProps> = ({
  folderId,
  onClose,
}) => {
  const {
    name,
    icon,
    iconColor,
    iconVariant,
    isEditMode,
    canSave,
    validationError,
    deleteConfirmationStep,
    spaceCount,
    handleNameChange,
    handleIconChange,
    saveChanges,
    handleDeleteClick,
    deleteFolder,
  } = useFolderManagement({ folderId });

  // Modal save state hook (30s timeout for sync crypto operations)
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 30000,
    onSaveComplete: onClose,
    onSaveError: (error) => {
      console.error('[FolderEditorModal] Save error:', error);
    },
  });

  const handleSave = React.useCallback(async () => {
    await saveUntilComplete(async () => {
      await saveChanges();
    });
  }, [saveUntilComplete, saveChanges]);

  const handleDelete = React.useCallback(async () => {
    const confirmed = handleDeleteClick();
    if (!confirmed) return;

    await deleteFolder();
    onClose();
  }, [handleDeleteClick, deleteFolder, onClose]);

  return (
    <Modal
      title={isEditMode ? t`Edit Folder` : t`New Folder`}
      visible={true}
      onClose={isSaving ? undefined : onClose}
      closeOnBackdropClick={false}
      closeOnEscape={!isSaving}
      size="small"
    >
      <Container style={{ textAlign: 'left' }}>
        <Container className="mb-4 max-sm:mb-1">
          <Input
            value={name}
            onChange={handleNameChange}
            label={t`Folder Name`}
            labelType="static"
            error={!!validationError}
            errorMessage={validationError}
            maxLength={40}
          />
        </Container>

        <Container className="mb-4">
          <Flex className="items-center gap-2">
            <IconPicker
              selectedIcon={icon}
              selectedIconColor={iconColor}
              selectedIconVariant={iconVariant}
              onIconSelect={handleIconChange}
              mode="background-color"
            />
            <div className="text-label-strong">
              <Trans>Folder Icon & Color</Trans>
            </div>
          </Flex>
        </Container>

        <Flex className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          <Button
            type="primary"
            className="max-sm:w-full"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {t`Save Changes`}
          </Button>
        </Flex>

        {isEditMode && (
          <>
            <Spacer
              spaceBefore="lg"
              spaceAfter="md"
              border
              direction="vertical"
            />
            <Flex justify="center" align="center">
              <Text
                variant="danger"
                className="cursor-pointer hover:text-danger-hover"
                onClick={handleDelete}
              >
                {deleteConfirmationStep === 0
                  ? t`Delete Folder`
                  : t`Click again to confirm`}
              </Text>
            </Flex>
            {spaceCount > 0 && deleteConfirmationStep === 0 && (
              <Flex justify="center" align="center" className="mt-2">
                <Text variant="subtle" size="xs">
                  <Trans>Your Spaces will NOT be deleted</Trans>
                </Text>
              </Flex>
            )}
          </>
        )}
      </Container>

      {/* Modal save overlay */}
      <ModalSaveOverlay visible={isSaving} message={t`Saving...`} />
    </Modal>
  );
};

export default FolderEditorModal;
