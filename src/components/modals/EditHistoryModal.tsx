import React, { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Modal, Text, Container, FlexColumn, FlexRow } from '../primitives';
import { Message as MessageType } from '../../api/quorumApi';
import { formatMessageDate } from '../../utils';
import './EditHistoryModal.scss';

interface EditHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  message: MessageType;
}

interface EditHistoryItem {
  text: string | string[];
  modifiedDate: number;
  lastModifiedHash: string;
  isCurrent: boolean;
}

export const EditHistoryModal: React.FC<EditHistoryModalProps> = ({
  visible,
  onClose,
  message,
}) => {
  // Build edit history list with current message at the top, then edits in chronological order (oldest to newest)
  const editHistory = useMemo(() => {
    const history: EditHistoryItem[] = [];

    // Add previous edits first (oldest first)
    if (message.edits && message.edits.length > 0) {
      // Edits are stored oldest first, so we can use them as-is
      message.edits.forEach((edit) => {
        history.push({
          text: edit.text,
          modifiedDate: edit.modifiedDate,
          lastModifiedHash: edit.lastModifiedHash,
          isCurrent: false,
        });
      });
    }

    // Add current message state last (most recent)
    if (message.content.type === 'post') {
      history.push({
        text: message.content.text,
        modifiedDate: message.modifiedDate,
        lastModifiedHash: message.lastModifiedHash || message.nonce,
        isCurrent: true,
      });
    }

    // History is now in chronological order (oldest to newest)
    return history;
  }, [message]);

  return (
    <Modal
      title={t`Edit History`}
      visible={visible}
      onClose={onClose}
      size="medium"
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <Container className="edit-history-modal-content">
        <FlexColumn gap="sm">
          {editHistory.map((item, index) => {
            const text = Array.isArray(item.text) ? item.text.join('\n') : item.text;
            const isOriginal = item.modifiedDate === message.createdDate;

            return (
              <Container key={index} className={`edit-history-item ${item.isCurrent ? 'edit-history-item-current' : ''}`}>
                <FlexColumn gap="xs">
                  <FlexRow gap="sm" alignItems="center">
                    <Text variant="subtle" size="sm" weight="medium">
                      {item.isCurrent
                        ? t`Current`
                        : isOriginal
                        ? t`Original`
                        : t`Edit ${index + 1}`}
                    </Text>
                    <Text variant="subtle" size="xs">
                      {formatMessageDate(item.modifiedDate)}
                    </Text>
                  </FlexRow>
                  <Container className="edit-history-item-text">
                    <Text variant="body" size="sm">
                      {text || t`(empty)`}
                    </Text>
                  </Container>
                </FlexColumn>
              </Container>
            );
          })}
        </FlexColumn>
      </Container>
    </Modal>
  );
};

