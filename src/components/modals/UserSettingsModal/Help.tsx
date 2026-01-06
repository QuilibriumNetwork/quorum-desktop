import * as React from 'react';
import { Button, Spacer } from '../../primitives';
import { t } from '@lingui/core/macro';

interface HelpProps {
  isRestoring?: boolean;
  onRestoreMissingSpaces?: () => void;
}

const Help: React.FunctionComponent<HelpProps> = ({
  isRestoring = false,
  onRestoreMissingSpaces,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title">{t`Get Help Using Quorum`}</div>
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
    </>
  );
};

export default Help;
