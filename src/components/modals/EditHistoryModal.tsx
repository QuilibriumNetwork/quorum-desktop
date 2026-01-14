import React, { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Modal, Text, Container, Flex, ScrollContainer, Spacer } from '../primitives';
import { Message as MessageType } from '../../api/quorumApi';
import { formatMessageDate } from '../../utils';

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
      <ScrollContainer height="lg" showBorder={false}>
        <Flex direction="column" gap="sm" padding="sm" className="pr-3">
          {editHistory.map((item, index) => {
            const text = Array.isArray(item.text) ? item.text.join('\n') : item.text;
            const isOriginal = item.modifiedDate === message.createdDate;

            return (
              <Container
                key={index}
                className={`
                  py-3 px-4
                  rounded-md
                  transition-all duration-150 ease-in-out
                  ${item.isCurrent
                    ? 'border border-accent bg-surface-0 hover:bg-surface-1'
                    : 'bg-surface-0 hover:bg-surface-1'
                  }
                `}
              >
                <Flex direction="column" gap="xs">
                  <Flex gap="sm" alignItems="center">
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
                  </Flex>
                  <Spacer
                    spaceBefore="xs"
                    spaceAfter="xs"
                    border={true}
                    direction="vertical"
                  />
                  <Text variant="body" size="sm" className="whitespace-pre-wrap break-words">
                    {text || t`(empty)`}
                  </Text>
                </Flex>
              </Container>
            );
          })}
        </Flex>
      </ScrollContainer>
    </Modal>
  );
};

