import * as React from 'react';
import { Button, Icon, Tooltip, Spacer, ScrollContainer, Callout } from '../../primitives';
import { t } from '@lingui/core/macro';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { QRCodeSVG } from 'qrcode.react';
import { getDeviceName } from '../../../utils/deviceInfo';
import { formatAddress } from '@quilibrium/quorum-shared';
import { useDeviceNameValidation } from '../../../hooks/business/validation';
import { ClickToCopyContent } from '../../ui';
import {
  copySensitiveText,
  SENSITIVE_CLIPBOARD_CLEAR_MS,
  type SensitiveCopyMode,
} from '../../../utils/clipboardSecurity';

interface SecurityProps {
  stagedRegistration: any;
  keyset: any;
  removeDevice: (key: string) => void;
  downloadKey: () => void;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<{ messagesWritten: number; conversationsWritten: number }>;
  getPrivateKeyHex?: () => Promise<string>;
  removedDevices?: string[];
  deviceNames?: { [inboxAddress: string]: string };
  saveDeviceName?: (name: string) => Promise<void>;
}

const Security: React.FunctionComponent<SecurityProps> = ({
  stagedRegistration,
  keyset,
  removeDevice,
  downloadKey,
  exportBackup,
  importBackup,
  getPrivateKeyHex,
  removedDevices = [],
  deviceNames = {},
  saveDeviceName,
}) => {
  // QR code display state - requires explicit user confirmation
  const [showQRConfirmation, setShowQRConfirmation] = React.useState(false);
  const [showQRCode, setShowQRCode] = React.useState(false);
  const [privateKeyHex, setPrivateKeyHex] = React.useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = React.useState(false);

  // Copy-private-key state - requires explicit user confirmation, mirrors the QR reveal.
  // copyMode records HOW the copy was performed: 'auto-clear' (Electron main
  // process guarantees the 60s clear) vs 'best-effort' (plain web build, where
  // an unfocused page cannot touch the clipboard) — the success message
  // adapts so we never promise a clear we can't deliver.
  const [showCopyConfirmation, setShowCopyConfirmation] = React.useState(false);
  const [isCopyingKey, setIsCopyingKey] = React.useState(false);
  const [copyMode, setCopyMode] = React.useState<SensitiveCopyMode | null>(null);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  // Purely cosmetic: hides the success callout; the actual clipboard clearing
  // is owned by copySensitiveText (main process or module-level web fallback).
  const copySuccessHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Backup state
  const [isExportingBackup, setIsExportingBackup] = React.useState(false);
  const [isImportingBackup, setIsImportingBackup] = React.useState(false);
  const [backupError, setBackupError] = React.useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-hide QR code after 60 seconds for security
  React.useEffect(() => {
    if (showQRCode) {
      const timer = setTimeout(() => {
        setShowQRCode(false);
        setPrivateKeyHex(null);
        setShowQRConfirmation(false);
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [showQRCode]);

  const handleShowQRClick = () => {
    setShowQRConfirmation(true);
  };

  const handleConfirmShowQR = async () => {
    if (!getPrivateKeyHex) return;

    setIsLoadingKey(true);
    try {
      const keyHex = await getPrivateKeyHex();
      setPrivateKeyHex(keyHex);
      setShowQRCode(true);
      setShowQRConfirmation(false);
    } catch (error) {
      console.error('Failed to get private key:', error);
    } finally {
      setIsLoadingKey(false);
    }
  };

  const handleHideQR = () => {
    setShowQRCode(false);
    setPrivateKeyHex(null);
    setShowQRConfirmation(false);
  };

  // Hide the copy-success callout timer on unmount (the clipboard clearing
  // itself lives outside this component and is unaffected).
  React.useEffect(() => {
    return () => {
      if (copySuccessHideTimerRef.current) clearTimeout(copySuccessHideTimerRef.current);
    };
  }, []);

  const handleCopyKeyClick = () => {
    setCopyMode(null);
    setCopyError(null);
    setShowCopyConfirmation(true);
  };

  const handleConfirmCopyKey = async () => {
    if (!getPrivateKeyHex) return;

    setIsCopyingKey(true);
    setCopyError(null);
    try {
      const keyHex = await getPrivateKeyHex();
      const mode = await copySensitiveText(keyHex);
      setShowCopyConfirmation(false);
      setCopyMode(mode);

      // Hide the success callout when the auto-clear window elapses.
      if (copySuccessHideTimerRef.current) clearTimeout(copySuccessHideTimerRef.current);
      copySuccessHideTimerRef.current = setTimeout(() => {
        setCopyMode(null);
      }, SENSITIVE_CLIPBOARD_CLEAR_MS);
    } catch (error: any) {
      console.error('Failed to copy private key:', error);
      setCopyError(error?.message || t`Failed to copy private key`);
      setShowCopyConfirmation(false);
    } finally {
      setIsCopyingKey(false);
    }
  };

  const handleCancelCopy = () => {
    setShowCopyConfirmation(false);
  };

  // Device rename state
  const [editingDevice, setEditingDevice] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const { error: nameError, isValid: nameIsValid } = useDeviceNameValidation(editValue);

  const startEdit = async (inboxAddress: string, currentName: string | undefined) => {
    const suggested = currentName ?? await getDeviceName();
    setEditValue(suggested);
    setEditingDevice(inboxAddress);
  };

  const [isSavingName, setIsSavingName] = React.useState(false);

  const confirmEdit = async () => {
    if (!nameIsValid || !editingDevice || !saveDeviceName) return;
    setIsSavingName(true);
    try {
      await saveDeviceName(editValue.trim());
      setEditingDevice(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save device name:', error);
    } finally {
      setIsSavingName(false);
    }
  };

  const cancelEdit = () => {
    setEditingDevice(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') { cancelEdit(); }
  };

  const isBackupBusy = isExportingBackup || isImportingBackup;

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      await exportBackup();
    } catch (error: any) {
      console.error('Backup export failed:', error);
      setBackupError(error.message || t`Failed to export backup`);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    e.target.value = '';

    setIsImportingBackup(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const result = await importBackup(file);
      setBackupSuccess(
        t`Restored ${result.messagesWritten} messages and ${result.conversationsWritten} conversations.`
      );
    } catch (error: any) {
      console.error('Backup import failed:', error);
      setBackupError(error.message || t`Failed to import backup`);
    } finally {
      setIsImportingBackup(false);
    }
  };

  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="text-title flex items-center gap-2">
            <Icon name="shield" size="lg" />
            {t`Security`}
          </div>
          <div className="pt-2 text-body">
            {t`Manage authorized devices, key export, mobile import, and encrypted message backups.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2 flex items-center">
          {t`Authorized Devices`}
          <Tooltip
            id="settings-authorized-devices-tooltip"
            content={t`Devices currently authorized to receive new messages on your account. Removing a device stops new messages from reaching it. It does not log the device out or delete its local data.`}
            place="bottom"
          >
            <Icon
              name="info-circle"
              className="text-main hover:text-strong cursor-pointer ml-2"
              size="sm"
            />
          </Tooltip>
        </div>
        {removedDevices.length > 0 && (
          <div className="bg-warning/10 border border-warning/20 rounded p-2 mb-2 text-sm text-warning">
            <Icon name="warning" className="mr-1" />
{removedDevices.length === 1
              ? t`1 device marked for removal. Click "Save Changes" to confirm.`
              : t`${removedDevices.length} devices marked for removal. Click "Save Changes" to confirm.`}
          </div>
        )}
        <ScrollContainer height="xs">
          {stagedRegistration?.device_registrations
            .sort((a: secureChannel.DeviceRegistration, b: secureChannel.DeviceRegistration) => {
              // Sort so "this device" appears first
              const aIsThisDevice = keyset.deviceKeyset.inbox_keyset.inbox_address === a.inbox_registration.inbox_address;
              const bIsThisDevice = keyset.deviceKeyset.inbox_keyset.inbox_address === b.inbox_registration.inbox_address;

              if (aIsThisDevice && !bIsThisDevice) return -1;
              if (!aIsThisDevice && bIsThisDevice) return 1;
              return 0; // Keep original order for other devices
            })
            .map(
            (
              d: secureChannel.DeviceRegistration,
              index: number
            ) => {
              const inboxAddress = d.inbox_registration.inbox_address;
              const isRemoved = removedDevices.includes(d.identity_public_key);
              const isThisDevice = keyset.deviceKeyset?.inbox_keyset?.inbox_address === inboxAddress;
              const deviceName = deviceNames?.[inboxAddress];
              const isEditing = editingDevice === inboxAddress;

              return (
                <div
                  key={inboxAddress}
                  className={`flex flex-row justify-between items-center py-3 px-3 ${
                    index > 0
                      ? 'border-t border-dashed border-surface-7'
                      : ''
                  } ${isRemoved ? 'opacity-50' : ''}`}
                >
                  {/* Left section */}
                  <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 mr-2 min-w-0">
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          className="flex-1 min-w-0 bg-transparent border border-subtle rounded px-2 py-0.5 text-sm text-main outline-none focus:border-primary"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          maxLength={40}
                        />
                        <Icon
                          name="check"
                          size="sm"
                          className={`flex-shrink-0 ${nameIsValid && !isSavingName ? 'cursor-pointer text-success hover:text-success' : 'text-muted cursor-not-allowed'}`}
                          onClick={nameIsValid && !isSavingName ? confirmEdit : undefined}
                        />
                        <Icon
                          name="close"
                          size="sm"
                          className="cursor-pointer flex-shrink-0 text-subtle hover:text-main"
                          onClick={cancelEdit}
                        />
                        {nameError && (
                          <div className="w-full text-xs text-danger mt-0.5">{nameError}</div>
                        )}
                      </>
                    ) : (
                      <>
                        {deviceName && (
                          <span className="text-sm text-main font-medium truncate max-w-[120px] sm:max-w-none">
                            {deviceName}
                          </span>
                        )}
                        <ClickToCopyContent
                          text={inboxAddress}
                          iconPosition="right"
                          textVariant="subtle"
                          textSize="sm"
                          iconSize="xs"
                          tooltipText={t`Copy full address`}
                          tooltipLocation="top"
                        >
                          {formatAddress(inboxAddress)}
                        </ClickToCopyContent>
                        {isThisDevice && saveDeviceName && (
                          <Tooltip
                            id={`rename-device-${inboxAddress}`}
                            content={t`Rename this device`}
                            place="top"
                          >
                            <Icon
                              name="edit"
                              size="sm"
                              className="cursor-pointer text-subtle hover:text-main flex-shrink-0"
                              onClick={() => startEdit(inboxAddress, deviceName)}
                            />
                          </Tooltip>
                        )}
                      </>
                    )}
                    {isRemoved && (
                      <div className="w-full text-xs text-danger">
                        {t`Pending removal - click Save to confirm`}
                      </div>
                    )}
                  </div>

                  {/* Right section */}
                  <div className="flex-shrink-0">
                    {!isThisDevice && (
                      <Button
                        onClick={() => removeDevice(d.identity_public_key)}
                        type="danger-outline"
                        size="small"
                        disabled={isRemoved}
                      >
                        {isRemoved ? t`Pending` : t`Remove`}
                      </Button>
                    )}
                    {isThisDevice && (
                      <Button
                        size="small"
                        disabled={true}
                        onClick={() => {}}
                      >
                        {t`This device`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </ScrollContainer>

        <Spacer size="md" direction="vertical" borderTop={true} className="mt-4" />
        <div className="text-subtitle-2 mb-2">{t`Account Key`}</div>
        <div className="modal-content-info">
          <div className="flex flex-col gap-3 p-3 rounded-md border">
            <div className="text-sm" style={{ lineHeight: 1.3 }}>
              {t`Your private key is the only proof of ownership of your account. Anyone who has it can impersonate you and steal your Space's Apex earnings. Never share it.`}
            </div>

            {/* Action row: download to file · copy hex · show QR for mobile import */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="danger-outline"
                size="small"
                className="whitespace-nowrap"
                onClick={downloadKey}
              >
                <Icon name="download" size="sm" className="mr-1" />
                {t`Download file`}
              </Button>
              {getPrivateKeyHex && (
                <Button
                  type="danger-outline"
                  size="small"
                  className="whitespace-nowrap"
                  onClick={handleCopyKeyClick}
                  disabled={isCopyingKey}
                >
                  <Icon name="copy" size="sm" className="mr-1" />
                  {t`Copy key`}
                </Button>
              )}
              {getPrivateKeyHex && (
                <Button
                  type="danger-outline"
                  size="small"
                  className="whitespace-nowrap"
                  onClick={handleShowQRClick}
                >
                  <Icon name="qrcode" size="sm" className="mr-1" />
                  {t`Show QR`}
                </Button>
              )}
            </div>

            <div className="text-xs onboarding-label-muted">
              {t`Download saves a .key file. Copy puts the raw key (hex) on your clipboard. Show QR is for importing into the Quorum mobile app.`}
            </div>

            {/* Copy confirmation */}
            {showCopyConfirmation && (
              <>
                <Callout variant="error" size="sm">
                  <div className="text-sm">
                    {t`This copies your private key to the clipboard in plain text. Anyone with access to your clipboard can take full control of your account. Store it somewhere safe and clear your clipboard afterwards.`}
                  </div>
                </Callout>
                <div className="flex gap-2 justify-end">
                  <Button type="secondary" size="small" onClick={handleCancelCopy}>
                    {t`Cancel`}
                  </Button>
                  <Button
                    type="danger"
                    size="small"
                    onClick={handleConfirmCopyKey}
                    disabled={isCopyingKey}
                  >
                    {isCopyingKey ? t`Copying...` : t`I Understand, Copy`}
                  </Button>
                </div>
              </>
            )}

            {copyMode && (
              <Callout variant="success" size="sm">
                <div className="text-sm">
                  {copyMode === 'auto-clear'
                    ? t`Private key copied. It will be cleared from your clipboard automatically in 60 seconds.`
                    : t`Private key copied. Store it securely and clear your clipboard when you're done.`}
                </div>
              </Callout>
            )}

            {copyError && (
              <Callout variant="error" size="sm">
                <div className="text-sm">{copyError}</div>
              </Callout>
            )}

            {/* QR confirmation */}
            {showQRConfirmation && !showQRCode && (
              <>
                <Callout variant="error" size="sm">
                  <div className="text-sm">
                    {t`Anyone who sees or photographs this QR code can take full control of your Quorum account and steal any associated funds. Only proceed if you are in a private location and ready to scan immediately.`}
                  </div>
                </Callout>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="secondary"
                    size="small"
                    onClick={() => setShowQRConfirmation(false)}
                  >
                    {t`Cancel`}
                  </Button>
                  <Button
                    type="danger"
                    size="small"
                    onClick={handleConfirmShowQR}
                    disabled={isLoadingKey}
                  >
                    {isLoadingKey ? t`Loading...` : t`I Understand, Show QR`}
                  </Button>
                </div>
              </>
            )}

            {/* QR display */}
            {showQRCode && privateKeyHex && (
              <>
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg">
                    <QRCodeSVG value={privateKeyHex} size={200} level="M" />
                  </div>
                  <div className="text-xs text-muted text-center mt-3">
                    {t`QR code will auto-hide in 60 seconds`}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="secondary" size="small" onClick={handleHideQR}>
                    {t`Hide`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">{t`Data Backup`}</div>
        <div className="modal-content-info">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 p-3 rounded-md border">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm" style={{ lineHeight: 1.3 }}>
                  {t`Export an encrypted backup of your direct messages to restore them if you lose access to this device.`}
                </div>
                <Button
                  type="secondary"
                  size="small"
                  className="whitespace-nowrap"
                  onClick={handleExportBackup}
                  disabled={isBackupBusy}
                >
                  {isExportingBackup ? t`Exporting...` : t`Export`}
                </Button>
              </div>
              <button
                type="button"
                className="text-sm sm:text-xs underline cursor-pointer bg-transparent border-none p-0 text-left"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBackupBusy}
              >
                {isImportingBackup ? t`Importing...` : t`Import a backup instead`}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".qmbak"
                className="hidden"
                onChange={handleImportBackup}
              />
            </div>
            {backupError && (
              <Callout variant="error" size="sm">
                <div className="text-sm">{backupError}</div>
              </Callout>
            )}
            {backupSuccess && (
              <Callout variant="success" size="sm">
                <div className="text-sm">{backupSuccess}</div>
              </Callout>
            )}
          </div>
        </div>

      </div>
    </>
  );
};

export default Security;
