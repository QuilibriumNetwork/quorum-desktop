import { useDropzone } from 'react-dropzone';
import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import Button from '../Button';
import '../../styles/_modal_common.scss';
import { useRegistration } from '../../hooks';
import { useRegistrationContext } from '../context/RegistrationPersister';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../context/MessageDB';
import ToggleSwitch from '../ToggleSwitch';
import { UserConfig } from '../../db/messages';
import ThemeRadioGroup from '../ThemeRadioGroup';
import AccentColorSwitcher from '../AccentColorSwitcher';
import { t } from '@lingui/core/macro';
import CopyToClipboard from '../CopyToClipboard';
import { DefaultImages } from '../../utils';
import {
  dynamicActivate,
  getUserLocale,
  saveUserLocale,
} from '../../i18n/i18n.ts';
import locales from '../../i18n/locales';
import useForceUpdate from '../hooks/forceUpdate';
import ReactTooltip from '../ReactTooltip';

const UserSettingsModal: React.FunctionComponent<{
  dismiss: () => void;
  onEditModeClick?: () => void;
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
}> = ({ dismiss, setUser }) => {
  let { currentPasskeyInfo, updateStoredPasskey, exportKey } =
    usePasskeysContext();
  let [displayName, setDisplayName] = React.useState<string>(
    currentPasskeyInfo?.displayName || ''
  );
  let [selectedCategory, setSelectedCategory] =
    React.useState<string>('general');
  let { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const [fileData, setFileData] = React.useState<ArrayBuffer | undefined>();
  const { keyset } = useRegistrationContext();
  const { saveConfig, getConfig, updateUserProfile } = useMessageDB();
  const [stagedRegistration, setStagedRegistration] = React.useState<
    secureChannel.UserRegistration | undefined
  >(registration.registration);
  const [init, setInit] = React.useState<boolean>(false);
  const existingConfig = React.useRef<UserConfig | null>(null);
  const [allowSync, setAllowSync] = React.useState<boolean>(false);
  const [language, setLanguage] = React.useState(getUserLocale());
  const [languageChanged, setLanguageChanged] = React.useState<boolean>(false);

  const forceUpdate = useForceUpdate();

  React.useEffect(() => {
    console.log('Language changed to:', language);
    dynamicActivate(language);
    setLanguageChanged(true);
    saveUserLocale(language);
    forceUpdate();
  }, [language]);

  const [nonRepudiable, setNonRepudiable] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!init) {
      setInit(true);
      (async () => {
        const config = await getConfig({
          address: currentPasskeyInfo!.address,
          userKey: keyset.userKeyset,
        });
        existingConfig.current = config;
        setAllowSync(config?.allowSync ?? allowSync);
        setNonRepudiable(config?.nonRepudiable ?? nonRepudiable);
      })();
    }
  }, [init]);

  const downloadKey = async () => {
    let content = await exportKey(currentPasskeyInfo!.address);
    let fileName = currentPasskeyInfo!.address + '.key';
    const blob = new Blob([content], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
  });

  React.useEffect(() => {
    if (acceptedFiles.length > 0) {
      (async () => {
        setFileData(await acceptedFiles[0].arrayBuffer());
      })();
    }
  }, [acceptedFiles]);

  const removeDevice = (identityKey: string) => {
    setStagedRegistration((reg: secureChannel.UserRegistration | undefined) => {
      return {
        ...reg!,
        device_registrations: reg!.device_registrations.filter(
          (d) => d.identity_public_key !== identityKey
        ),
      };
    });
  };

  const saveChanges = async () => {
    updateStoredPasskey(currentPasskeyInfo!.credentialId, {
      credentialId: currentPasskeyInfo!.credentialId,
      address: currentPasskeyInfo!.address,
      publicKey: currentPasskeyInfo!.publicKey,
      displayName: displayName,
      pfpUrl:
        acceptedFiles.length > 0 && fileData
          ? 'data:' +
            acceptedFiles[0].type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
          : currentPasskeyInfo!.pfpUrl,
      completedOnboarding: true,
    });
    setUser!({
      displayName: displayName,
      state: 'online',
      status: '',
      userIcon:
        acceptedFiles.length > 0 && fileData
          ? 'data:' +
            acceptedFiles[0].type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
          : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
      address: currentPasskeyInfo!.address,
    });
    updateUserProfile(
      displayName,
      acceptedFiles.length > 0 && fileData
        ? 'data:' +
            acceptedFiles[0].type +
            ';base64,' +
            Buffer.from(fileData).toString('base64')
        : (currentPasskeyInfo!.pfpUrl ?? DefaultImages.UNKNOWN_USER),
      currentPasskeyInfo!
    );
    await saveConfig({
      config: {
        ...existingConfig.current!,
        allowSync,
        nonRepudiable: nonRepudiable,
      },
      keyset: keyset,
    });
    dismiss();
  };

  return (
    <div className="modal-complex-container">
      <div className="modal-complex-layout">
        {/* Desktop/Tablet Sidebar */}
        <div className="modal-complex-sidebar">
          <div className="modal-nav-title">{t`Settings`}</div>
          <div
            onClick={() => setSelectedCategory('general')}
            className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
          >
            {t`General`}
          </div>
          <div
            onClick={() => setSelectedCategory('privacy')}
            className={`modal-nav-category ${selectedCategory === 'privacy' ? 'active' : ''}`}
          >
            {t`Privacy/Security`}
          </div>
          <div
            onClick={() => setSelectedCategory('appearance')}
            className={`modal-nav-category ${selectedCategory === 'appearance' ? 'active' : ''}`}
          >
            {t`Appearance`}
          </div>
        </div>

        {/* Mobile Stacked Menu */}
        <div className="modal-nav-mobile-single">
          <div
            onClick={() => setSelectedCategory('general')}
            className={`modal-nav-category ${selectedCategory === 'general' ? 'active' : ''}`}
          >
            {t`General`}
          </div>
          <div
            onClick={() => setSelectedCategory('privacy')}
            className={`modal-nav-category ${selectedCategory === 'privacy' ? 'active' : ''}`}
          >
            {t`Privacy/Security`}
          </div>
          <div
            onClick={() => setSelectedCategory('appearance')}
            className={`modal-nav-category ${selectedCategory === 'appearance' ? 'active' : ''}`}
          >
            {t`Appearance`}
          </div>
        </div>
        <div className="modal-complex-content">
        {(() => {
          switch (selectedCategory) {
            case 'general':
              return (
                <>
                  <div className="modal-content-header">
                    <div
                      className="modal-icon-editable"
                      style={{
                        backgroundImage:
                          fileData !== undefined && acceptedFiles.length !== 0
                            ? `url(data:${acceptedFiles[0].type};base64,${Buffer.from(fileData).toString('base64')})`
                            : currentPasskeyInfo?.pfpUrl &&
                                !currentPasskeyInfo.pfpUrl.includes(
                                  DefaultImages.UNKNOWN_USER
                                )
                              ? `url(${currentPasskeyInfo.pfpUrl})`
                              : 'var(--unknown-icon)',
                      }}
                      {...getRootProps()}
                    >
                      <input {...getInputProps()} />
                    </div>
                    <div className="modal-text-section">
                      <div className="modal-text-label">{t`Display Name`}</div>
                      <input
                        className="w-full quorum-input modal-input-text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal-content-section">
                    <div className="modal-content-info">
                      <div className="modal-text-label">{t`Account Address`}</div>
                      <div className="flex flex-row items-start text-base">
                        <div className="break-all flex-1 mr-2">
                          {currentPasskeyInfo!.address}
                        </div>
                        <CopyToClipboard
                          className="flex-shrink-0"
                          tooltipText={t`Copy address to clipboard`}
                          text={currentPasskeyInfo!.address}
                          tooltipLocation="top"
                        />
                      </div>
                    </div>
                    <div className="modal-content-actions">
                      <Button
                        type="primary"
                        onClick={() => {
                          saveChanges();
                        }}
                      >
                        {t`Save Changes`}
                      </Button>
                    </div>
                  </div>
                </>
              );
            case 'privacy':
              return (
                <>
                  <div className="modal-content-header">
                    <div className="modal-text-section">
                      <div className="modal-text-section-header">{t`Privacy/Security`}</div>
                      <div className="pt-1 modal-text-small text-main">
                        {t`Manage devices, and privacy conditions for messaging and synchronization.`}
                      </div>
                    </div>
                  </div>
                  <div className="modal-content-section">
                    <div className='modal-content-section-header'/>
                    <div className="modal-text-label pb-2">Devices</div>
                    {stagedRegistration?.device_registrations.map(
                      (d: secureChannel.DeviceRegistration, index: number) => (
                        <div
                          key={d.inbox_registration.inbox_address}
                          className={`flex flex-row justify-between items-start py-3 ${
                            index > 0 ? 'border-t border-dashed border-subtle' : ''
                          }`}
                        >
                          <div className="flex flex-col justify-around font-light break-all flex-1 mr-2">
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
                                type="danger"
                                size="small"
                              >
                                {t`Remove`}
                              </Button>
                            )}
                            {keyset.deviceKeyset.inbox_keyset.inbox_address ===
                              d.inbox_registration.inbox_address && (
                              <div className="font-light">(this device)</div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                 
                    <div className="modal-content-info !pt-4">
                      <div className="modal-content-section-header" />
                      <div className="modal-text-label">{t`Key Export`}</div>

                      <div className="pt-1 modal-text-small text-main">
                        {t`Export your key to a file by clicking this button. Do not share this file with anyone else or they can impersonate you or steal your Space's Apex earnings.`}
                      </div>
                      <div className="pt-4 pb-8 max-w-[100px]">
                        <Button
                          type="danger"
                          onClick={() => {
                            downloadKey();
                          }}
                        >
                          {t`Export`}
                        </Button>
                      </div>
                    </div>
                    <div className="modal-content-section-header" />
                    <div className="modal-text-label">{t`Security`}</div>

                    <div className="pt-1 modal-text-small text-main">
                      {t`Adjust security-related settings, which may impact user  experience but increase the security of your Quorum account.`}
                    </div>
                    <div className="modal-content-info">
                      <div className="flex flex-row justify-between pb-2">
                        <div className="text-sm flex flex-row">
                          <div className="text-sm flex flex-col justify-around">
                            {t`Enable sync`}
                          </div>
                          <>
                            <div
                              id="allow-sync-tooltip-anchor"
                              className="border border-strong rounded-full w-6 h-6 text-center leading-5 text-lg mt-1 ml-2 cursor-default"
                            >
                              ℹ
                            </div>
                            <ReactTooltip
                              id="allow-sync-tooltip"
                              anchorSelect="#allow-sync-tooltip-anchor"
                              content={t`When enabled, synchronizes your user data, Spaces, and Space keys between devices. Enabling this increases metadata visibility of your account, which can reveal when you have joined new Spaces, although not the Spaces you have joined.`}
                              place="right"
                              className="!w-[400px]"
                            />
                          </>
                        </div>

                        <ToggleSwitch
                          onClick={() => setAllowSync((prev) => !prev)}
                          active={allowSync}
                        />
                      </div>
                      <div className="flex flex-row justify-between">
                        <div className="text-sm flex flex-row">
                          <div className="text-sm flex flex-col justify-around">
                            {t`Non-repudiability`}
                          </div>
                          <>
                            <div
                              id="non-repudiable-tooltip-anchor"
                              className="border border-strong rounded-full w-6 h-6 text-center leading-5 text-lg mt-1 ml-2 cursor-default"
                            >
                              ℹ
                            </div>
                            <ReactTooltip
                              id="non-repudiable-tooltip"
                              anchorSelect="#non-repudiable-tooltip-anchor"
                              content={t`When enabled, direct messages are not signed by your user key...`}
                              place="right"
                              className="!w-[400px]"
                            />
                          </>
                        </div>

                        <ToggleSwitch
                          onClick={() => setNonRepudiable((prev) => !prev)}
                          active={nonRepudiable}
                        />
                      </div>
                    </div>
                    <div className="modal-content-actions">
                      <Button
                        type="primary"
                        onClick={() => {
                          saveChanges();
                        }}
                      >
                        {t`Save Changes`}
                      </Button>
                    </div>
                  </div>
                </>
              );
            case 'appearance':
              return (
                <div className="modal-content-section">
                  <div className="modal-text-section-header">{t`Appearance`}</div>
                  <div className="modal-text-small text-main">
                    {t`Choose your preferred theme for Quorum.`}
                  </div>
                  <ThemeRadioGroup />

                  <div className="pt-4">
                    <AccentColorSwitcher />
                  </div>

                  <div className="pt-4">
                    <div className='modal-content-section-header'/>
                    <div className="modal-text-label pb-2">{t`Language`}</div>
                    <div className="flex flex-row gap-2 items-center">
                      <select
                        className="quorum-input w-56 modal-input-select"
                        value={language}
                        onChange={async (e) => {
                          const selected =
                            e.target.value.toString() as keyof typeof locales;
                          setLanguage(selected);
                        }}
                      >
                        {Object.entries(locales).map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ReactTooltip
                        id="language-refresh-tooltip"
                        place="top"
                        anchorSelect="#language-refresh-button"
                        content={t`Changes are made automatically, but the active page may not be updated. Refresh the page to apply the new language.`}
                        className="!bg-surface-5 !text-main !w-[400px]"
                      />
                      <Button
                        id="language-refresh-button"
                        type="secondary"
                        disabled={!languageChanged}
                        onClick={forceUpdate}
                      >
                        {t`Refresh`}
                      </Button>
                    </div>
                  </div>
                </div>
              );
          }
        })()}
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
