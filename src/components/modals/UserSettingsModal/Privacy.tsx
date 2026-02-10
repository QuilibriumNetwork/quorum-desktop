import * as React from 'react';
import { Button, Switch, Icon, Tooltip, Spacer, ScrollContainer, Callout } from '../../primitives';
import { t } from '@lingui/core/macro';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { QRCodeSVG } from 'qrcode.react';

interface PrivacyProps {
  allowSync: boolean;
  setAllowSync: (value: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (value: boolean) => void;
  stagedRegistration: any;
  keyset: any;
  removeDevice: (key: string) => void;
  downloadKey: () => void;
  getPrivateKeyHex?: () => Promise<string>;
  onSave: () => void;
  isSaving: boolean;
  removedDevices?: string[];
  isConfigLoaded?: boolean;
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
  getPrivateKeyHex,
  onSave,
  isSaving,
  removedDevices = [],
  isConfigLoaded = true,
}) => {
  // QR code display state - requires explicit user confirmation
  const [showQRConfirmation, setShowQRConfirmation] = React.useState(false);
  const [showQRCode, setShowQRCode] = React.useState(false);
  const [privateKeyHex, setPrivateKeyHex] = React.useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = React.useState(false);

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
            .sort((a, b) => {
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
              const isRemoved = removedDevices.includes(d.identity_public_key);
              const isThisDevice = keyset.deviceKeyset?.inbox_keyset?.inbox_address === d.inbox_registration.inbox_address;

              return (
                <div
                  key={d.inbox_registration.inbox_address}
                  className={`flex flex-row justify-between items-center py-3 px-3 ${
                    index > 0
                      ? 'border-t border-dashed border-surface-7'
                      : ''
                  } ${isRemoved ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col justify-around flex-1 mr-2">
                    <div className="font-light break-all text-sm">
                      {d.inbox_registration.inbox_address}
                    </div>
                    {isRemoved && (
                      <div className="text-xs text-danger mt-1">
                        {t`Pending removal - click Save to confirm`}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {!isThisDevice && (
                      <Button
                        onClick={() => {
                          removeDevice(d.identity_public_key);
                        }}
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

      </div>
    </>
  );
};

export default Privacy;