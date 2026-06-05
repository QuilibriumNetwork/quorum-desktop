import * as React from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useSpaces } from '../hooks';
import { useConfig } from '../hooks/queries/config';
import { useSpaceTagStartupRefresh } from '../hooks/business/spaces/useSpaceTagStartupRefresh';

/**
 * Side-effect-only mount that runs app-wide startup checks once data is loaded.
 *
 * Previously these effects lived inside NavMenu; they're decoupled here so the
 * new shell can keep its sidebars feature-focused and so the effects fire
 * regardless of which sidebar is active.
 *
 * Currently runs:
 * - useSpaceTagStartupRefresh — clears stale spaceTagId or re-broadcasts the
 *   user's profile when the space owner's tag design changed.
 */
export const StartupEffects: React.FC = () => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const { data: spaces = [] } = useSpaces({});
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  useSpaceTagStartupRefresh({ spaces, config });

  return null;
};

export default StartupEffects;
