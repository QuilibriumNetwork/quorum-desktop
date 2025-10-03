// InvitationService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles space invitation operations

import { MessageDB } from '../db/messages';
import { QuorumApiClient } from '../api/baseTypes';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
import { int64ToBytes } from '../utils/bytes';
import { t } from '@lingui/core/macro';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildConfigKey, buildSpaceKey } from '../hooks';
import { Space } from '../api/quorumApi';
import { parseInviteParams, getInviteUrlBase } from '../utils/inviteDomain';
import { isQuorumApiError } from '../api/baseTypes';

export class InvitationService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
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
    spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
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
   */
  async constructInviteLink(spaceId: string) {
    const space = await this.messageDB.getSpace(spaceId);
    if (space?.inviteUrl) {
      return space.inviteUrl;
    }

    const config_key = await this.messageDB.getSpaceKey(spaceId, 'config');
    const hub_key = await this.messageDB.getSpaceKey(spaceId, 'hub');
    let response = await this.messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });
    const sets = response.map((e) => JSON.parse(e.state));
    const state = sets[0].template;
    const ratchet = JSON.parse(state.dkg_ratchet);
    ratchet.id = 10001 - sets[0].evals.length;
    state.root_key = JSON.parse(sets[0].state).root_key;
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
    const link = `${getInviteUrlBase(false)}#spaceId=${spaceId}&configKey=${config_key.privateKey}&template=${template}&secret=${secret}&hubKey=${hub_key.privateKey}`;
    return link;
  }

  /**
   * Sends invite link to user via DM.
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
    submitMessage: any
  ) {
    const link = await this.constructInviteLink(spaceId);
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
   * Generates public invite system with 200+ one-time invites, sends rekey to members.
   */
  async generateNewInviteLink(
    spaceId: string,
    user_keyset: secureChannel.UserKeyset,
    device_keyset: secureChannel.DeviceKeyset,
    registration: secureChannel.UserRegistration
  ) {
    try {
      const space = await this.messageDB.getSpace(spaceId);
      const spaceKey = await this.messageDB.getSpaceKey(spaceId, spaceId);
      const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const cp = ch.js_generate_x448();
      const configPair = JSON.parse(cp);

      await this.messageDB.saveSpaceKey({
        spaceId: spaceId,
        keyId: 'config',
        publicKey: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        privateKey: Buffer.from(
          new Uint8Array(configPair.private_key)
        ).toString('hex'),
      });

      const ts = Date.now();
      const ownerPayload = Buffer.from(
        new Uint8Array([
          ...hexToSpreadArray(spaceKey.publicKey),
          ...configPair.public_key,
          ...hexToSpreadArray(ownerKey.publicKey),
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spacePayload = Buffer.from(
        new Uint8Array([
          ...hexToSpreadArray(spaceKey.publicKey),
          ...configPair.public_key,
          ...hexToSpreadArray(ownerKey.publicKey),
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spaceSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(spaceKey.privateKey, 'hex').toString('base64'),
          spacePayload
        )
      );
      const ownerSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
          ownerPayload
        )
      );
      this.spaceInfo.current[spaceId] = {
        space_address: spaceId,
        space_public_key: spaceKey.publicKey,
        space_signature: Buffer.from(spaceSignature, 'base64').toString(
          'hex'
        ),
        config_public_key: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        owner_public_keys: [ownerKey.publicKey],
        owner_signatures: [
          Buffer.from(ownerSignature, 'base64').toString('hex'),
        ],
        timestamp: ts,
      } as secureChannel.SpaceRegistration;
      const ephemeral_key = JSON.parse(
        ch.js_generate_x448()
      ) as secureChannel.X448Keypair;
      let members = await this.messageDB.getSpaceMembers(spaceId);
      let filteredMembers = members.filter(
        (m) => m.inbox_address !== '' && m.user_address != this.selfAddress
      );
      const encryptionStates = await this.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      const state = encryptionStates[0];
      const trState = JSON.parse(JSON.parse(state.state).state);
      const session =
        await secureChannel.EstablishTripleRatchetSessionForSpace(
          user_keyset,
          device_keyset,
          registration,
          filteredMembers.length + 200
        );

      console.log('new link session', session);
      let outbounds: string[] = [];
      let newPeerIdSet = {
        [trState.id_peer_map[1].public_key]: 1,
      };
      let newIdPeerSet = {
        [1]: trState.id_peer_map[1],
      } as { [key: number]: any };
      let idCounter = 2;
      for (const member of filteredMembers) {
        const user = await this.apiClient.getUser(member.user_address);
        const device = user.data.device_registrations.find(
          (d: any) =>
            trState.peer_id_map[
              Buffer.from(
                d.inbox_registration.inbox_encryption_public_key,
                'hex'
              ).toString('base64')
            ]
        );
        if (!device) {
          idCounter++;
          continue;
        }
        const inboxKey = Buffer.from(
          device!.inbox_registration.inbox_encryption_public_key,
          'hex'
        ).toString('base64');
        newPeerIdSet = {
          ...newPeerIdSet,
          [inboxKey]: idCounter,
        };
        newIdPeerSet = {
          ...newIdPeerSet,
          [idCounter]: trState.id_peer_map[trState.peer_id_map[inboxKey]],
        };
        idCounter++;
      }
      let ownRatchet = JSON.parse(session.state);
      ownRatchet.peer_id_map = newPeerIdSet;
      ownRatchet.id_peer_map = newIdPeerSet;
      session.state = JSON.stringify(ownRatchet);

      idCounter = 2;
      for (const member of filteredMembers) {
        if (!newIdPeerSet[idCounter]) {
          continue;
        }
        const sendState = session.template;
        const ratchet = JSON.parse(sendState.dkg_ratchet);
        sendState.peer_id_map = newPeerIdSet;
        sendState.id_peer_map = newIdPeerSet;
        ratchet.id = filteredMembers.length + 201 - session.evals.length;
        sendState.root_key = JSON.parse(session.state).root_key;
        const index_secret_raw = session.evals.shift();
        const secret_pair = JSON.parse(ch.js_generate_x448());
        const eph_pair = JSON.parse(ch.js_generate_x448());
        ratchet.total = Object.keys(ownRatchet.peer_id_map).length;
        ratchet.secret = Buffer.from(
          new Uint8Array(secret_pair.private_key)
        ).toString('base64');
        ratchet.scalar = Buffer.from(
          new Uint8Array(index_secret_raw!)
        ).toString('base64');
        ratchet.point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
          )
        );
        ratchet.random_commitment_point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
          )
        );
        sendState.dkg_ratchet = JSON.stringify(ratchet);
        sendState.next_dkg_ratchet = JSON.stringify(ratchet);
        sendState.ephemeral_private_key = Buffer.from(
          new Uint8Array(eph_pair.private_key)
        ).toString('base64');
        const template = JSON.stringify(sendState);

        const innerEnvelope = await secureChannel.SealInboxEnvelope(
          newIdPeerSet[idCounter].public_key,
          JSON.stringify({
            configKey: Buffer.from(
              new Uint8Array(configPair.private_key)
            ).toString('hex'),
            state: template,
          })
        );
        const envelope = await secureChannel.SealSyncEnvelope(
          member.inbox_address,
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          {
            type: 'ed448',
            private_key: hexToSpreadArray(ownerKey.privateKey),
            public_key: hexToSpreadArray(ownerKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'rekey',
              info: JSON.stringify(innerEnvelope),
            },
          })
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
        idCounter++;
      }

      const space_evals = [] as string[];
      for (
        let e = session.evals.shift();
        e != undefined;
        e = session.evals.shift()
      ) {
        const sendState = session.template;
        const ratchet = JSON.parse(sendState.dkg_ratchet);
        sendState.peer_id_map = newPeerIdSet;
        sendState.id_peer_map = newIdPeerSet;
        ratchet.id = idCounter;
        sendState.root_key = JSON.parse(session.state).root_key;
        const index_secret_raw = e;
        const secret_pair = JSON.parse(ch.js_generate_x448());
        const eph_pair = JSON.parse(ch.js_generate_x448());
        ratchet.total = Object.keys(ownRatchet.peer_id_map).length;
        ratchet.secret = Buffer.from(
          new Uint8Array(secret_pair.private_key)
        ).toString('base64');
        ratchet.scalar = Buffer.from(
          new Uint8Array(index_secret_raw!)
        ).toString('base64');
        ratchet.point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
          )
        );
        ratchet.random_commitment_point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
          )
        );
        sendState.dkg_ratchet = JSON.stringify(ratchet);
        sendState.next_dkg_ratchet = JSON.stringify(ratchet);
        sendState.ephemeral_private_key = Buffer.from(
          new Uint8Array(eph_pair.private_key)
        ).toString('base64');
        const template = JSON.stringify(sendState);
        const ciphertext = ch.js_encrypt_inbox_message(
          JSON.stringify({
            inbox_public_key: [...new Uint8Array(configPair.public_key)],
            ephemeral_private_key: ephemeral_key.private_key,
            plaintext: [
              ...new Uint8Array(
                Buffer.from(
                  JSON.stringify({
                    id: idCounter,
                    template: template,
                    secret: Buffer.from(new Uint8Array(e)).toString('hex'),
                    hubKey: hubKey.privateKey,
                  }),
                  'utf-8'
                )
              ),
            ],
          } as secureChannel.SealedInboxMessageEncryptRequest)
        );

        space_evals.push(ciphertext);
        idCounter++;
      }

      const out = {
        config_public_key: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        space_address: space!.spaceId,
        space_evals: space_evals,
        ephemeral_public_key: Buffer.from(
          new Uint8Array(ephemeral_key.public_key)
        ).toString('hex'),
        owner_public_key: ownerKey.publicKey,
        owner_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
              Buffer.from(
                new Uint8Array([
                  ...space_evals.flatMap((s) => [
                    ...new Uint8Array(Buffer.from(s, 'utf-8')),
                  ]),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
      };

      space!.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
      const ciphertext = ch.js_encrypt_inbox_message(
        JSON.stringify({
          inbox_public_key: [...new Uint8Array(configPair.public_key)],
          ephemeral_private_key: ephemeral_key.private_key,
          plaintext: [
            ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
          ],
        } as secureChannel.SealedInboxMessageEncryptRequest)
      );

      const manifest = {
        space_address: spaceId,
        space_manifest: ciphertext,
        ephemeral_public_key: Buffer.from(
          new Uint8Array(ephemeral_key.public_key)
        ).toString('hex'),
        timestamp: ts,
        owner_public_key: ownerKey.publicKey,
        owner_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
              Buffer.from(
                new Uint8Array([
                  ...new Uint8Array(Buffer.from(ciphertext, 'utf-8')),
                  ...int64ToBytes(ts),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
      };

      await this.apiClient.postSpace(spaceId, {
        space_address: spaceId,
        space_public_key: spaceKey.publicKey,
        space_signature: Buffer.from(spaceSignature, 'base64').toString(
          'hex'
        ),
        config_public_key: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        owner_public_keys: [ownerKey.publicKey],
        owner_signatures: [
          Buffer.from(ownerSignature, 'base64').toString('hex'),
        ],
        timestamp: ts,
      } as secureChannel.SpaceRegistration);
      await this.apiClient.postSpaceInviteEvals(out);
      await this.apiClient.postSpaceManifest(spaceId, manifest);
      await this.messageDB.saveSpace(space!);
      await this.queryClient.setQueryData(
        buildSpaceKey({ spaceId: space?.spaceId! }),
        space
      );

      await this.messageDB.saveEncryptionState(
        { ...state, state: JSON.stringify(session) },
        true
      );
      this.enqueueOutbound(async () => {
        return outbounds;
      });
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
        const invite = JSON.parse(
          Buffer.from(
            JSON.parse(
              ch.js_decrypt_inbox_message(
                JSON.stringify({
                  inbox_private_key: hexToSpreadArray(info.configKey),
                  ephemeral_public_key: hexToSpreadArray(
                    manifest.data.ephemeral_public_key
                  ),
                  ciphertext: JSON.parse(inviteEval.data),
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
      if (config) {
        config.spaceIds = [...(config.spaceIds ?? []), space.spaceId];
      } else {
        config = {
          address: currentPasskeyInfo.address,
          spaceIds: [space.spaceId],
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
      let participant = {
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
          participant.displayName,
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
