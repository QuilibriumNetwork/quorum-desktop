import React, {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRegistration } from '../../hooks';
import {
  passkey,
  channel as secureChannel,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { useUploadRegistration } from '../../hooks/mutations/useUploadRegistration';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import Button from '../Button';
import { useMessageDB } from './MessageDB';
import { useQuorumApiClient } from './QuorumApiContext';
import { t } from '@lingui/core/macro';
import { getDefaultUserConfig } from '../../utils';

type RegistrationContextValue = {
  keyset: {
    userKeyset: secureChannel.UserKeyset;
    deviceKeyset: secureChannel.DeviceKeyset;
  };
};

type RegistrationContextProps = {
  children: ReactNode;
};

const RegistrationProvider: FC<RegistrationContextProps> = ({ children }) => {
  const { currentPasskeyInfo, exportKey } = usePasskeysContext();
  const [clickRestore, setClickRestore] = useState(false);
  const [init, setInit] = useState(false);
  const { keyset, setKeyset, setSelfAddress, getConfig, saveConfig } =
    useMessageDB();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  useEffect(() => {
    if (!init) {
      setInit(true);

      if (!registration.registered) {
        setTimeout(
          () =>
            (async () => {
              let user_key: Uint8Array;
              try {
                user_key = new Uint8Array(
                  Buffer.from(
                    await exportKey(currentPasskeyInfo!.address),
                    'hex'
                  )
                );
              } catch (e: any) {
                if (e.name === 'NotAllowedError') {
                  setClickRestore(true);
                  return;
                } else {
                  throw e;
                }
              }
              try {
                const data = await passkey.loadKeyDecryptData(2);
                const envelope = JSON.parse(
                  Buffer.from(data).toString('utf-8')
                );
                const key = await passkey.createKeyFromBuffer(
                  user_key as unknown as ArrayBuffer
                );
                const inner = JSON.parse(
                  Buffer.from(
                    await passkey.decrypt(
                      new Uint8Array(envelope.ciphertext),
                      new Uint8Array(envelope.iv),
                      key
                    )
                  ).toString('utf-8')
                );
                const senderIdent = inner.identity;
                const senderDevice = inner.device;
                let existing: secureChannel.UserRegistration | undefined;
                try {
                  existing = (
                    await apiClient.getUser(currentPasskeyInfo!.address)
                  )?.data;
                } catch {}

                const senderRegistration =
                  await secureChannel.ConstructUserRegistration(
                    senderIdent,
                    existing?.device_registrations ?? [],
                    [senderDevice]
                  );
                uploadRegistration({
                  address: currentPasskeyInfo!.address,
                  registration: senderRegistration,
                });
              } catch (e) {
                const senderIdent = secureChannel.NewUserKeyset({
                  type: 'ed448',
                  private_key: [...user_key],
                  public_key: [
                    ...new Uint8Array(
                      Buffer.from(currentPasskeyInfo!.publicKey, 'hex')
                    ),
                  ],
                });
                const senderDevice = await secureChannel.NewDeviceKeyset();
                let existing: secureChannel.UserRegistration | undefined;
                try {
                  existing = (
                    await apiClient.getUser(currentPasskeyInfo!.address)
                  )?.data;
                } catch {}

                const senderRegistration =
                  await secureChannel.ConstructUserRegistration(
                    senderIdent,
                    existing?.device_registrations ?? [],
                    [senderDevice]
                  );
                const key = await passkey.createKeyFromBuffer(
                  user_key as unknown as ArrayBuffer
                );
                const inner = await passkey.encrypt(
                  Buffer.from(
                    JSON.stringify({
                      identity: senderIdent,
                      device: senderDevice,
                    }),
                    'utf-8'
                  ),
                  key
                );
                const envelope = Buffer.from(
                  JSON.stringify({
                    iv: [...inner.iv],
                    ciphertext: [...new Uint8Array(inner.ciphertext)],
                  }),
                  'utf-8'
                );
                await passkey.encryptDataSaveKey(2, envelope);
                uploadRegistration({
                  address: currentPasskeyInfo!.address,
                  registration: senderRegistration,
                });
              }
            })(),
          200
        );
      } else {
        setTimeout(
          () =>
            (async () => {
              try {
                const user_key = new Uint8Array(
                  Buffer.from(
                    await exportKey(currentPasskeyInfo!.address),
                    'hex'
                  )
                );
                const data = await passkey.loadKeyDecryptData(2);
                const envelope = JSON.parse(
                  Buffer.from(data).toString('utf-8')
                );
                const key = await passkey.createKeyFromBuffer(
                  user_key as unknown as ArrayBuffer
                );
                const inner = JSON.parse(
                  Buffer.from(
                    await passkey.decrypt(
                      new Uint8Array(envelope.ciphertext),
                      new Uint8Array(envelope.iv),
                      key
                    )
                  ).toString('utf-8')
                );
                const senderIdent = inner.identity;
                const senderDevice = inner.device;
                if (
                  !registration.registration?.device_registrations.find(
                    (d: secureChannel.DeviceRegistration) =>
                      d.inbox_registration.inbox_address ==
                      senderDevice.inbox_keyset.inbox_address
                  )
                ) {
                  let existing: secureChannel.UserRegistration | undefined;
                  try {
                    existing = (
                      await apiClient.getUser(currentPasskeyInfo!.address)
                    )?.data;
                  } catch {}
                  const senderRegistration =
                    await secureChannel.ConstructUserRegistration(
                      senderIdent,
                      existing?.device_registrations ?? [],
                      [senderDevice]
                    );
                  uploadRegistration({
                    address: currentPasskeyInfo!.address,
                    registration: senderRegistration,
                  });
                }
                setSelfAddress(currentPasskeyInfo!.address);
                setKeyset({
                  deviceKeyset: senderDevice,
                  userKeyset: senderIdent,
                });
                const userConfig = await getConfig({
                  address: currentPasskeyInfo!.address,
                  userKey: senderIdent,
                });
                if (userConfig === undefined) {
                  const defaultConfig = getDefaultUserConfig(
                    currentPasskeyInfo!.address
                  );
                  saveConfig({
                    config: defaultConfig,
                    keyset,
                  });
                }
              } catch (e: any) {
                if (e.name === 'NotAllowedError') {
                  setClickRestore(true);
                } else {
                  throw e;
                }
              }
            })(),
          200
        );
      }
    }
  }, [init, registration]);

  return (
    <RegistrationContext.Provider
      value={{
        keyset,
      }}
    >
      {!clickRestore && children}
      {clickRestore && (
        <>
          <div className="flex flex-col grow"></div>
          <div className="flex flex-col select-none">
            <div className="flex flex-row grow"></div>
            <div className="flex flex-row grow font-semibold text-2xl">
              <div className="flex flex-col grow"></div>
              <div className="flex flex-col">{t`Session Encrypted`}</div>
              <div className="flex flex-col grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] py-4 text-center">
                <FontAwesomeIcon size="4x" icon={faLock} />
              </div>
              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] py-4 text-justify">
                {t`Quorum was loaded while the browser was not in focus or a passkey request was rejected. Please reauthorize to access your messages.`}
              </div>
              <div className="grow"></div>
            </div>
            <div className="flex flex-row justify-center">
              <div className="grow"></div>
              <div className="w-[460px] pt-4 text-center">
                <Button
                  type="primary"
                  className="px-8"
                  onClick={() => {
                    setInit(false);
                    setClickRestore(false);
                  }}
                >
                  {t`Reauthorize`}
                </Button>
              </div>
              <div className="grow"></div>
            </div>
            <div className="flex flex-row grow"></div>
          </div>
          <div className="flex flex-col grow"></div>
        </>
      )}
    </RegistrationContext.Provider>
  );
};

const RegistrationContext = createContext<RegistrationContextValue>({
  keyset: undefined as never,
});

const useRegistrationContext = () => useContext(RegistrationContext);

export { RegistrationProvider, useRegistrationContext };
