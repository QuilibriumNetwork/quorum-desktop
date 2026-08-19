// Sending a space-manifest control message on the hub, in one place.
//
// This is the ONLY channel by which an already-joined member learns that a
// Space record changed. The manifest POSTed to the server is read exclusively
// by joiners and by device restores — no code path anywhere refetches it for an
// existing member — so a change that is POSTed but not broadcast reaches nobody
// who is already in the Space.
//
// Extracted as a free function rather than left as a SpaceService method
// because InvitationService needs it too and holds no SpaceService reference:
// InvitationService is constructed before SpaceService in MessageDB.tsx, so
// injecting one would need a reorder or a lazy getter. This mirrors mobile,
// where the equivalent (`sendSpaceManifestMessage`) is likewise a free
// function.

import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageDB } from '../db/messages';
import { hexToSpreadArray } from '../utils/crypto';

export interface BroadcastSpaceManifestDeps {
  messageDB: MessageDB;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
}

/**
 * Tell every existing member about a Space manifest.
 *
 * Pass the SAME manifest object that was POSTed to the server. Do not rebuild
 * one here and do not route a manifest through a helper that mints its own
 * ephemeral key: the invite path deliberately encrypts its manifest with the
 * same ephemeral X448 key as the invite eval, and re-publishing under a
 * different key breaks the legacy-server fallback. That exact mismatch caused
 * months of "expired or invalid public invite link" reports.
 *
 * Sealing happens inside `enqueueOutbound` so the keys are read at send time
 * rather than at call time.
 */
export function broadcastSpaceManifest(
  { messageDB, enqueueOutbound }: BroadcastSpaceManifestDeps,
  manifest: secureChannel.SpaceManifest
): void {
  enqueueOutbound(async () => {
    const hubKey = await messageDB.getSpaceKey(manifest.space_address, 'hub');
    const configKey = await messageDB.getSpaceKey(
      manifest.space_address,
      'config'
    );

    const envelope = await secureChannel.SealHubEnvelope(
      hubKey.address!,
      {
        type: 'ed448',
        private_key: [...hexToSpreadArray(hubKey.privateKey)],
        public_key: [...hexToSpreadArray(hubKey.publicKey)],
      },
      JSON.stringify({
        type: 'control',
        message: {
          type: 'space-manifest',
          manifest: manifest,
        },
      }),
      configKey
        ? {
            type: 'x448',
            public_key: [...hexToSpreadArray(configKey.publicKey)],
            private_key: [...hexToSpreadArray(configKey.privateKey)],
          }
        : undefined
    );

    return [JSON.stringify({ type: 'group', ...envelope })];
  });
}
