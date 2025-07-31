import * as React from 'react';
import { Button, Modal, Input, Icon, Container, FlexRow, Text } from '../primitives';
import '../../styles/_modal_common.scss';
import { useGroupManagement } from '../../hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const GroupEditor: React.FunctionComponent<{
  spaceId: string;
  groupName?: string;
  dismiss: () => void;
  onEditModeClick?: () => void;
}> = ({ spaceId, groupName, dismiss }) => {
  const {
    group,
    hasMessages,
    showWarning,
    deleteConfirmationStep,
    isEditMode,
    canSave,
    handleGroupNameChange,
    saveChanges,
    handleDeleteClick,
    setShowWarning,
  } = useGroupManagement({ spaceId, groupName, onDeleteComplete: dismiss });

  const handleSave = React.useCallback(async () => {
    await saveChanges();
    dismiss();
  }, [saveChanges, dismiss]);

  return (
    <Modal
      title={isEditMode ? t`Edit Group` : t`Add Group`}
      visible={true}
      onClose={dismiss}
    >
      <Container className="modal-body modal-width-medium" style={{ textAlign: 'left' }} data-small-modal>
        <Container className="modal-content-info max-sm:mb-1">
          <Text className="small-caps">
            <Trans>Group Name</Trans>
          </Text>
          <Input
            value={group}
            onChange={handleGroupNameChange}
          />
        </Container>
        {hasMessages && showWarning && (
          <Container className="error-label mb-3 relative pr-8">
            <Trans>
              Are you sure? This group contains channels with messages.
              Deleting it will cause all content to be lost forever!
            </Trans>
            <Icon
              name="times"
              className="absolute top-2 right-2 cursor-pointer hover:opacity-70"
              onClick={() => setShowWarning(false)}
            />
          </Container>
        )}
        <FlexRow className="justify-end gap-2 mt-4 max-sm:flex-col max-sm:gap-4">
          {isEditMode && (
            <Button
              type="danger"
              className="max-sm:w-full max-sm:order-2"
              onClick={handleDeleteClick}
            >
              {deleteConfirmationStep === 0
                ? t`Delete Group`
                : t`Click again to confirm`}
            </Button>
          )}
          <Button 
            type="primary" 
            className="max-sm:w-full max-sm:order-1"
            onClick={handleSave}
            disabled={!canSave}
          >
            {t`Save Changes`}
          </Button>
        </FlexRow>
      </Container>
    </Modal>
  );
};

export default GroupEditor;
