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
  Button, 
  Switch, 
  Icon, 
  Tooltip, 
  Spacer,
  Text
} from '../primitives';
import { useQueryClient } from '@tanstack/react-query';
import { buildConversationKey } from '../../hooks/queries/conversation/buildConversationKey';

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
  const navigate = useNavigate();
  const { data: convPages } = useConversations({ type: 'direct' });
  const queryClient = useQueryClient();

  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);
  const [confirmationStep, setConfirmationStep] = React.useState<number>(0);
  const [confirmationTimeout, setConfirmationTimeout] =
    React.useState<NodeJS.Timeout | null>(null);

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

  const handleDeleteClick = React.useCallback(async () => {
    if (confirmationStep === 0) {
      // First click - show confirmation
      setConfirmationStep(1);
      // Reset confirmation after 5 seconds
      const timeout = setTimeout(() => setConfirmationStep(0), 5000);
      setConfirmationTimeout(timeout);
    } else {
      // Second click - execute deletion
      // Clear the timeout since we're confirming
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
        setConfirmationTimeout(null);
      }
      await deleteConversation(conversationId);
      // Redirect to first conversation (excluding the deleted one) if exists, else /messages
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
        const addr = (next as any).address || next.conversationId.split('/')[0];
        navigate(`/messages/${addr}`);
      } else {
        navigate('/messages');
      }
      setConfirmationStep(0);
      onClose();
    }
  }, [
    confirmationStep,
    confirmationTimeout,
    deleteConversation,
    conversationId,
    convPages,
    navigate,
    onClose,
  ]);

  // Reset confirmation when modal closes
  React.useEffect(() => {
    if (!visible) {
      setConfirmationStep(0);
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
        setConfirmationTimeout(null);
      }
    }
  }, [visible, confirmationTimeout]);

  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (confirmationTimeout) {
        clearTimeout(confirmationTimeout);
      }
    };
  }, [confirmationTimeout]);

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
                <Icon
                  name="info-circle"
                  size="sm"
                />
              </Tooltip>
            </FlexRow>
            <Switch
              value={nonRepudiable}
              onChange={() => setNonRepudiable((prev) => !prev)}
            />
          </FlexBetween>

          <Spacer 
            spaceBefore="sm" 
            spaceAfter="sm" 
            border={true} 
            direction="vertical" 
          />
          
          <FlexRow justify="end">
            <Button type="primary" onClick={saveRepudiability}>
              {t`Save`}
            </Button>
          </FlexRow>
        </FlexColumn>

        <Spacer size="lg" />

        {/* Delete Section */}
        <Container
          padding="md"
          style={{ 
            borderRadius: 8, 
            border: '2px dashed var(--color-text-danger)'
          }}
        >
          <FlexColumn gap="md">
            <Text variant="error" weight="semibold">
              {t`Delete Conversation`}
            </Text>
            <Text variant="subtle" size="xs">
              {t`Deletes conversation keys, user profile information, and messages on your computer only. These messages will still exist on the recipent's computer, so they must also delete on their end to complete a full deletion.`}
            </Text>
            <FlexRow>
              <Button type="danger" onClick={handleDeleteClick}>
                {confirmationStep === 0 ? t`Delete` : t`Click again to confirm`}
              </Button>
            </FlexRow>
          </FlexColumn>
        </Container>
      </Container>
    </Modal>
  );
};

export default ConversationSettingsModal;
