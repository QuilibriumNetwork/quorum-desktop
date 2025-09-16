import * as React from 'react';
import { useNavigate } from 'react-router';
import { t } from '@lingui/core/macro';
import { useMessageDB } from '../context/useMessageDB';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useConversations } from '../../hooks';
import { DefaultImages } from '../../utils';
import {
  Modal,
  Container,
  FlexColumn,
  FlexRow,
  FlexBetween,
  FlexCenter,
  Button,
  Switch,
  Icon,
  Tooltip,
  Spacer,
  Text,
} from '../primitives';
import { useQueryClient } from '@tanstack/react-query';
import { buildConversationKey } from '../../hooks/queries/conversation/buildConversationKey';
import { useConfirmation } from '../../hooks/ui/useConfirmation';
import ConfirmationModal from './ConfirmationModal';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';

type ConversationSettingsModalProps = {
  conversationId: string;
  onClose: () => void;
  visible: boolean;
};

const ConversationSettingsModal: React.FC<ConversationSettingsModalProps> = ({
  conversationId,
  onClose,
  visible,
}) => {
  const { data: conversation } = useConversation({ conversationId });
  const { messageDB, getConfig, keyset, deleteConversation } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const navigate = useNavigate();
  const { data: convPages } = useConversations({ type: 'direct' });
  const queryClient = useQueryClient();

  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);

  // Confirmation hook for conversation delete
  const deleteConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false, // Disable shift bypass for conversation deletion
    modalConfig: conversation
      ? {
          title: t`Delete Conversation`,
          message: t`Are you sure you want to delete this conversation?\n\nThis will delete the conversation from your device only. The other participant will still have access to the conversation history.`,
          preview: undefined, // No preview for conversation deletion
          confirmText: t`Delete`,
          cancelText: t`Cancel`,
          variant: 'danger',
        }
      : undefined,
  });
  React.useEffect(() => {
    (async () => {
      try {
        const convIsRepudiable = conversation?.conversation?.isRepudiable;
        if (typeof convIsRepudiable !== 'undefined') {
          setNonRepudiable(!convIsRepudiable);
        } else {
          const [spaceId] = conversationId.split('/');
          const cfg = await getConfig({
            address: spaceId,
            userKey: keyset.userKeyset,
          });
          setNonRepudiable(cfg?.nonRepudiable ?? true);
        }
      } catch {
        setNonRepudiable(true);
      }
    })();
  }, [
    conversation?.conversation?.isRepudiable,
    conversationId,
    getConfig,
    keyset.userKeyset,
  ]);

  const saveRepudiability = React.useCallback(async () => {
    try {
      const existing = await messageDB.getConversation({ conversationId });
      const baseConv = existing.conversation ?? {
        conversationId,
        address: conversationId.split('/')[0],
        icon: conversation?.conversation?.icon || DefaultImages.UNKNOWN_USER,
        displayName: conversation?.conversation?.displayName || t`Unknown User`,
        type: 'direct' as const,
        timestamp: Date.now(),
      };
      await messageDB.saveConversation({
        ...baseConv,
        isRepudiable: !nonRepudiable,
      });

      // Invalidate conversation query to update DirectMessage component
      await queryClient.invalidateQueries({
        queryKey: buildConversationKey({ conversationId }),
      });

      onClose();
    } catch {
      onClose();
    }
  }, [
    nonRepudiable,
    conversationId,
    messageDB,
    conversation,
    onClose,
    queryClient,
  ]);

  const handleDeleteClick = React.useCallback(
    async (e: React.MouseEvent) => {
      const performDelete = async () => {
        await deleteConversation(conversationId, currentPasskeyInfo);
        const list = (convPages?.pages || [])
          .flatMap((p: any) => p.conversations)
          .filter((c: any) => !!c)
          .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        const currentAddr = conversationId.split('/')[0];
        const next = list.find(
          (c: any) =>
            (c.address || c.conversationId.split('/')[0]) !== currentAddr
        );
        if (next) {
          const addr =
            (next as any).address || next.conversationId.split('/')[0];
          navigate(`/messages/${addr}`);
        } else {
          navigate('/messages');
        }
        onClose();
      };

      deleteConfirmation.handleClick(e, performDelete);
    },
    [
      deleteConfirmation,
      deleteConversation,
      conversationId,
      convPages,
      navigate,
      onClose,
    ]
  );

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!visible) {
      deleteConfirmation.reset();
    }
  }, [visible, deleteConfirmation]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t`Conversation Settings`}
      size="small"
    >
      <Container>
        <FlexColumn gap="md">
          <FlexBetween align="center">
            <FlexRow gap="sm" align="center">
              <Text variant="default" size="sm">
                {t`Always sign messages`}
              </Text>
              <Tooltip
                id="conv-repudiability-tooltip"
                content={t`Always sign messages sent in this conversation. Technically speaking, this makes your messages in non-repudiable. The default for all conversations can be changed in User Settings.`}
                maxWidth={260}
                className="!text-left !max-w-[260px]"
                place="top"
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </FlexRow>
            <Switch
              value={nonRepudiable}
              onChange={() => setNonRepudiable((prev) => !prev)}
            />
          </FlexBetween>

          <Spacer size="sm" />

          <FlexRow justify="end">
            <Button type="primary" onClick={saveRepudiability} disabled={deleteConfirmation.isConfirming}>
              {t`Save`}
            </Button>
          </FlexRow>
        </FlexColumn>

        <Spacer spaceBefore="lg" spaceAfter="md" border direction="vertical" />

        {/* Delete Section */}
        <FlexCenter>
          <Text
            variant="danger"
            className="cursor-pointer hover:text-danger-hover"
            onClick={(e: React.MouseEvent) => {
              if (!deleteConfirmation.isConfirming) handleDeleteClick(e);
            }}
          >
            {t`Delete Conversation`}
          </Text>
        </FlexCenter>
      </Container>

      {/* Delete confirmation modal */}
      {deleteConfirmation?.modalConfig && (
        <ConfirmationModal
          visible={deleteConfirmation.showModal}
          title={deleteConfirmation.modalConfig.title}
          message={deleteConfirmation.modalConfig.message}
          preview={deleteConfirmation.modalConfig.preview}
          confirmText={deleteConfirmation.modalConfig.confirmText}
          cancelText={deleteConfirmation.modalConfig.cancelText}
          variant={deleteConfirmation.modalConfig.variant}
          showProtip={false}
          busy={deleteConfirmation.isConfirming}
          onConfirm={deleteConfirmation.modalConfig.onConfirm}
          onCancel={deleteConfirmation.modalConfig.onCancel}
        />
      )}
    </Modal>
  );
};

export default ConversationSettingsModal;
