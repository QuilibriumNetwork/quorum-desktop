// PublicProfileService.ts
//
// Publish / unpublish the user's public profile to the server's
// `POST/DELETE /users/:addr/public-profile` endpoint. The user opts in via
// `UserConfig.isProfilePublic`; when enabled, this service uploads a signed
// plaintext profile (display_name, profile_image, bio) so that anyone (even
// users we don't share a space with) can resolve our identity by address.
//
// The server's verification format (mirrored from mobile's
// `services/profile/publicProfile.ts` — kept identical so cross-platform
// signatures verify):
//
//   POST   sign(userPrivKey, "public-profile:" + addr + ":" + displayName
//                                            + ":" + profileImage + ":"
//                                            + bio + ":" + BE64(timestamp))
//   DELETE sign(userPrivKey, "delete-public-profile:" + addr + ":"
//                                            + BE64(timestamp))
//
// The server uses the `UserPublicKey` already on file (from the user
// registration) to verify the signature.
//
// v2 payload format adds an optional `primary_username` (QNS name) — desktop
// has no QNS plumbing (see candidates.md #12), so we always publish v1.
// `farcasterLink` is also server-supported but unused on desktop until a
// Farcaster product decision (candidates.md #9).
//
// TODO(shared-promotion): mobile's `services/profile/publicProfile.ts` has a
// local `int64BE` helper that duplicates shared's `int64ToBytes`. The
// canonicalize-then-sign pattern here is also used by Reporting
// (candidates.md #5, deferred). When #5 lands, extract a shared module for
// both — see candidates.md #6 "Shared-promotion opportunity" and the
// pointer in quorum-shared-migration/README.md.

import { int64ToBytes, logger } from '@quilibrium/quorum-shared';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { QuorumApiClient } from '../api/baseTypes';

export interface PublishProfileInput {
  address: string;
  displayName: string;
  profileImage: string;
  bio: string;
}

export class PublicProfileService {
  private apiClient: QuorumApiClient;

  constructor(dependencies: { apiClient: QuorumApiClient }) {
    this.apiClient = dependencies.apiClient;
  }

  async publish(
    input: PublishProfileInput,
    keyset: { userKeyset: secureChannel.UserKeyset }
  ): Promise<void> {
    const timestamp = Date.now();
    const enc = new TextEncoder();

    const payloadString = `public-profile:${input.address}:${input.displayName}:${input.profileImage}:${input.bio}:`;
    const payloadBytes = new Uint8Array([
      ...enc.encode(payloadString),
      ...int64ToBytes(timestamp),
    ]);

    const signature = this.signWithUserKey(payloadBytes, keyset.userKeyset);

    logger.log('[PublicProfileService] Publishing profile', {
      address: input.address,
      timestamp,
    });

    await this.apiClient.postPublicProfile(input.address, {
      display_name: input.displayName,
      profile_image: input.profileImage,
      bio: input.bio,
      timestamp,
      signature,
    });

    logger.log('[PublicProfileService] Profile published');
  }

  async unpublish(
    address: string,
    keyset: { userKeyset: secureChannel.UserKeyset }
  ): Promise<void> {
    const timestamp = Date.now();
    const enc = new TextEncoder();

    const payloadBytes = new Uint8Array([
      ...enc.encode(`delete-public-profile:${address}:`),
      ...int64ToBytes(timestamp),
    ]);

    const signature = this.signWithUserKey(payloadBytes, keyset.userKeyset);

    logger.log('[PublicProfileService] Unpublishing profile', {
      address,
      timestamp,
    });

    await this.apiClient.deletePublicProfile(address, {
      timestamp,
      signature,
    });

    logger.log('[PublicProfileService] Profile unpublished');
  }

  // Sign a payload with the user's Ed448 private key.
  //
  // Returns the signature as a hex string (the wire format the server
  // expects for the `signature` field on the publish/delete payloads).
  //
  // Plumbing notes (matches ConfigService.saveConfig at line ~483):
  // - `ch.js_sign_ed448` accepts base64-encoded private key + message
  // - It returns a JSON-encoded base64 string of the signature
  // - The server's verify path on the public-profile endpoint expects hex
  private signWithUserKey(
    payload: Uint8Array,
    userKeyset: secureChannel.UserKeyset
  ): string {
    const privateKeyBase64 = Buffer.from(
      new Uint8Array(userKeyset.user_key.private_key)
    ).toString('base64');
    const messageBase64 = Buffer.from(payload).toString('base64');

    const signatureBase64 = JSON.parse(
      ch.js_sign_ed448(privateKeyBase64, messageBase64)
    ) as string;

    return Buffer.from(signatureBase64, 'base64').toString('hex');
  }
}
