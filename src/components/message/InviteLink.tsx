import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Space } from '../../api/quorumApi';
import SpaceIcon from '../navbar/SpaceIcon';
import { useSpaces } from '../../hooks';
import Button from '../Button';
import { useMessageDB } from '../context/MessageDB';
import { useNavigate } from 'react-router';

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
        setError('Could not verify invite');
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
    <div className="w-[400px] rounded-md p-3 bg-surface-5 border border-surface-6">
      {error && (
        <div className="error-label mb-2">
          The invite link has expired or is invalid.
        </div>
      )}
      {space && (
        <div className="font-bold flex flex-col">
          <div>You've been invited to join a space</div>
          <div className="flex flex-row">
            <SpaceIcon
              noToggle={true}
              noTooltip={true}
              notifs={false}
              spaceName={space.spaceName}
              size="regular"
              selected={true}
              iconUrl={space.iconUrl}
            />
            <div className="flex flex-row grow justify-between pl-2">
              <div className="flex flex-col w-[200px] justify-around truncate">
                {space?.spaceName}
              </div>
              <div className="flex flex-col justify-around">
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
                    ? 'Joined'
                    : 'Join'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
