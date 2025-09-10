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
} from '../primitives';
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
      size="small"
    >
      <Container style={{ textAlign: 'left' }}>
        <Container className="mb-4 max-sm:mb-1">
          <Text className="small-caps">
            <Trans>Group Name</Trans>
          </Text>
          <Input value={group} onChange={handleGroupNameChange} />
        </Container>
        <FlexRow className="justify-end gap-2 mt-6 max-sm:flex-col max-sm:gap-4">
          <Button
            type="primary"
            className="max-sm:w-full"
            onClick={handleSave}
            disabled={!canSave}
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
            {hasMessages && showWarning && (
              <Container className="error-label mb-3 relative pr-8">
                <Trans>
                  Are you sure? This group contains channels with messages. Deleting
                  it will cause all content to be lost forever!
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
                  ? t`Delete Group`
                  : t`Click again to confirm`}
              </Text>
            </FlexCenter>
          </>
        )}
      </Container>
    </Modal>
  );
};

export default GroupEditor;
