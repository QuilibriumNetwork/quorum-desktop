import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Space } from '../../api/quorumApi';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaces } from '../../hooks';
import Button from '../Button';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

export const InviteLink = ({ inviteLink }: { inviteLink: string }) => {
  const [error, setError] = useState<string>();
  const [space, setSpace] = useState<Space>();
  const [joining, setJoining] = useState<boolean>(false);
  const { data: spaces } = useSpaces({});
  const { processInviteLink, joinInviteLink, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setSpace(await processInviteLink(inviteLink));
      } catch (e) {
        setError(t`Could not verify invite`);
      }
    })();
  }, [inviteLink]);

  const join = useCallback(async () => {
    setJoining(true);
    try {
      const result = await joinInviteLink(
        inviteLink,
        keyset,
        currentPasskeyInfo!
      );
      if (result) {
        navigate('/spaces/' + result.spaceId + '/' + result.channelId);
      }
    } catch (e: any) {
      console.error(e);
      setError(e);
    }
    setJoining(false);
  }, [joinInviteLink, keyset, currentPasskeyInfo, inviteLink]);

  return (
    <div className="max-w-[500px] lg:max-w-[500px] md:max-w-[500px] sm:max-w-[300px] w-fit rounded-md p-3 bg-surface-5 border border-surface-6">
      {error && (
        <div className="error-label mb-2 text-center sm:text-left">
          <Trans>The invite link has expired or is invalid.</Trans>
        </div>
      )}
      {space && (
        <div className="font-bold flex flex-col items-center sm:items-start">
          <div className="mb-2 text-center sm:text-left"><Trans>You've been invited to join a Space</Trans></div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full items-center sm:items-stretch">
            <div className="flex flex-row items-center flex-1 min-w-0 justify-center sm:justify-start">
              <div className="flex items-center bg-surface-4 rounded-lg px-2 py-2 gap-3 pr-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{
                  backgroundImage: space.iconUrl ? `url(${space.iconUrl})` : '',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  backgroundColor: 'var(--surface-2)'
                }}>
                </div>
                <span className="truncate font-medium">{space?.spaceName}</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-shrink-0">
              <Button
                className="px-6"
                onClick={() => {
                  join();
                }}
                type="primary"
                disabled={
                  joining || !!spaces.find((s) => s.spaceId === space.spaceId)
                }
              >
                {spaces.find((s) => s.spaceId === space.spaceId)
                  ? t`Joined`
                  : t`Join`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
