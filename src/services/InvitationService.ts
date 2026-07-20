// InvitationService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles space invitation operations

import { logger, int64ToBytes, parseInviteParams, getInviteUrlBase } from '@quilibrium/quorum-shared';
import { MessageDB, NavItem } from '../db/messages';
import { QuorumApiClient } from '../api/baseTypes';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
import { t } from '@lingui/core/macro';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildConfigKey, buildSpaceKey } from '../hooks';
import type { Space } from '@quilibrium/quorum-shared';
import { isQuorumApiError } from '../api/baseTypes';
import type { Ref } from '../types/ref';
import type { SpaceInfoMap } from '../types/spaceRefs';

// Mobile generates invite URLs with the long prod domain (app.quorummessenger.com).
// Shared's getInviteUrlBase still emits qm.one for the prod browser case; override
// here so desktop matches mobile until shared is updated in a separate cross-repo PR.
// Acceptance of qm.one links keeps working via getValidInvitePrefixes().
function buildInviteBase(isPublic: boolean): string {
  return getInviteUrlBase(isPublic).replace('://qm.one/', '://app.quorummessenger.com/');
}

const MAX_PUBLIC_EVALS = 1;

/**
 * Thrown when a space's local invite-evals pool is empty. This typically
 * happens on spaces where the legacy (pre-2026-06-07) `generateNewInviteLink`
 * was run, since that path drained the entire pool into the server-side eval
 * batch. New spaces start with ~10K evals and lose one per invite, so they
 * won't hit this in practice.
 *
 * Callers catch this specifically to render a friendly UI instead of the raw
 * error message.
 */
export class InviteEvalsExhaustedError extends Error {
  constructor() {
    super('Invite evaluations exhausted for this Space.');
    this.name = 'InviteEvalsExhaustedError';
  }
}

export class InvitationService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private spaceInfo: Ref<SpaceInfoMap>;
  private selfAddress: string;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private queryClient: QueryClient;
  private getConfig: (params: { address: string; userKey: secureChannel.UserKeyset }) => Promise<any>;
  private saveConfig: (params: { config: any; keyset: any }) => Promise<void>;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private requestSync: (spaceId: string) => Promise<void>;

  constructor(dependencies: {
    messageDB: MessageDB;
    apiClient: QuorumApiClient;
    spaceInfo: Ref<SpaceInfoMap>;
    selfAddress: string;
    enqueueOutbound: (action: () => Promise<string[]>) => void;
    queryClient: QueryClient;
    getConfig: (params: { address: string; userKey: secureChannel.UserKeyset }) => Promise<any>;
    saveConfig: (params: { config: any; keyset: any }) => Promise<void>;
    sendHubMessage: (spaceId: string, message: string) => Promise<string>;
    requestSync: (spaceId: string) => Promise<void>;
  }) {
    this.messageDB = dependencies.messageDB;
    this.apiClient = dependencies.apiClient;
    this.spaceInfo = dependencies.spaceInfo;
    this.selfAddress = dependencies.selfAddress;
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.queryClient = dependencies.queryClient;
    this.getConfig = dependencies.getConfig;
    this.saveConfig = dependencies.saveConfig;
    this.sendHubMessage = dependencies.sendHubMessage;
    this.requestSync = dependencies.requestSync;
  }

  /**
   * Constructs one-time invite link with embedded template/secret (consumes one eval).
   *
   * Matches mobile (`quorum-mobile/services/space/inviteService.ts` -> `generatePrivateInviteLink`):
   * always builds a fresh one-time link from the local evals pool, even when the
   * space already has a public `inviteUrl`. Public and one-time invites coexist.
   */
  async constructInviteLink(spaceId: string) {
    const config_key = await this.messageDB.getSpaceKey(spaceId, 'config');
    const hub_key = await this.messageDB.getSpaceKey(spaceId, 'hub');
    const response = await this.messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });

    if (!response || response.length === 0) {
      throw new Error(t`No encryption state found for this Space. The Space may need to be initialized or you may need to generate a public invite link first.`);
    }

    const sets = response.map((e) => JSON.parse(e.state));

    if (!sets[0] || !sets[0].template) {
      throw new Error(t`Encryption state is missing required template data. Please generate a public invite link first.`);
    }

    if (!sets[0].evals || sets[0].evals.length === 0) {
      throw new InviteEvalsExhaustedError();
    }

    // Deep-copy the template so we don't mutate the shared object that gets
    // persisted back to the DB. Mirrors mobile's defensive pattern
    // (`quorum-mobile/services/space/inviteService.ts` line 148).
    const state = JSON.parse(JSON.stringify(sets[0].template));
    const ratchet = JSON.parse(state.dkg_ratchet);
    ratchet.id = 10001 - sets[0].evals.length;

    if (!sets[0].state) {
      throw new Error(t`Encryption state is missing state data. Please generate a public invite link first.`);
    }

    const parsedState = typeof sets[0].state === 'string' ? JSON.parse(sets[0].state) : sets[0].state;
    state.root_key = parsedState.root_key;
    state.dkg_ratchet = JSON.stringify(ratchet);
    const template = Buffer.from(JSON.stringify(state), 'utf-8').toString(
      'hex'
    );
    const index_secret_raw = sets[0].evals.shift();
    const secret = Buffer.from(new Uint8Array(index_secret_raw)).toString(
      'hex'
    );
    await this.messageDB.saveEncryptionState(
      { ...response[0], state: JSON.stringify(sets[0]) },
      true
    );
    const link = `${buildInviteBase(false)}#spaceId=${spaceId}&configKey=${config_key.privateKey}&template=${template}&secret=${secret}&hubKey=${hub_key.privateKey}`;
    return link;
  }

  /**
   * Sends an invite link to a user via DM.
   *
   * `mode` selects the kind of link sent:
   *  - `'one-time'` (default): generates a fresh one-time link from the local
   *    evals pool. Each call consumes one eval.
   *  - `'public'`: reuses the space's existing `inviteUrl` (the persistent
   *    public link). Throws if no public link exists yet — caller should
   *    generate one first.
   *  - `'reuse'`: sends the explicit `presetLink` argument. The caller is
   *    responsible for having generated it already (e.g. via the Generate
   *    Invite Link button). No eval is consumed by this call.
   */
  async sendInviteToUser(
    address: string,
    spaceId: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    keyset: any,
    submitMessage: any,
    mode: 'one-time' | 'public' | 'reuse' = 'one-time',
    presetLink?: string
  ) {
    let link: string;
    if (mode === 'reuse') {
      if (!presetLink) {
        throw new Error('sendInviteToUser called with mode=reuse but no presetLink');
      }
      link = presetLink;
    } else if (mode === 'public') {
      const space = await this.messageDB.getSpace(spaceId);
      if (!space?.inviteUrl) {
        throw new Error(
          t`No public invite link exists yet. Generate one before sharing.`
        );
      }
      link = space.inviteUrl;
    } else {
      link = await this.constructInviteLink(spaceId);
    }

    const self = await this.apiClient.getUser(currentPasskeyInfo.address);
    const recipient = await this.apiClient.getUser(address);
    await submitMessage(
      address,
      link,
      self.data,
      recipient.data,
      this.queryClient,
      currentPasskeyInfo,
      keyset
    );
  }

  /**
   * Generate (or regenerate) the public invite link for a space.
   *
   * Mirrors mobile (`quorum-mobile/services/space/inviteService.ts` ->
   * `generatePublicInviteLink`): reuses the EXISTING space config key (no new
   * keypair, no member rekey), uploads exactly ONE encrypted eval to the
   * server, and re-publishes the manifest. Private/one-time invites continue
   * to work in parallel — the old "system switch" behavior is gone.
   *
   * The `user_keyset`/`device_keyset`/`registration` parameters are kept on the
   * method signature for compatibility with existing callers (MessageDB ->
   * useInviteManagement); they are unused under the mobile-aligned model
   * because there is no triple-ratchet rekey loop.
   */
  async generateNewInviteLink(
    spaceId: string,
    _user_keyset: secureChannel.UserKeyset,
    _device_keyset: secureChannel.DeviceKeyset,
    _registration: secureChannel.UserRegistration
  ) {
    try {
      const space = await this.messageDB.getSpace(spaceId);
      if (!space) {
        throw new Error(t`Space not found`);
      }

      const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
      if (!ownerKey?.privateKey) {
        throw new Error(
          t`Only space owners can generate public invite links.`
        );
      }

      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      if (!hubKey?.privateKey) {
        throw new Error(t`Hub key not found for this Space.`);
      }

      // Reuse the EXISTING config key — do not generate a new keypair.
      // This is what keeps private one-time invites working alongside public:
      // the local DKG template/evals stay valid because the config key is
      // unchanged.
      const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
      if (!configKey?.privateKey || !configKey?.publicKey) {
        throw new Error(t`Config key not found for this Space.`);
      }

      const configPublicKeyBytes = hexToSpreadArray(configKey.publicKey);

      // Load encryption state for the space's own conversation. The template
      // and evals pool we use here are identical to the ones used for private
      // invite generation in constructInviteLink.
      const encryptionStates = await this.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      if (!encryptionStates || encryptionStates.length === 0) {
        throw new Error(
          t`No encryption state found for this Space. Cannot generate public invite.`
        );
      }
      const stateRow = encryptionStates[0];
      const session = JSON.parse(stateRow.state);

      if (!session.template) {
        throw new Error(
          t`Encryption state is missing required template data. The invite pool was not initialized.`
        );
      }
      if (!session.evals || session.evals.length === 0) {
        throw new InviteEvalsExhaustedError();
      }
      if (!session.state) {
        throw new Error(t`Encryption state is missing state data.`);
      }

      // Ephemeral keypair used to encrypt both the eval and the manifest.
      const ephemeralKey = JSON.parse(
        ch.js_generate_x448()
      ) as secureChannel.X448Keypair;

      // Build a single eval payload (MAX_PUBLIC_EVALS = 1). Matches mobile.
      const evalsToProcess = session.evals.slice(0, MAX_PUBLIC_EVALS);
      const spaceEvals: string[] = [];
      let idCounter = 10001 - session.evals.length;

      const parsedState =
        typeof session.state === 'string'
          ? JSON.parse(session.state)
          : session.state;

      for (const evalData of evalsToProcess) {
        // Deep-copy the template so we don't mutate the shared template that
        // private invites also use.
        const sendState = JSON.parse(JSON.stringify(session.template));
        const ratchet = JSON.parse(sendState.dkg_ratchet);

        ratchet.id = idCounter;
        sendState.root_key = parsedState.root_key;

        const secretPair = JSON.parse(ch.js_generate_x448());
        const ephPair = JSON.parse(ch.js_generate_x448());

        const evalSecretBase64 = Buffer.from(
          new Uint8Array(evalData)
        ).toString('base64');

        ratchet.secret = Buffer.from(
          new Uint8Array(secretPair.private_key)
        ).toString('base64');
        ratchet.scalar = evalSecretBase64;
        const evalPoint = JSON.parse(ch.js_get_pubkey_x448(evalSecretBase64));
        ratchet.point = evalPoint;
        ratchet.random_commitment_point = Buffer.from(
          new Uint8Array(secretPair.public_key)
        ).toString('base64');

        sendState.dkg_ratchet = JSON.stringify(ratchet);
        sendState.next_dkg_ratchet = JSON.stringify(ratchet);
        sendState.ephemeral_private_key = Buffer.from(
          new Uint8Array(ephPair.private_key)
        ).toString('base64');

        const template = JSON.stringify(sendState);

        const evalPayload = {
          id: idCounter,
          template: template,
          secret: Buffer.from(new Uint8Array(evalData)).toString('hex'),
          hubKey: hubKey.privateKey,
        };

        const ciphertext = ch.js_encrypt_inbox_message(
          JSON.stringify({
            inbox_public_key: configPublicKeyBytes,
            ephemeral_private_key: ephemeralKey.private_key,
            plaintext: [
              ...new Uint8Array(
                Buffer.from(JSON.stringify(evalPayload), 'utf-8')
              ),
            ],
          } as secureChannel.SealedInboxMessageEncryptRequest)
        );

        spaceEvals.push(ciphertext);
        idCounter++;
      }

      // Signature payload is all eval ciphertexts concatenated as utf-8 bytes.
      const evalsPayloadBase64 = Buffer.from(
        new Uint8Array(
          spaceEvals.flatMap((s) => [
            ...new Uint8Array(Buffer.from(s, 'utf-8')),
          ])
        )
      ).toString('base64');
      const evalsSignatureBase64 = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
          evalsPayloadBase64
        )
      );

      // Build the new public invite URL using the EXISTING config private key.
      // The URL string is therefore deterministic per space — regenerating
      // produces the same URL, only the server-side eval and manifest change.
      const inviteLink = `${buildInviteBase(true)}#spaceId=${spaceId}&configKey=${configKey.privateKey}`;
      space.inviteUrl = inviteLink;

      // Re-publish the manifest encrypted with the existing config key. This
      // is what gives new joiners a current snapshot (name, members, channels)
      // when they fetch via the public link.
      const manifestCiphertext = ch.js_encrypt_inbox_message(
        JSON.stringify({
          inbox_public_key: configPublicKeyBytes,
          ephemeral_private_key: ephemeralKey.private_key,
          plaintext: [
            ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
          ],
        } as secureChannel.SealedInboxMessageEncryptRequest)
      );

      const ts = Date.now();
      const manifestSignaturePayloadBase64 = Buffer.from(
        new Uint8Array([
          ...new Uint8Array(Buffer.from(manifestCiphertext, 'utf-8')),
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const manifestSignatureBase64 = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
          manifestSignaturePayloadBase64
        )
      );

      const ephemeralPublicKeyHex = Buffer.from(
        new Uint8Array(ephemeralKey.public_key)
      ).toString('hex');

      // Upload the single eval to the server keyed by config_public_key.
      await this.apiClient.postSpaceInviteEvals({
        config_public_key: configKey.publicKey,
        space_address: spaceId,
        space_evals: spaceEvals,
        ephemeral_public_key: ephemeralPublicKeyHex,
        owner_public_key: ownerKey.publicKey,
        owner_signature: Buffer.from(
          evalsSignatureBase64,
          'base64'
        ).toString('hex'),
      });

      // Re-publish the manifest.
      await this.apiClient.postSpaceManifest(spaceId, {
        space_address: spaceId,
        space_manifest: manifestCiphertext,
        ephemeral_public_key: ephemeralPublicKeyHex,
        timestamp: ts,
        owner_public_key: ownerKey.publicKey,
        owner_signature: Buffer.from(
          manifestSignatureBase64,
          'base64'
        ).toString('hex'),
      });

      // Persist the new inviteUrl locally.
      await this.messageDB.saveSpace(space);
      await this.queryClient.setQueryData(
        buildSpaceKey({ spaceId: space.spaceId }),
        space
      );

      // Pop the consumed evals from the local pool and persist. We do this
      // AFTER successful upload so a failed network request doesn't leak
      // pool slots.
      session.evals = session.evals.slice(MAX_PUBLIC_EVALS);
      await this.messageDB.saveEncryptionState(
        { ...stateRow, state: JSON.stringify(session) },
        true
      );

      logger.log('[invite] public link generated', {
        spaceId: spaceId.slice(0, 12),
        remainingEvals: session.evals.length,
      });

      // Silence unused-parameter warnings — see method docblock.
      void _user_keyset;
      void _device_keyset;
      void _registration;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Validates and decrypts invite link to retrieve space info.
   */
  async processInviteLink(inviteLink: string) {
    const params = parseInviteParams(inviteLink);
    if (!params) throw new Error(t`invalid link`);

    const info = params as {
      spaceId?: string;
      configKey?: string;
      secret?: string;
      template?: string;
      hubKey?: string;
    };

    if (!info.spaceId || !info.configKey) {
      throw new Error(t`invalid link`);
    }

    const manifest = await this.apiClient.getSpaceManifest(info.spaceId);
    if (!manifest) {
      throw new Error(t`invalid response`);
    }

    const ciphertext = JSON.parse(manifest.data.space_manifest) as {
      ciphertext: string;
      initialization_vector: string;
      associated_data: string;
    };

    const decrypted = ch.js_decrypt_inbox_message(
      JSON.stringify({
        inbox_private_key: hexToSpreadArray(info.configKey),
        ephemeral_public_key: hexToSpreadArray(
          manifest.data.ephemeral_public_key
        ),
        ciphertext: ciphertext,
      })
    );

    const space = JSON.parse(
      Buffer.from(JSON.parse(decrypted)).toString('utf-8')
    ) as Space;

    if (
      (space.inviteUrl == '' || !space.inviteUrl) &&
      (!info.secret || !info.template || !info.hubKey)
    ) {
      throw new Error(t`invalid link`);
    }

    return space;
  }

  /**
   * Joins space from invite: sets up encryption, registers with hub, saves keys, sends join message.
   */
  async joinInviteLink(
    inviteLink: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    }
  ) {
    const params = parseInviteParams(inviteLink);
    if (params) {
      const info = params as {
        spaceId: string;
        configKey: string;
        secret?: string;
        template?: string;
        hubKey?: string;
      };

      const manifest = await this.apiClient.getSpaceManifest(info.spaceId);
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
                inbox_private_key: hexToSpreadArray(info.configKey),
                ephemeral_public_key: hexToSpreadArray(
                  manifest.data.ephemeral_public_key
                ),
                ciphertext: ciphertext,
              })
            )
          )
        ).toString('utf-8')
      ) as Space;

      const configPub = Buffer.from(
        ch.js_get_pubkey_x448(
          Buffer.from(info.configKey, 'hex').toString('base64')
        ),
        'base64'
      );
      let template: any;
      if (!info.secret && !info.template && !info.hubKey) {
        if (!space.inviteUrl || space.inviteUrl == '') {
          throw new Error(t`invalid link`);
        }

        let inviteEval;
        try {
          inviteEval = await this.apiClient.getSpaceInviteEval(
            configPub.toString('hex')
          );
        } catch (e: any) {
          if (isQuorumApiError(e) && e.status === 404) {
            throw new Error(t`This public invite link is no longer valid.`);
          }
          throw e;
        }

        // Prefer the eval's own ephemeral pubkey when the server provides it.
        // The manifest's ephemeral key gets rotated on every space update
        // (kick, role grant, settings edit, channel binding) but the eval's
        // ephemeral key stays put — so decrypting with the manifest's key
        // fails as soon as the owner does anything to the space after
        // publishing the public invite. Mobile's join path does the same
        // (quorum-mobile/hooks/chat/useSpaceActions.ts:271-279). The fallback
        // to manifest.data.ephemeral_public_key is for legacy servers that
        // don't yet return the eval's own ephemeral pubkey.
        const evalEphemeralPublicKey =
          inviteEval.data.ephemeralPublicKey ?? manifest.data.ephemeral_public_key;

        const invite = JSON.parse(
          Buffer.from(
            JSON.parse(
              ch.js_decrypt_inbox_message(
                JSON.stringify({
                  inbox_private_key: hexToSpreadArray(info.configKey),
                  ephemeral_public_key: hexToSpreadArray(evalEphemeralPublicKey),
                  ciphertext: JSON.parse(inviteEval.data.ciphertext),
                })
              )
            )
          ).toString('utf-8')
        ) as {
          id: number;
          secret: string;
          template: string;
          hubKey: string;
        };
        info.secret = invite.secret;
        info.template = invite.template;
        info.hubKey = invite.hubKey;
        template = JSON.parse(info.template);
      } else {
        template = JSON.parse(
          Buffer.from(info.template!, 'hex').toString('utf-8')
        );
      }

      const ip = ch.js_generate_ed448();
      const inboxPair = JSON.parse(ip);
      const ih = await sha256.digest(
        Buffer.from(new Uint8Array(inboxPair.public_key))
      );
      const inboxAddress = base58btc.baseEncode(ih.bytes);
      const hubPub = Buffer.from(
        ch.js_get_pubkey_ed448(
          Buffer.from(info.hubKey!, 'hex').toString('base64')
        ),
        'base64'
      );
      const hh = await sha256.digest(hubPub);
      const hubAddress = base58btc.baseEncode(hh.bytes);
      const secret_pair = JSON.parse(ch.js_generate_x448());
      const eph_pair = JSON.parse(ch.js_generate_x448());
      const ratchet = JSON.parse(template.dkg_ratchet);
      ratchet.total++;
      ratchet.secret = Buffer.from(
        new Uint8Array(secret_pair.private_key)
      ).toString('base64');
      ratchet.scalar = Buffer.from(info.secret!, 'hex').toString('base64');
      ratchet.point = JSON.parse(
        ch.js_get_pubkey_x448(
          Buffer.from(info.secret!, 'hex').toString('base64')
        )
      );
      ratchet.random_commitment_point = JSON.parse(
        ch.js_get_pubkey_x448(
          Buffer.from(info.secret!, 'hex').toString('base64')
        )
      );
      template.dkg_ratchet = JSON.stringify(ratchet);
      template.next_dkg_ratchet = JSON.stringify(ratchet);
      template.peer_key = Buffer.from(
        new Uint8Array(
          keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.private_key
        )
      ).toString('base64');
      template.ephemeral_private_key = Buffer.from(
        new Uint8Array(eph_pair.private_key)
      ).toString('base64');
      const session = {
        state: JSON.stringify(template),
      };
      await this.messageDB.saveEncryptionState(
        {
          state: JSON.stringify(session),
          timestamp: Date.now(),
          conversationId: space.spaceId + '/' + space.spaceId,
          inboxId: inboxAddress,
        },
        true
      );

      await this.apiClient.postHubAdd({
        hub_address: hubAddress,
        hub_public_key: hubPub.toString('hex'),
        hub_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(info.hubKey!, 'hex').toString('base64'),
              Buffer.from(
                new Uint8Array([
                  ...new Uint8Array(
                    Buffer.from(
                      'add' +
                        Buffer.from(
                          new Uint8Array(inboxPair.public_key)
                        ).toString('hex'),
                      'utf-8'
                    )
                  ),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
        inbox_public_key: Buffer.from(
          new Uint8Array(inboxPair.public_key)
        ).toString('hex'),
        inbox_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(new Uint8Array(inboxPair.private_key)).toString(
                'base64'
              ),
              Buffer.from(
                new Uint8Array([
                  ...new Uint8Array(
                    Buffer.from('add' + hubPub.toString('hex'), 'utf-8')
                  ),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
      });
      await this.messageDB.saveSpaceKey({
        spaceId: space.spaceId,
        keyId: 'hub',
        address: hubAddress,
        publicKey: hubPub.toString('hex'),
        privateKey: info.hubKey || '',
      });
      await this.messageDB.saveSpaceKey({
        spaceId: space.spaceId,
        keyId: 'config',
        publicKey: configPub.toString('hex'),
        privateKey: info.configKey,
      });

      await this.messageDB.saveSpaceKey({
        spaceId: space.spaceId,
        keyId: 'inbox',
        address: inboxAddress,
        publicKey: Buffer.from(new Uint8Array(inboxPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(
          new Uint8Array(inboxPair.private_key)
        ).toString('hex'),
      });
      // The join key is also the per-USER SIGNING identity that receivers bind
      // in their member table (the join broadcast). Store it under `signing` so
      // it survives a second device regenerating the per-device `inbox`
      // (mailbox) key on config sync.
      await this.messageDB.saveSpaceKey({
        spaceId: space.spaceId,
        keyId: 'signing',
        address: inboxAddress,
        publicKey: Buffer.from(new Uint8Array(inboxPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(
          new Uint8Array(inboxPair.private_key)
        ).toString('hex'),
      });
      // Clear any tombstones from a previous join to allow messages to sync
      await this.messageDB.clearTombstonesForSpace(space.spaceId);
      await this.messageDB.saveSpace(space);
      await this.messageDB.saveSpaceMember(space.spaceId, {
        user_address: currentPasskeyInfo.address,
        user_icon: currentPasskeyInfo.pfpUrl,
        display_name: currentPasskeyInfo.displayName,
        inbox_address: inboxAddress,
      });
      let config = await this.getConfig({
        address: currentPasskeyInfo.address,
        userKey: keyset.userKeyset,
      });
      // Create NavItem for the new space
      const newSpaceItem: NavItem = { type: 'space', id: space.spaceId };
      if (config) {
        config.spaceIds = [...(config.spaceIds ?? []), space.spaceId];
        // Also add to items if items array exists
        if (config.items) {
          config.items = [...config.items, newSpaceItem];
        }
      } else {
        config = {
          address: currentPasskeyInfo.address,
          spaceIds: [space.spaceId],
          items: [newSpaceItem],
        };
      }
      await this.saveConfig({ config, keyset });
      await this.queryClient.invalidateQueries({ queryKey: buildSpacesKey({}) });
      await this.queryClient.invalidateQueries({
        queryKey: buildConfigKey({
          userAddress: currentPasskeyInfo.address,
        }),
      });
      this.enqueueOutbound(async () => {
        return [
          JSON.stringify({
            type: 'listen',
            inbox_addresses: [inboxAddress],
          }),
        ];
      });
      const participant = {
        address: currentPasskeyInfo!.address,
        id: ratchet.id,
        inboxAddress: inboxAddress,
        inboxPubKey: Buffer.from(
          new Uint8Array(
            keyset.deviceKeyset.inbox_keyset.inbox_key.public_key
          )
        ).toString('hex'),
        pubKey: Buffer.from(
          JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(info.secret!, 'hex').toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
        inboxKey: Buffer.from(
          new Uint8Array(
            keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.public_key
          )
        ).toString('hex'),
        identityKey: Buffer.from(
          new Uint8Array(keyset.deviceKeyset.identity_key.public_key)
        ).toString('hex'),
        preKey: Buffer.from(
          new Uint8Array(keyset.deviceKeyset.pre_key.public_key)
        ).toString('hex'),
        userIcon: currentPasskeyInfo!.pfpUrl,
        displayName: currentPasskeyInfo!.displayName,
        joinedAt: Date.now(),
        signature: '',
      };
      const msg = Buffer.from(
        currentPasskeyInfo.address +
          ratchet.id +
          participant.inboxAddress +
          participant.pubKey +
          participant.inboxKey +
          participant.identityKey +
          participant.preKey +
          participant.userIcon +
          participant.displayName +
          participant.joinedAt,
        'utf-8'
      ).toString('base64');
      const sig = ch.js_sign_ed448(
        Buffer.from(
          new Uint8Array(
            keyset.deviceKeyset.inbox_keyset.inbox_key.private_key
          )
        ).toString('base64'),
        msg
      );
      participant.signature = JSON.parse(sig);
      this.enqueueOutbound(async () => [
        await this.sendHubMessage(
          space.spaceId,
          JSON.stringify({
            type: 'control',
            message: {
              type: 'join',
              participant,
            },
          })
        ),
      ]);
      await this.requestSync(space.spaceId);
      return { spaceId: space.spaceId, channelId: space.defaultChannelId };
    }
  }
}
