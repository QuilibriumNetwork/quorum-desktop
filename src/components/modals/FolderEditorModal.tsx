import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Container,
  FlexRow,
  FlexCenter,
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
  } = useFolderManagement({ folderId, onDeleteComplete: onClose });

  // Modal save state hook
  const { isSaving, saveUntilComplete } = useModalSaveState({
    maxTimeout: 10000,
    onSaveComplete: onClose,
  });

  const handleSave = React.useCallback(async () => {
    await saveUntilComplete(async () => {
      await saveChanges();
    });
  }, [saveUntilComplete, saveChanges]);

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
          <FlexRow className="items-center gap-2">
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
            <FlexCenter>
              <Text
                variant="danger"
                className="cursor-pointer hover:text-danger-hover"
                onClick={handleDeleteClick}
              >
                {deleteConfirmationStep === 0
                  ? t`Delete Folder`
                  : t`Click again to confirm`}
              </Text>
            </FlexCenter>
            {spaceCount > 0 && deleteConfirmationStep === 0 && (
              <FlexCenter className="mt-2">
                <Text variant="muted" size="xs">
                  <Trans>{spaceCount} spaces will be ungrouped</Trans>
                </Text>
              </FlexCenter>
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
