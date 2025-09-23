import * as React from 'react';
import { Button, Switch, Icon, Tooltip, Spacer, ScrollContainer } from '../../primitives';
import { t } from '@lingui/core/macro';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';

interface PrivacyProps {
  allowSync: boolean;
  setAllowSync: (value: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (value: boolean) => void;
  stagedRegistration: any;
  keyset: any;
  removeDevice: (key: string) => void;
  downloadKey: () => void;
  onSave: () => void;
  isSaving: boolean;
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
  onSave,
  isSaving,
}) => {
  return (
    <>
      <div className="modal-content-header">
        <div className="modal-text-section">
          <div className="modal-text-section-header">{t`Privacy/Security`}</div>
          <div className="pt-2 modal-text-small text-main">
            {t`Manage devices, and privacy conditions for messaging and synchronization.`}
          </div>
        </div>
      </div>
      <div className="modal-content-section">
        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="modal-text-label">{t`Security`}</div>

        <div className="pt-2 modal-text-small text-main mb-4">
          {t`Adjust security-related settings, which may impact user  experience but increase the security of your Quorum account.`}
        </div>
        <div className="modal-content-info">
          <div className="flex flex-row justify-between pb-2">
            <div className="flex flex-row items-center">
              <div className="modal-text-small text-main">
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
                />
              </Tooltip>
            </div>

            <Switch value={allowSync} onChange={setAllowSync} />
          </div>
          <div className="flex flex-row justify-between">
            <div className="flex flex-row items-center">
              <div className="modal-text-small text-main">
                {t`Always sign Direct Messages`}
              </div>
              <Tooltip
                id="settings-non-repudiable-tooltip"
                content={t`Always sign Direct Messages in conversations. This can be overridden for finer-grain control by clicking the lock icon found in each conversation view.`}
                place="bottom"
              >
                <Icon
                  name="info-circle"
                  className="text-main hover:text-strong cursor-pointer ml-2"
                />
              </Tooltip>
            </div>

            <Switch
              value={nonRepudiable}
              onChange={setNonRepudiable}
            />
          </div>
        </div>

        <Spacer size="md" direction="vertical" borderTop={true} />
        <div className="modal-text-label pb-2">Devices</div>
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
            ) => (
              <div
                key={d.inbox_registration.inbox_address}
                className={`flex flex-row justify-between items-center py-3 px-3 ${
                  index > 0
                    ? 'border-t border-dashed border-surface-7'
                    : ''
                }`}
              >
                <div className="flex flex-col justify-around font-light break-all flex-1 mr-2 text-sm">
                  {d.inbox_registration.inbox_address}
                </div>
                <div className="flex-shrink-0">
                  {keyset.deviceKeyset?.inbox_keyset
                    ?.inbox_address !==
                    d.inbox_registration.inbox_address && (
                    <Button
                      onClick={() => {
                        removeDevice(d.identity_public_key);
                      }}
                      type="danger-outline"
                      size="small"
                    >
                      {t`Remove`}
                    </Button>
                  )}
                  {keyset.deviceKeyset.inbox_keyset
                    .inbox_address ===
                    d.inbox_registration.inbox_address && (
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
            )
          )}
        </ScrollContainer>

        <div className="modal-content-info !pt-4">
          <Spacer size="md" direction="vertical" borderTop={true} />
          <div className="modal-text-label">{t`Key Export`}</div>

          <div className="pt-2 modal-text-small text-main">
            {t`Export your key to a file by clicking this button. Do not share this file with anyone else or they can impersonate you or steal your Space's Apex earnings.`}
          </div>
          <div className="pt-4 pb-8 max-w-[100px]">
            <Button
              type="danger-outline"
              onClick={() => {
                downloadKey();
              }}
            >
              {t`Export`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Privacy;