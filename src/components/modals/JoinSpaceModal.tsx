import * as React from 'react';
import {
  channel_raw as ch,
  usePasskeysContext,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Input from '../Input';
import Button from '../Button';
import SpaceIcon from '../navbar/SpaceIcon';
import './JoinSpaceModal.scss';
import { useLocation, useNavigate } from 'react-router';
import { getConfig } from '../../config/config';
import { useQuorumApiClient } from '../context/QuorumApiContext';
import { Space } from '../../api/quorumApi';
import { useMessageDB } from '../context/MessageDB';
import { t } from '@lingui/core/macro';

type JoinSpaceModalProps = {
  visible: boolean;
  onClose: () => void;
};

const JoinSpaceModal: React.FunctionComponent<JoinSpaceModalProps> = (
  props
) => {
  let [space, setSpace] = React.useState<
    { iconUrl: string; spaceName: string; spaceId: string } | undefined
  >(undefined);
  let { hash, pathname } = useLocation();
  let [init, setInit] = React.useState<boolean>(false);
  let [lookup, setLookup] = React.useState<string>();

  // let connection = props.connection as WebSocket;
  let navigate = useNavigate();
  let [info, setInfo] = React.useState<{
    spaceId: string;
    configKey: string;
  }>();
  let [error, setError] = React.useState<string>();
  const { joinInviteLink, keyset } = useMessageDB();
  const [joining, setJoining] = React.useState<boolean>(false);
  const { currentPasskeyInfo } = usePasskeysContext();
  const { apiClient } = useQuorumApiClient();

  React.useEffect(() => {
    if (!init) {
      setInit(true);
      if (hash.trim().length > 0) {
        setLookup('qm.one/' + hash);
      }
    }
  }, [init, hash]);

  React.useEffect(() => {
    setError(undefined);
    setSpace(undefined);
    (async () => {
      if (
        lookup?.startsWith('https://app.quorummessenger.com/invite/#') ||
        lookup?.startsWith('https://qm.one/#') ||
        lookup?.startsWith('https://qm.one/invite/#') ||
        lookup?.startsWith('app.quorummessenger.com/invite/#') ||
        lookup?.startsWith('qm.one/#')
      ) {
        const output = lookup
          .split('#')[1]
          .split('&')
          .map((l) => {
            const [key, value] = l.split('=');
            if (!key || !value) {
              return undefined;
            }

            if (key != 'spaceId' && key != 'configKey') {
              return undefined;
            }

            return { [key]: value };
          })
          .filter((l) => !!l)
          .reduce((prev, curr) => Object.assign(prev, curr), {});

        if (output) {
          const info = output as { spaceId: string; configKey: string };

          try {
            const manifest = await apiClient.getSpaceManifest(info.spaceId);
            if (!manifest) {
              throw new Error(t`invalid response`);
            }

            const ciphertext = JSON.parse(manifest.data.space_manifest) as {
              ciphertext: string;
              initialization_vector: string;
              associated_data: string;
            };
            const space = JSON.parse(
              Buffer.from(
                JSON.parse(
                  ch.js_decrypt_inbox_message(
                    JSON.stringify({
                      inbox_private_key: [
                        ...new Uint8Array(Buffer.from(info.configKey, 'hex')),
                      ],
                      ephemeral_public_key: [
                        ...new Uint8Array(
                          Buffer.from(manifest.data.ephemeral_public_key, 'hex')
                        ),
                      ],
                      ciphertext: ciphertext,
                    })
                  )
                )
              ).toString('utf-8')
            ) as Space;
            setSpace(space);
          } catch (e) {
            setError(t`Could not verify invite`);
          }
        }
      }
    })();
  }, [lookup]);

  const join = React.useCallback(async () => {
    setJoining(true);
    try {
      const result = await joinInviteLink(lookup!, keyset, currentPasskeyInfo!);
      if (result) {
        navigate('/spaces/' + result.spaceId + '/' + result.channelId);
      }
    } catch (e: any) {
      console.error(e);
      setError(e);
    }
    setJoining(false);
  }, [joinInviteLink, keyset, currentPasskeyInfo, lookup]);

  return (
    <div className="quorum-modal text-subtle relative pointer-events-auto">
      <div
        className="quorum-modal-close select-none cursor-pointer"
        onClick={props.onClose}
      >
        <FontAwesomeIcon icon={faTimes} />
      </div>
      <div className="quorum-modal-title select-none cursor-default">
        {t`Join Space`}
      </div>
      <div className="quorum-modal-container">
        <div className="modal-join-space modal-width-medium">
          <div className="w-full flex justify-center">
            <Input
              className="w-full max-w-[500px] mx-auto !text-sm"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder={t`Join Space`}
            />
          </div>
          <div className="modal-join-space-icon">
            {!space ? (
              <SpaceIcon
                noTooltip={true}
                notifs={false}
                spaceName={t`Unknown`}
                size="large"
                selected={false}
                iconUrl="/quorumicon.png"
              />
            ) : (
              <>
                <SpaceIcon
                  noToggle={true}
                  noTooltip={true}
                  notifs={false}
                  spaceName={space.spaceName}
                  size="large"
                  selected={true}
                  iconUrl={space.iconUrl}
                />
                <div className="mt-4 text-lg sm:text-xl text-strong">{space.spaceName}</div>
              </>
            )}
          </div>
          <div className="modal-join-space-actions">
            <Button
              className="w-full sm:max-w-32 sm:inline-block"
              type="primary"
              disabled={!space || joining}
              onClick={() => {
                if (!!space) {
                  join();
                }
              }}
            >
              {t`Join Space`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinSpaceModal;
