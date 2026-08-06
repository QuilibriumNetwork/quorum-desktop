import * as React from 'react';
import { Button, Callout, Icon, Spacer } from '../../primitives';
import { t } from '@lingui/core/macro';
import { useMessageDB } from '../../context/useMessageDB';
import { useConfirmation } from '../../../hooks/ui/useConfirmation';
import ConfirmationModal from '../ConfirmationModal';

interface HelpProps {
  isRestoring?: boolean;
  onRestoreMissingSpaces?: () => void;
}

const Help: React.FunctionComponent<HelpProps> = ({
  isRestoring = false,
  onRestoreMissingSpaces,
}) => {
  // Global "Fix DM Encryption" — resets the ratchet for every DM at once,
  // matching mobile's account-level action. The per-conversation equivalent
  // lives in ConversationSettingsModal; this is the same operation fanned out,
  // for when the user cannot tell which conversation is stuck.
  const { resetAllDirectMessageSessions } = useMessageDB();
  const [resetSuccess, setResetSuccess] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);

  const resetConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false,
    modalConfig: {
      title: t`Fix DM Encryption`,
      message: t`This will reset the encryption sessions for all your DM conversations. Your next message to each contact will establish a fresh secure connection.\n\nUse this if messages are failing to send or decrypt.`,
      confirmText: t`Reset All`,
      cancelText: t`Cancel`,
      variant: 'warning',
    },
  });

  const handleResetAllClick = (e: React.MouseEvent) => {
    if (resetConfirmation.isConfirming) return;
    setResetSuccess(false);
    setResetError(null);
    resetConfirmation.handleClick(e, async () => {
      try {
        await resetAllDirectMessageSessions();
        setResetSuccess(true);
      } catch (error: any) {
        console.error('Failed to reset DM encryption sessions:', error);
        setResetError(error?.message || t`Failed to reset encryption sessions`);
      }
    });
  };

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title flex items-center gap-2">
            <Icon name="support" size="lg" />
            {t`Get Help Using Quorum`}
          </div>
          <div className="pt-2 text-body">
            {t`Find documentation, keyboard shortcuts, and recovery tools.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        {/* Documentation Section */}
        <div className="text-subtitle-2 mb-2">{t`Documentation`}</div>
        <div className="modal-content-info">
          <div className="flex items-center justify-center p-6 rounded-md border border-dashed border-surface-7">
            <div className="text-main text-sm">{t`Coming soon`}</div>
          </div>
        </div>

        {/* Keyboard Shortcuts Section */}
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">{t`Keyboard Shortcuts`}</div>
        <div className="modal-content-info">
          <div className="flex flex-col text-sm">
            <div className="flex justify-between items-center py-2">
              <span>{t`Delete message without confirmation`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">{t`Shift + Click`}</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-5">
              <span>{t`Pin/Unpin without confirmation`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">{t`Shift + Click`}</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-5">
              <span>{t`Bold`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">Ctrl/Cmd + B</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-5">
              <span>{t`Italic`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">Ctrl/Cmd + I</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-5">
              <span>{t`Strikethrough`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">Ctrl/Cmd + Shift + X</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-5">
              <span>{t`Inline Code`}</span>
              <kbd className="px-2 py-1 bg-surface-0 rounded text-xs font-mono">Ctrl/Cmd + Shift + M</kbd>
            </div>
          </div>
        </div>

        {/* Fix DM Encryption Section */}
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">{t`Fix DM Encryption`}</div>
        <div className="modal-content-info">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 p-3 rounded-md border">
              <div className="text-sm" style={{ lineHeight: 1.3 }}>
                {t`Reset your DM encryption sessions if messages are failing to send or decrypt.`}
              </div>
              <Button
                type="secondary"
                size="small"
                className="whitespace-nowrap"
                onClick={handleResetAllClick}
                disabled={resetConfirmation.isConfirming}
              >
                {resetConfirmation.isConfirming ? t`Resetting...` : t`Reset`}
              </Button>
            </div>
            {resetSuccess && (
              <Callout
                variant="success"
                size="sm"
                dismissible
                onClose={() => setResetSuccess(false)}
              >
                <div>
                  <div className="font-medium">{t`Encryption Reset`}</div>
                  <div className="text-sm mt-1">
                    {t`Your next message to each contact will establish a fresh secure connection.`}
                  </div>
                </div>
              </Callout>
            )}
            {resetError && (
              <Callout
                variant="error"
                size="sm"
                dismissible
                onClose={() => setResetError(null)}
              >
                <div className="text-sm">{resetError}</div>
              </Callout>
            )}
          </div>
        </div>

        {/* Data Recovery Section */}
        {onRestoreMissingSpaces && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="text-subtitle-2 mb-2">{t`Data Recovery`}</div>
            <div className="modal-content-info">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3 p-3 rounded-md border">
                  <div className="text-sm" style={{ lineHeight: 1.3 }}>
                    {t`Restore Spaces that exist on this device but are missing from your navigation menu.`}
                  </div>
                  <Button
                    type="secondary"
                    size="small"
                    className="whitespace-nowrap"
                    onClick={onRestoreMissingSpaces}
                    disabled={isRestoring}
                  >
                    {isRestoring ? t`Restoring...` : t`Restore`}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirmation for the global DM encryption reset */}
      {resetConfirmation.modalConfig && (
        <ConfirmationModal
          visible={resetConfirmation.showModal}
          title={resetConfirmation.modalConfig.title}
          message={resetConfirmation.modalConfig.message}
          confirmText={resetConfirmation.modalConfig.confirmText}
          cancelText={resetConfirmation.modalConfig.cancelText}
          variant={resetConfirmation.modalConfig.variant}
          showProtip={false}
          busy={resetConfirmation.isConfirming}
          busyMessage={t`Resetting...`}
          onConfirm={resetConfirmation.modalConfig.onConfirm}
          onCancel={resetConfirmation.modalConfig.onCancel}
        />
      )}
    </>
  );
};

export default Help;
