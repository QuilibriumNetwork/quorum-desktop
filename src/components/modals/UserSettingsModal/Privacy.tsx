import * as React from 'react';
import { Button, Switch, Icon, Tooltip, Spacer, ScrollContainer, Callout } from '../../primitives';
import { t } from '@lingui/core/macro';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { QRCodeSVG } from 'qrcode.react';
import { truncateAddress, getDeviceName } from '../../../utils/deviceInfo';
import { useDeviceNameValidation } from '../../../hooks/business/validation';
import { ClickToCopyContent } from '../../ui';

interface PrivacyProps {
  allowSync: boolean;
  setAllowSync: (value: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (value: boolean) => void;
  stagedRegistration: any;
  keyset: any;
  removeDevice: (key: string) => void;
  downloadKey: () => void;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<{ messagesWritten: number; conversationsWritten: number }>;
  getPrivateKeyHex?: () => Promise<string>;
  onSave: () => void;
  isSaving: boolean;
  removedDevices?: string[];
  isConfigLoaded?: boolean;
  deviceNames?: { [inboxAddress: string]: string };
  saveDeviceName?: (name: string) => Promise<void>;
  deliveryReceipts: boolean;
  setDeliveryReceipts: (value: boolean) => void;
  readReceipts: boolean;
  setReadReceipts: (value: boolean) => void;
}

const Privacy: React.FunctionComponent<PrivacyProps> = ({
  allowSync,
  setAllowSync,
  nonRepudiable,
  setNonRepudiable,
  stagedRegistration,
  keyset,
  removeDevice,
  downloadKey,
  exportBackup,
  importBackup,
  getPrivateKeyHex,
  onSave,
  isSaving,
  removedDevices = [],
  isConfigLoaded = true,
  deviceNames = {},
  saveDeviceName,
  deliveryReceipts,
  setDeliveryReceipts,
  readReceipts,
  setReadReceipts,
}) => {
  // QR code display state - requires explicit user confirmation
  const [showQRConfirmation, setShowQRConfirmation] = React.useState(false);
  const [showQRCode, setShowQRCode] = React.useState(false);
  const [privateKeyHex, setPrivateKeyHex] = React.useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = React.useState(false);

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

  // Device rename state
  const [editingDevice, setEditingDevice] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const { error: nameError, isValid: nameIsValid } = useDeviceNameValidation(editValue);

  const startEdit = async (inboxAddress: string, currentName: string | undefined) => {
    const suggested = currentName ?? await getDeviceName();
    setEditValue(suggested);
    setEditingDevice(inboxAddress);
  };

  const confirmEdit = async () => {
    if (!nameIsValid || !editingDevice || !saveDeviceName) return;
    await saveDeviceName(editValue.trim());
    setEditingDevice(null);
    setEditValue('');
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
          <div className="text-title">{t`Privacy/Security`}</div>
          <div className="pt-2 text-body">
            {t`Manage devices, and privacy conditions for messaging and synchronization.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2">{t`Security`}</div>

        <div className="pt-2 text-label mb-4">
          {t`Adjust security-related settings, which may impact user  experience but increase the security of your Quorum account.`}
        </div>
        <div className="modal-content-info">
          <div className="flex flex-row items-center gap-3 mb-3">
            <Switch value={allowSync} onChange={setAllowSync} disabled={!isConfigLoaded} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Enable sync`}
              </div>
              <Tooltip
                id="settings-allow-sync-tooltip"
                content={t`When enabled, synchronizes your user data, Spaces, and Space keys between devices. Enabling this increases metadata visibility of your account, which can reveal when you have joined new Spaces, although not the Spaces you have joined.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mb-3">
            <Switch value={nonRepudiable} onChange={setNonRepudiable} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Always sign Direct Messages`}
              </div>
              <Tooltip
                id="settings-non-repudiable-tooltip"
                content={t`When you sign a message, you are confirming that it comes from your key. When you don't sign a message, you have plausible deniability. You can control this setting for each conversation and message individually.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
            <Switch value={false} onChange={() => {}} disabled={true} />
            <div className="flex flex-row items-center">
              <div className="text-label-strong text-muted">
                {t`Show Online Status`}
              </div>
              <Tooltip
                id="settings-show-online-status-tooltip"
                content={t`When enabled, other users can see when you are active. This feature is not yet available.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 mt-3">
            <Switch
              value={deliveryReceipts}
              onChange={(value: boolean) => {
                setDeliveryReceipts(value);
                // Cascade: turning delivery OFF also turns read OFF
                if (!value) setReadReceipts(false);
              }}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Delivery receipts`}
              </div>
              <Tooltip
                id="settings-delivery-receipts-tooltip"
                content={t`When on, senders see when their messages reach your device, and you see when yours reach theirs.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          {deliveryReceipts && (
          <div className="flex flex-row items-center gap-3 mt-3 ml-6">
            <Switch
              value={readReceipts}
              onChange={setReadReceipts}
              disabled={!isConfigLoaded}
            />
            <div className="flex flex-row items-center">
              <div className="text-label-strong">
                {t`Read receipts`}
              </div>
              <Tooltip
                id="settings-read-receipts-tooltip"
                content={t`When on, senders see when you've read their messages, and you see when yours are read.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                  size="sm"
                />
              </Tooltip>
            </div>
          </div>
          )}
        </div>

        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="text-subtitle-2 mb-2">{t`Devices`}</div>
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
                          className={`cursor-pointer flex-shrink-0 ${nameIsValid ? 'text-success hover:text-success' : 'text-muted cursor-not-allowed'}`}
                          onClick={nameIsValid ? confirmEdit : undefined}
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
                          {truncateAddress(inboxAddress)}
                        </ClickToCopyContent>
                        {isThisDevice && saveDeviceName && (
                          <Icon
                            name="edit"
                            size="xs"
                            className="cursor-pointer text-subtle hover:text-main flex-shrink-0"
                            onClick={() => startEdit(inboxAddress, deviceName)}
                          />
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
        <div className="text-subtitle-2 mb-2">{t`Key Export`}</div>
        <div className="modal-content-info">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 p-3 rounded-md border">
              <div className="text-sm" style={{ lineHeight: 1.3 }}>
                {t`Export your key to a file. Do not share this file with anyone else or they can impersonate you or steal your Space's Apex earnings.`}
              </div>
              <Button
                type="danger"
                size="small"
                className="whitespace-nowrap"
                onClick={downloadKey}
              >
                {t`Export`}
              </Button>
            </div>
          </div>
        </div>

        {getPrivateKeyHex && (
          <>
            <Spacer size="md" direction="vertical" borderTop={true} />
            <div className="text-subtitle-2 mb-2">{t`Mobile Import`}</div>
            <div className="modal-content-info">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-3 p-3 rounded-md border">
                  {!showQRConfirmation && !showQRCode && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm" style={{ lineHeight: 1.3 }}>
                        {t`Display your private key as a QR code to scan with the Quorum mobile app. This allows you to import your account on mobile without typing the key.`}
                      </div>
                      <Button
                        type="danger"
                        size="small"
                        className="whitespace-nowrap"
                        onClick={handleShowQRClick}
                      >
                        {t`Show QR`}
                      </Button>
                    </div>
                  )}

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

                  {showQRCode && privateKeyHex && (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="bg-white p-4 rounded-lg">
                          <QRCodeSVG
                            value={privateKeyHex}
                            size={200}
                            level="M"
                          />
                        </div>
                        <div className="text-xs text-muted text-center mt-3">
                          {t`QR code will auto-hide in 60 seconds`}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="secondary"
                          size="small"
                          onClick={handleHideQR}
                        >
                          {t`Hide`}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

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

export default Privacy;