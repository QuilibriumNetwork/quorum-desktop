import * as React from 'react';
import { t } from '@lingui/core/macro';
import {
  Modal,
  Container,
  Flex,
  Button,
  Spacer,
  Select,
  Switch,
  Input,
} from '../primitives';
import type { Message as MessageType } from '../../api/quorumApi';
import type { ThreadChannelProps } from '../context/ThreadContext';

const THREAD_TITLE_MAX_CHARS = 100;

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
  updateTitle?: (targetMessageId: string, threadMeta: any, newTitle: string) => Promise<void>;
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
  updateTitle,
  setThreadClosed,
  updateThreadSettings,
  removeThread,
  visible,
  onClose,
}) => {
  const [deleteConfirmStep, setDeleteConfirmStep] = React.useState(0);

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

  // Pending state for all settings
  const initialTitle = threadMeta?.customTitle ?? '';
  const initialAutoClose = currentAutoClose ? String(currentAutoClose) : '0';
  const [pendingTitle, setPendingTitle] = React.useState(initialTitle);
  const [pendingAutoClose, setPendingAutoClose] = React.useState(initialAutoClose);
  const [pendingClosed, setPendingClosed] = React.useState(isClosed);

  const isDirty =
    pendingTitle !== initialTitle ||
    pendingAutoClose !== initialAutoClose ||
    pendingClosed !== isClosed;

  const handleSave = async () => {
    const titleChanged = pendingTitle !== initialTitle;
    const autoCloseChanged = pendingAutoClose !== initialAutoClose;
    const closedChanged = pendingClosed !== isClosed;

    if (titleChanged && updateTitle) {
      await updateTitle(rootMessage.messageId, threadMeta, pendingTitle.trim());
    }
    if (autoCloseChanged) {
      const ms = parseInt(pendingAutoClose, 10);
      await updateThreadSettings?.(threadId, ms === 0 ? undefined : ms);
    }
    if (closedChanged) {
      await setThreadClosed?.(threadId, pendingClosed);
    }
    onClose();
  };

  const handleDeleteClick = async () => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      setTimeout(() => setDeleteConfirmStep(0), 5000);
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
      <Container style={{ textAlign: 'left' }}>
        {/* Title — author only */}
        {isThreadAuthor && (
          <Container className="mb-4">
            <div className="text-label-strong mb-1">{t`Title`}</div>
            <Input
              value={pendingTitle}
              onChange={(val: string) => setPendingTitle(val.slice(0, THREAD_TITLE_MAX_CHARS))}
              placeholder={t`Thread title`}
              variant="bordered"
              error={pendingTitle.length >= THREAD_TITLE_MAX_CHARS}
              errorMessage={t`Title cannot exceed ${THREAD_TITLE_MAX_CHARS} characters`}
              className="w-full"
            />
          </Container>
        )}

        {/* Auto-close */}
        <Container className="mb-4">
          <div className="text-label-strong mb-1">{t`Auto-close after`}</div>
          <Select
            value={pendingAutoClose}
            options={AUTO_CLOSE_OPTIONS}
            onChange={(val: string | string[]) => setPendingAutoClose(Array.isArray(val) ? val[0] : val)}
            fullWidth
            variant="bordered"
          />
        </Container>

        {/* Close thread toggle */}
        <Container className="mb-4">
          <Flex align="center" gap="sm">
            <Switch
              value={pendingClosed}
              onChange={(val: boolean) => setPendingClosed(val)}
            />
            <span className="text-label">{t`Close thread`}</span>
          </Flex>
        </Container>

        {/* Save button */}
        <Flex className="justify-end gap-2 mt-6">
          <Button
            type="primary"
            onClick={handleSave}
            disabled={!isDirty}
            className="max-sm:w-full"
          >
            {t`Save Changes`}
          </Button>
        </Flex>

        {/* Delete section — show explanation to all managers, delete link to author only */}
        {(hasOtherReplies || isThreadAuthor) && (
          <>
            <Spacer spaceBefore="lg" spaceAfter="md" border direction="vertical" />
            <Flex justify="center" align="center">
              {hasOtherReplies ? (
                <span className="text-small text-center">
                  {t`This thread cannot be deleted because it contains messages from other users.`}
                </span>
              ) : (
                <Button
                  type="unstyled"
                  className="text-danger hover:text-danger-hover"
                  onClick={handleDeleteClick}
                >
                  {deleteConfirmStep === 0 ? t`Delete Thread` : t`Click again to confirm`}
                </Button>
              )}
            </Flex>
          </>
        )}
      </Container>
    </Modal>
  );
};
