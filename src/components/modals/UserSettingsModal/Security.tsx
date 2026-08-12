import * as React from 'react';
import { Button, Icon, Tooltip, Spacer, ScrollContainer, Callout, Modal } from '../../primitives';
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
import type { RestoreReport } from '../../../services/BackupService';
import { useConfirmation } from '../../../hooks/ui/useConfirmation';
import ConfirmationModal from '../ConfirmationModal';

interface SecurityProps {
  stagedRegistration: any;
  keyset: any;
  removeDevice: (key: string) => void;
  downloadKey: () => void;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<RestoreReport>;
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
  // QR display state. The confirmation itself is a ConfirmationModal (below);
  // this only tracks the reveal.
  const [showQRCode, setShowQRCode] = React.useState(false);
  const [privateKeyHex, setPrivateKeyHex] = React.useState<string | null>(null);

  // Copy-private-key state.
  // copyMode records HOW the copy was performed: 'auto-clear' (Electron main
  // process guarantees the 60s clear) vs 'best-effort' (plain web build, where
  // an unfocused page cannot touch the clipboard). The success message adapts
  // so we never promise a clear we can't deliver.
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

  /**
   * The QR carries the whole account, so it self-destructs rather than waiting
   * to be dismissed. Closing the modal (button, Esc, or backdrop) does the same
   * thing, which is why the reveal needed a modal in the first place: an inline
   * panel had no instant way out.
   */
  React.useEffect(() => {
    if (showQRCode) {
      const timer = setTimeout(() => {
        setShowQRCode(false);
        setPrivateKeyHex(null);
      }, SENSITIVE_CLIPBOARD_CLEAR_MS);
      return () => clearTimeout(timer);
    }
  }, [showQRCode]);

  const handleConfirmShowQR = async () => {
    if (!getPrivateKeyHex) return;
    // Errors surface through the same callout the copy path uses; without this
    // a rejected passkey prompt left the button looking inert.
    setCopyError(null);
    try {
      const keyHex = await getPrivateKeyHex();
      setPrivateKeyHex(keyHex);
      setShowQRCode(true);
    } catch (error: any) {
      console.error('Failed to get private key:', error);
      setCopyError(error?.message || t`Failed to read your private key`);
    }
  };

  const handleHideQR = () => {
    setShowQRCode(false);
    setPrivateKeyHex(null);
  };

  // Hide the copy-success callout timer on unmount (the clipboard clearing
  // itself lives outside this component and is unaffected).
  React.useEffect(() => {
    return () => {
      if (copySuccessHideTimerRef.current) clearTimeout(copySuccessHideTimerRef.current);
    };
  }, []);

  const handleConfirmCopyKey = async () => {
    if (!getPrivateKeyHex) return;

    setCopyError(null);
    try {
      const keyHex = await getPrivateKeyHex();
      const mode = await copySensitiveText(keyHex);
      setCopyMode(mode);

      // Hide the success callout when the auto-clear window elapses.
      if (copySuccessHideTimerRef.current) clearTimeout(copySuccessHideTimerRef.current);
      copySuccessHideTimerRef.current = setTimeout(() => {
        setCopyMode(null);
      }, SENSITIVE_CLIPBOARD_CLEAR_MS);
    } catch (error: any) {
      console.error('Failed to copy private key:', error);
      setCopyError(error?.message || t`Failed to copy private key`);
    }
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

  /**
   * Confirmation before writing the file.
   *
   * Not an "are you sure" speed bump — the export is harmless in itself. It is
   * the moment the user learns what the file actually holds, which is no longer
   * just messages: it carries Space ownership keys too.
   *
   * Deliberately states no storage advice. An earlier draft warned that anyone
   * holding both this file AND the exported account key could take over those
   * Spaces. That is noise for a sync-ON user, whose account key alone already
   * fetches the Space keys from the server — and worse, framing the COMBINATION
   * as the danger implies the account key by itself is less than total, which is
   * the opposite of true. It is only incremental for a sync-OFF user, for whom
   * the server holds nothing and this file is the only other copy. Rather than
   * state something true for one group and misleading for the other, the copy
   * sticks to what is true for both. The sync-off nuance belongs in the docs.
   */
  const exportConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false,
    modalConfig: {
      title: t`Export a backup?`,
      message: t`This file contains your direct message history and the keys to your Spaces, including ownership of any you created. Only this account can open it.\n\nSpace message history is not included. It syncs back from other members.`,
      confirmText: t`Export backup`,
      cancelText: t`Cancel`,
      variant: 'warning',
    },
  });

  /** Asks first; `handleExportBackup` runs only once the user confirms. */
  const handleExportBackupClick = (e: React.MouseEvent) => {
    if (exportConfirmation.isConfirming) return;
    exportConfirmation.handleClick(e, handleExportBackup);
  };

  /**
   * Confirmation before writing the raw private key to disk.
   *
   * "Download file" used to be the only one of the three Account Key actions
   * with no gate at all — one click and the unencrypted key was in the
   * downloads folder — while "Copy key" and "Show QR" both required a second,
   * explicitly-worded click. That asymmetry was backwards: a clipboard entry
   * expires and a QR code is dismissed, but a file persists, and it persists in
   * a directory that is cloud-synced on a large share of machines.
   *
   * The copy names the filename, because the file is self-identifying — it is
   * `<your address>.key`, so anyone who finds it later knows which account it
   * opens.
   */
  const downloadConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false,
    modalConfig: {
      title: t`Download your private key?`,
      message: t`This saves your account's private key to your device as an unencrypted text file, named after your account address.\n\nAnyone who opens that file controls your account permanently. There is no way to revoke or reset it. Downloads folders are often synced to cloud storage, so move it somewhere you control.`,
      // One word. "I understand, download" wrapped onto two lines in the button.
      confirmText: t`Download`,
      cancelText: t`Cancel`,
      variant: 'danger',
    },
  });

  /** Asks first; the download runs only once the user confirms. */
  const handleDownloadKeyClick = (e: React.MouseEvent) => {
    if (downloadConfirmation.isConfirming) return;
    downloadConfirmation.handleClick(e, async () => downloadKey());
  };

  /**
   * Copy and Show QR used to warn through inline callouts rendered BELOW the
   * button row, inside a scrollable panel. On a short window the warning could
   * sit off-screen entirely, so the user clicked "I Understand" having never
   * seen what they were agreeing to. A modal cannot be scrolled past, and it
   * makes all three Account Key actions behave the same way.
   */
  const copyConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false,
    modalConfig: {
      title: t`Copy your private key?`,
      message: t`This puts your account's private key on the clipboard in plain text. Anyone who can read your clipboard can take full control of your account.\n\nClipboard history and sync tools keep their own copy, which Quorum cannot clear. Paste it somewhere safe, then clear your clipboard and its history.`,
      confirmText: t`Copy`,
      cancelText: t`Cancel`,
      variant: 'danger',
    },
  });

  const handleCopyKeyClick = (e: React.MouseEvent) => {
    if (copyConfirmation.isConfirming) return;
    setCopyMode(null);
    setCopyError(null);
    copyConfirmation.handleClick(e, handleConfirmCopyKey);
  };

  const qrConfirmation = useConfirmation({
    type: 'modal',
    enableShiftBypass: false,
    modalConfig: {
      title: t`Show your private key as a QR code?`,
      message: t`Anyone who sees or photographs this code can take full control of your account and steal any funds it holds.\n\nOnly continue if you are somewhere private and ready to scan immediately. The code hides itself after 60 seconds.`,
      confirmText: t`Show QR`,
      cancelText: t`Cancel`,
      variant: 'danger',
    },
  });

  const handleShowQRClick = (e: React.MouseEvent) => {
    if (qrConfirmation.isConfirming) return;
    setCopyError(null);
    qrConfirmation.handleClick(e, handleConfirmShowQR);
  };

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

  /**
   * Describes what the restore did AND what it deliberately did not do.
   *
   * A bare "restored N messages" is what let the feature imply for months that it
   * protected Spaces when it could not restore a single one. Every line below is
   * a case where something the user might expect back did not come back, and each
   * has a different reason the user can act on.
   */
  const summariseRestore = (result: RestoreReport): string => {
    const parts: string[] = [
      t`Restored ${result.messagesWritten} messages and ${result.conversationsWritten} conversations.`,
    ];

    if (result.spacesRestored.length > 0) {
      parts.push(t`Restored ${result.spacesRestored.length} Spaces.`);
    }
    if (result.spacesAlreadyPresent.length > 0) {
      // Not a failure: the additive rule leaving live Spaces untouched.
      parts.push(
        t`${result.spacesAlreadyPresent.length} Spaces were already on this device and were left unchanged.`
      );
    }
    if (result.conversationsSkippedAsDeleted > 0) {
      parts.push(
        t`${result.conversationsSkippedAsDeleted} conversations were not restored because you deleted them after this backup was made.`
      );
    }
    if (result.messagesSkippedAsDeleted > 0) {
      parts.push(
        t`${result.messagesSkippedAsDeleted} messages were not restored because you deleted them after this backup was made.`
      );
    }
    if (result.spacesFailed.length > 0) {
      parts.push(
        t`${result.spacesFailed.length} Spaces were skipped: ${result.spacesFailed
          .map((s) => s.reason)
          .join('; ')}`
      );
    }
    if (result.domains.space_keys && !result.domains.spaces) {
      parts.push(
        t`This backup is inconsistent: it reports Space keys but contains no Space list, so Spaces could not be restored.`
      );
    }
    if (!result.domains.space_keys) {
      // The v1 case. Without this the user sees a successful restore and no
      // Spaces, with nothing to explain why.
      parts.push(
        t`This backup was made by an older version and contains no Space keys, so Spaces could not be restored. Export a fresh backup to protect them.`
      );
    }
    if (!result.domains.space_messages) {
      parts.push(t`Space message history is not included in backups; it syncs from other members.`);
    }

    return parts.join(' ');
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
      setBackupSuccess(summariseRestore(result));
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
                          className="flex-1 min-w-0 bg-transparent border border-subtle rounded px-2 py-0.5 text-sm text-main outline-none focus:border-accent"
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
                onClick={handleDownloadKeyClick}
                disabled={downloadConfirmation.isConfirming}
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
                  disabled={copyConfirmation.isConfirming}
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
                  disabled={qrConfirmation.isConfirming}
                >
                  <Icon name="qrcode" size="sm" className="mr-1" />
                  {t`Show QR`}
                </Button>
              )}
            </div>

            <div className="text-xs onboarding-label-muted">
              {t`Download saves a .key file. Copy puts the raw key (hex) on your clipboard. Show QR is for importing into the Quorum mobile app.`}
            </div>

            {/*
              Both messages name the clipboard-history caveat, and the
              auto-clear one needs it most: clearing the system clipboard is
              real, but it does not reach the copies Windows Clipboard History,
              macOS Universal Clipboard, or any clipboard manager has already
              taken. Stating the 60s clear on its own read as "the key is no
              longer anywhere", which is frequently false and leads people to
              skip the one step the app cannot do for them.
            */}
            {copyMode && (
              <Callout variant="success" size="sm">
                <div className="text-sm">
                  {copyMode === 'auto-clear'
                    ? t`Private key copied. Quorum will clear it from your clipboard in 60 seconds. Clipboard history tools keep their own copy, so clear those too.`
                    : t`Private key copied. Store it securely, then clear your clipboard and your clipboard history.`}
                </div>
              </Callout>
            )}

            {copyError && (
              <Callout variant="error" size="sm">
                <div className="text-sm">{copyError}</div>
              </Callout>
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
                  {/*
                    Deliberately short. What the file actually CONTAINS — Space
                    keys, including ownership of Spaces you created — is the
                    kind of thing people need at the moment they decide where to
                    put the file, not while scanning a settings page. It lives in
                    the confirmation modal instead.
                  */}
                  {t`Export an encrypted backup of your direct messages and your Spaces, so you can restore them if you lose access to this device.`}
                </div>
                <Button
                  type="secondary"
                  size="small"
                  className="whitespace-nowrap"
                  onClick={handleExportBackupClick}
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
      {copyConfirmation.modalConfig && (
        <ConfirmationModal
          visible={copyConfirmation.showModal}
          title={copyConfirmation.modalConfig.title}
          message={copyConfirmation.modalConfig.message}
          confirmText={copyConfirmation.modalConfig.confirmText}
          cancelText={copyConfirmation.modalConfig.cancelText}
          variant={copyConfirmation.modalConfig.variant}
          showProtip={false}
          busy={copyConfirmation.isConfirming}
          busyMessage={t`Copying...`}
          onConfirm={copyConfirmation.modalConfig.onConfirm}
          onCancel={copyConfirmation.modalConfig.onCancel}
        />
      )}
      {qrConfirmation.modalConfig && (
        <ConfirmationModal
          visible={qrConfirmation.showModal}
          title={qrConfirmation.modalConfig.title}
          message={qrConfirmation.modalConfig.message}
          confirmText={qrConfirmation.modalConfig.confirmText}
          cancelText={qrConfirmation.modalConfig.cancelText}
          variant={qrConfirmation.modalConfig.variant}
          showProtip={false}
          busy={qrConfirmation.isConfirming}
          busyMessage={t`Reading your key...`}
          onConfirm={qrConfirmation.modalConfig.onConfirm}
          onCancel={qrConfirmation.modalConfig.onCancel}
        />
      )}
      {/*
        The QR lives in its own modal rather than inline in the panel. Closing
        it IS hiding it, so Esc and the backdrop both work as an instant
        get-it-off-my-screen, which the old inline panel had no equivalent of.
        The 60s timer closes the same modal.
      */}
      <Modal
        visible={showQRCode && !!privateKeyHex}
        onClose={handleHideQR}
        title={t`Your private key`}
        size="small"
      >
        <div className="flex flex-col items-center gap-3">
          <Callout variant="error" size="sm">
            <div className="text-sm">
              {t`Anyone who photographs this code owns your account. Scan it now, then close this.`}
            </div>
          </Callout>
          {/* White plate: QR readers need the light-on-dark contrast inverted. */}
          <div className="bg-white p-4 rounded-lg">
            {privateKeyHex && <QRCodeSVG value={privateKeyHex} size={200} level="M" />}
          </div>
          <div className="text-xs text-muted text-center">
            {t`This hides itself after 60 seconds.`}
          </div>
          <Button type="secondary" size="small" onClick={handleHideQR}>
            {t`Done`}
          </Button>
        </div>
      </Modal>
      {downloadConfirmation.modalConfig && (
        <ConfirmationModal
          visible={downloadConfirmation.showModal}
          title={downloadConfirmation.modalConfig.title}
          message={downloadConfirmation.modalConfig.message}
          confirmText={downloadConfirmation.modalConfig.confirmText}
          cancelText={downloadConfirmation.modalConfig.cancelText}
          variant={downloadConfirmation.modalConfig.variant}
          showProtip={false}
          busy={downloadConfirmation.isConfirming}
          busyMessage={t`Preparing download...`}
          onConfirm={downloadConfirmation.modalConfig.onConfirm}
          onCancel={downloadConfirmation.modalConfig.onCancel}
        />
      )}
      {/* Says what the file holds, at the moment the user chooses where to keep it. */}
      {exportConfirmation.modalConfig && (
        <ConfirmationModal
          visible={exportConfirmation.showModal}
          title={exportConfirmation.modalConfig.title}
          message={exportConfirmation.modalConfig.message}
          confirmText={exportConfirmation.modalConfig.confirmText}
          cancelText={exportConfirmation.modalConfig.cancelText}
          variant={exportConfirmation.modalConfig.variant}
          showProtip={false}
          busy={exportConfirmation.isConfirming}
          busyMessage={t`Exporting...`}
          onConfirm={exportConfirmation.modalConfig.onConfirm}
          onCancel={exportConfirmation.modalConfig.onCancel}
        />
      )}
    </>
  );
};

export default Security;
