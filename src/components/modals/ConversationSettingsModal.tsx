import * as React from 'react';
import { useNavigate } from 'react-router';
import { t } from '@lingui/core/macro';
import { useMessageDB } from '../context/useMessageDB';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useConversations } from '../../hooks';
import { DefaultImages } from '../../utils';
import { Modal, Button, Switch, Icon, Tooltip } from '../primitives';

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

  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

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
      onClose();
    } catch {
      onClose();
    }
  }, [nonRepudiable, conversationId, messageDB, conversation, onClose]);

  const handleDeleteConversation = React.useCallback(async () => {
    await deleteConversation(conversationId);
    // Redirect to first conversation (excluding the deleted one) if exists, else /messages
    const list = (convPages?.pages || [])
      .flatMap((p: any) => p.conversations)
      .filter((c: any) => !!c)
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    const currentAddr = conversationId.split('/')[0];
    const next = list.find(
      (c: any) => (c.address || c.conversationId.split('/')[0]) !== currentAddr
    );
    if (next) {
      const addr = (next as any).address || next.conversationId.split('/')[0];
      navigate(`/messages/${addr}`);
    } else {
      navigate('/messages');
    }
    setConfirmingDelete(false);
    onClose();
  }, [deleteConversation, conversationId, convPages, navigate, onClose]);

  return (
    <>
      <Modal
        title={t`Conversation Settings`}
        visible={visible}
        onClose={onClose}
        size="medium"
      >
        <div className="modal-body">
          <div className="modal-content-info select-none cursor-default">
            <div className="flex flex-row justify-between">
              <div className="text-sm flex flex-row">
                <div className="text-sm flex flex-col justify-around">
                  {t`Require Message Signing`}
                </div>
                <div className="text-sm flex flex-col justify-around ml-2">
                  <Tooltip
                    id="conv-repudiability-tooltip"
                    content={t`Require messages sent in this Conversation to be signed by the sender. Technically speaking, this makes messages in this Conversation non-repudiable. The default for all Conversations can be changed in User Settings.`}
                    className="!w-[400px] !text-left"
                  >
                    <Icon name="info-circle" className="info-icon-tooltip" />
                  </Tooltip>
                </div>
              </div>
              <Switch
                value={!nonRepudiable}
                onChange={() => setNonRepudiable((prev) => !prev)}
              />
            </div>

            <div className="flex justify-end mt-4">
              <Button type="primary" onClick={saveRepudiability}>
                {t`Save`}
              </Button>
            </div>
          </div>

          <div className="modal-content-info select-none cursor-default text-left mt-8 pt-2 pb-4 px-4 rounded-lg border-2 border-dashed border-danger-hex">
            <div
              className="modal-text-label"
              style={{ color: 'var(--color-text-danger)' }}
            >{t`Delete Conversation`}</div>
            <div className="text-xs text-subtle mb-4">
              {t`Deletes conversation keys, user profile information, and messages on your computer only. These messages will still exist on the recipent's computer, so they must also delete on their end to complete a full deletion.`}
            </div>
            <div className="flex gap-3">
              <Button type="danger" onClick={() => setConfirmingDelete(true)}>
                {t`Delete`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {confirmingDelete && (
        <Modal
          title={t`Confirm Deletion`}
          visible={true}
          onClose={() => setConfirmingDelete(false)}
          size="medium"
        >
          <div className="modal-body">
            <div className="mb-6 text-sm text-subtle text-left max-sm:text-center">
              {t`This will delete this conversation forever on this device. Do you wish to proceed?`}
            </div>
            <div className="modal-buttons-responsive">
              <Button type="danger" onClick={handleDeleteConversation}>
                {t`Delete Forever`}
              </Button>
              <Button
                type="secondary"
                onClick={() => setConfirmingDelete(false)}
              >
                {t`Cancel`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ConversationSettingsModal;
