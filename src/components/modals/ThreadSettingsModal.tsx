import * as React from 'react';
import { t } from '@lingui/core/macro';
import {
  Modal,
  Container,
  Flex,
  Button,
  Spacer,
  Text,
  Select,
} from '../primitives';
import type { Message as MessageType } from '../../api/quorumApi';
import type { ThreadChannelProps } from '../context/ThreadContext';

// Auto-close preset options
const AUTO_CLOSE_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: String(60 * 60 * 1000), label: '1 hour' },
  { value: String(24 * 60 * 60 * 1000), label: '24 hours' },
  { value: String(3 * 24 * 60 * 60 * 1000), label: '3 days' },
  { value: String(7 * 24 * 60 * 60 * 1000), label: '1 week' },
];

interface ThreadSettingsModalProps {
  threadId: string;
  rootMessage: MessageType;
  threadMessages: MessageType[];
  channelProps: ThreadChannelProps | null;
  setThreadClosed?: (threadId: string, close: boolean) => Promise<void>;
  updateThreadSettings?: (threadId: string, autoCloseAfter: number | undefined) => Promise<void>;
  removeThread?: (threadId: string) => Promise<void>;
  visible: boolean;
  onClose: () => void;
}

export const ThreadSettingsModal: React.FC<ThreadSettingsModalProps> = ({
  threadId,
  rootMessage,
  threadMessages,
  channelProps,
  setThreadClosed,
  updateThreadSettings,
  removeThread,
  visible,
  onClose,
}) => {
  const [removeConfirmStep, setRemoveConfirmStep] = React.useState(0);

  const threadMeta = rootMessage.threadMeta;
  const isClosed = threadMeta?.isClosed ?? false;
  const currentAutoClose = threadMeta?.autoCloseAfter;

  const currentUserAddress = channelProps?.currentUserAddress;

  const isThreadAuthor = threadMeta?.createdBy === currentUserAddress;
  const canManage =
    isThreadAuthor ||
    (rootMessage && channelProps?.canDeleteMessages
      ? channelProps.canDeleteMessages(rootMessage)
      : false);

  const hasOtherReplies = React.useMemo(
    () => (threadMessages ?? []).some((m: MessageType) => (m.content as any).senderId !== currentUserAddress),
    [threadMessages, currentUserAddress]
  );

  const autoCloseValue = currentAutoClose ? String(currentAutoClose) : '0';

  const handleAutoCloseChange = async (value: string) => {
    const ms = parseInt(value, 10);
    await updateThreadSettings?.(threadId, ms === 0 ? undefined : ms);
  };

  const handleToggleClosed = async () => {
    await setThreadClosed?.(threadId, !isClosed);
    onClose();
  };

  const handleRemoveClick = async () => {
    if (removeConfirmStep === 0) {
      setRemoveConfirmStep(1);
      setTimeout(() => setRemoveConfirmStep(0), 5000);
      return;
    }
    await removeThread?.(threadId);
    onClose();
  };

  if (!canManage) return null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t`Thread Settings`}
      size="small"
    >
      <Container>
        <Flex direction="column">
          {/* Auto-close section */}
          <Flex direction="column" gap="sm" className="mb-3">
            <div className="text-label-strong">{t`Auto-close after`}</div>
            <Select
              value={autoCloseValue}
              options={AUTO_CLOSE_OPTIONS}
              onChange={(val: string | string[]) => handleAutoCloseChange(Array.isArray(val) ? val[0] : val)}
              fullWidth
              variant="bordered"
            />
          </Flex>

          <Spacer spaceBefore="md" spaceAfter="md" border direction="vertical" />

          {/* Close / Reopen section */}
          <Flex justify="center" align="center" className="mb-3">
            <Button type="primary" onClick={handleToggleClosed}>
              {isClosed ? t`Reopen Thread` : t`Close Thread`}
            </Button>
          </Flex>

          {/* Remove section — author only */}
          {isThreadAuthor && (
            <>
              <Spacer spaceBefore="md" spaceAfter="md" border direction="vertical" />
              <Flex justify="center" align="center">
                <Text
                  variant="danger"
                  className={`cursor-pointer hover:text-danger-hover${hasOtherReplies ? ' opacity-50 pointer-events-none' : ''}`}
                  onClick={hasOtherReplies ? undefined : handleRemoveClick}
                >
                  {removeConfirmStep === 0 ? t`Remove Thread` : t`Click again to confirm`}
                </Text>
              </Flex>
            </>
          )}
        </Flex>
      </Container>
    </Modal>
  );
};
