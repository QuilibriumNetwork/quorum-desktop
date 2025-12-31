// SpaceService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles space creation, management, and member operations

import { MessageDB, NavItem } from '../db/messages';
import { Space, Message, KickMessage } from '../api/quorumApi';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
import { int64ToBytes } from '../utils/bytes';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildSpaceKey, buildSpaceMembersKey, buildConfigKey } from '../hooks';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { QuorumApiClient } from '../api/baseTypes';
import { getInviteUrlBase } from '@/utils/inviteDomain';

// Type definitions for the service
export interface SpaceServiceDependencies {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  selfAddress: string;
  keyset: {
    deviceKeyset: secureChannel.DeviceKeyset;
    userKeyset: secureChannel.UserKeyset;
  };
  spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
  saveMessage: (
    message: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    type: string,
    metadata: any
  ) => Promise<void>;
  addMessage: (
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    message: Message
  ) => Promise<void>;
}

export class SpaceService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private selfAddress: string;
  private keyset: {
    deviceKeyset: secureChannel.DeviceKeyset;
    userKeyset: secureChannel.UserKeyset;
  };
  private spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
  private saveMessage: (
    message: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    type: string,
    metadata: any
  ) => Promise<void>;
  private addMessage: (
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    message: Message
  ) => Promise<void>;

  constructor(dependencies: SpaceServiceDependencies) {
    this.messageDB = dependencies.messageDB;
    this.apiClient = dependencies.apiClient;
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.saveConfig = dependencies.saveConfig;
    this.selfAddress = dependencies.selfAddress;
    this.keyset = dependencies.keyset;
    this.spaceInfo = dependencies.spaceInfo;
    this.saveMessage = dependencies.saveMessage;
    this.addMessage = dependencies.addMessage;
  }

  /**
   * Submits space manifest update via hub.
   */
  async submitUpdateSpace(manifest: secureChannel.SpaceManifest) {
    try {
      this.enqueueOutbound(async () => {
        const hubKey = await this.messageDB.getSpaceKey(
          manifest.space_address,
          'hub'
        );
        const configKey = await this.messageDB.getSpaceKey(
          manifest.space_address,
          'config'
        );
        const envelope = await secureChannel.SealHubEnvelope(
          hubKey.address!,
          {
            type: 'ed448',
            private_key: [
              ...hexToSpreadArray(hubKey.privateKey),
            ],
            public_key: [
              ...hexToSpreadArray(hubKey.publicKey),
            ],
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'space-manifest',
              manifest: manifest,
            },
          }),
          configKey ? {
            type: 'x448',
            public_key: [...hexToSpreadArray(configKey.publicKey)],
            private_key: [...hexToSpreadArray(configKey.privateKey)],
          } : undefined
        );
        return [JSON.stringify({ type: 'group', ...envelope })];
      });
    } catch {}
  }

  /**
   * Creates new space: generates keys, registers with API, saves manifest, sends invites.
   */
  async createSpace(
    spaceName: string,
    spaceIcon: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    registration: secureChannel.UserRegistration,
    isRepudiable: boolean,
    isPublic: boolean,
    userIcon: string,
    userDisplayName: string,
    queryClient: QueryClient,
      description: string = ''
  ) {
    const sp = ch.js_generate_ed448();
    const spacePair = JSON.parse(sp);
    const sh = await sha256.digest(
      Buffer.from(new Uint8Array(spacePair.public_key))
    );
    const spaceAddress = base58btc.baseEncode(sh.bytes);
    const cp = ch.js_generate_x448();
    const configPair = JSON.parse(cp);
    const gp = ch.js_generate_ed448();
    const groupPair = JSON.parse(gp);
    const gh = await sha256.digest(
      Buffer.from(new Uint8Array(groupPair.public_key))
    );
    const groupAddress = base58btc.baseEncode(gh.bytes);
    const hp = ch.js_generate_ed448();
    const hubPair = JSON.parse(hp);
    const hh = await sha256.digest(
      Buffer.from(new Uint8Array(hubPair.public_key))
    );
    const hubAddress = base58btc.baseEncode(hh.bytes);
    const ip = ch.js_generate_ed448();
    const inboxPair = JSON.parse(ip);
    const ih = await sha256.digest(
      Buffer.from(new Uint8Array(inboxPair.public_key))
    );
    const inboxAddress = base58btc.baseEncode(ih.bytes);
    const op = ch.js_generate_ed448();
    const ownerPair = JSON.parse(op);
    const ts = Date.now();
    const ownerPayload = Buffer.from(
      new Uint8Array([
        ...spacePair.public_key,
        ...configPair.public_key,
        ...ownerPair.public_key,
        ...int64ToBytes(ts),
      ])
    ).toString('base64');
    const spacePayload = Buffer.from(
      new Uint8Array([
        ...spacePair.public_key,
        ...configPair.public_key,
        ...ownerPair.public_key,
        ...int64ToBytes(ts),
      ])
    ).toString('base64');
    const spaceSignature = JSON.parse(
      ch.js_sign_ed448(
        Buffer.from(new Uint8Array(spacePair.private_key)).toString('base64'),
        spacePayload
      )
    );
    const ownerSignature = JSON.parse(
      ch.js_sign_ed448(
        Buffer.from(new Uint8Array(ownerPair.private_key)).toString('base64'),
        ownerPayload
      )
    );

    await this.apiClient.postSpace(spaceAddress, {
      space_address: spaceAddress,
      space_public_key: Buffer.from(
        new Uint8Array(spacePair.public_key)
      ).toString('hex'),
      space_signature: Buffer.from(spaceSignature, 'base64').toString('hex'),
      config_public_key: Buffer.from(
        new Uint8Array(configPair.public_key)
      ).toString('hex'),
      owner_public_keys: [
        Buffer.from(new Uint8Array(ownerPair.public_key)).toString('hex'),
      ],
      owner_signatures: [
        Buffer.from(ownerSignature, 'base64').toString('hex'),
      ],
      timestamp: ts,
    });

    const space = {
      spaceId: spaceAddress,
      spaceName: spaceName,
      description: description || '',
      vanityUrl: '',
      inviteUrl: '',
      iconUrl: spaceIcon,
      bannerUrl: '',
      defaultChannelId: groupAddress,
      hubAddress: hubAddress,
      createdDate: ts,
      modifiedDate: ts,
      isRepudiable: isRepudiable,
      isPublic: isPublic,
      emojis: [],
      roles: [],
      stickers: [],
      groups: [
        {
          groupName: 'Text Channels',
          channels: [
            {
              spaceId: spaceAddress,
              channelId: groupAddress,
              channelName: t`general`,
              channelTopic: t`General Chat`,
              createdDate: ts,
              modifiedDate: ts,
            },
          ],
        },
      ],
    } as Space;

    const ephemeral_key = JSON.parse(
      ch.js_generate_x448()
    ) as secureChannel.X448Keypair;
    const ciphertext = ch.js_encrypt_inbox_message(
      JSON.stringify({
        inbox_public_key: configPair.public_key,
        ephemeral_private_key: ephemeral_key.private_key,
        plaintext: [
          ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
        ],
      } as secureChannel.SealedInboxMessageEncryptRequest)
    );

    await this.apiClient.postSpaceManifest(spaceAddress, {
      space_address: spaceAddress,
      space_manifest: ciphertext,
      ephemeral_public_key: Buffer.from(
        new Uint8Array(ephemeral_key.public_key)
      ).toString('hex'),
      timestamp: ts,
      owner_public_key: Buffer.from(
        new Uint8Array(ownerPair.public_key)
      ).toString('hex'),
      owner_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(new Uint8Array(ownerPair.private_key)).toString(
              'base64'
            ),
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
    });

    await this.apiClient.postHubAdd({
      hub_address: hubAddress,
      hub_public_key: Buffer.from(
        new Uint8Array(hubPair.public_key)
      ).toString('hex'),
      hub_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(new Uint8Array(hubPair.private_key)).toString(
              'base64'
            ),
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
                  Buffer.from(
                    'add' +
                      Buffer.from(
                        new Uint8Array(hubPair.public_key)
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
    });

    const session = await secureChannel.EstablishTripleRatchetSessionForSpace(
      keyset.userKeyset,
      keyset.deviceKeyset,
      registration
    );

    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: 'config',
      publicKey: Buffer.from(new Uint8Array(configPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(
        new Uint8Array(configPair.private_key)
      ).toString('hex'),
    });
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: 'hub',
      address: hubAddress,
      publicKey: Buffer.from(new Uint8Array(hubPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(hubPair.private_key)).toString(
        'hex'
      ),
    });
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: 'owner',
      publicKey: Buffer.from(new Uint8Array(ownerPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(ownerPair.private_key)).toString(
        'hex'
      ),
    });
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: 'inbox',
      address: inboxAddress,
      publicKey: Buffer.from(new Uint8Array(inboxPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(inboxPair.private_key)).toString(
        'hex'
      ),
    });
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: groupAddress,
      publicKey: Buffer.from(new Uint8Array(groupPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(groupPair.private_key)).toString(
        'hex'
      ),
    });
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: spaceAddress,
      publicKey: Buffer.from(new Uint8Array(spacePair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(spacePair.private_key)).toString(
        'hex'
      ),
    });
    await this.messageDB.saveSpace(space);
    await this.messageDB.saveSpaceMember(spaceAddress, {
      user_address: registration.user_address,
      user_icon: userIcon,
      display_name: userDisplayName,
      inbox_address: inboxAddress,
    });
    // Defensive: ensure creator is present in member list
    const ensuredMember = await this.messageDB.getSpaceMember(
      spaceAddress,
      registration.user_address
    );
    if (!ensuredMember) {
      await this.messageDB.saveSpaceMember(spaceAddress, {
        user_address: registration.user_address,
        user_icon: userIcon,
        display_name: userDisplayName,
        inbox_address: inboxAddress,
      });
    }
    // IMPORTANT: Save encryption state BEFORE updating config
    // This ensures the space has encryption keys when config filtering runs
    await this.messageDB.saveEncryptionState(
      {
        state: JSON.stringify(session),
        timestamp: ts,
        conversationId: spaceAddress + '/' + spaceAddress,
        inboxId: inboxAddress,
      },
      true
    );

    const config = await this.messageDB.getUserConfig({
      address: registration.user_address,
    });
    // Create NavItem for the new space
    const newSpaceItem: NavItem = { type: 'space', id: spaceAddress };
    if (!config) {
      await this.saveConfig({
        config: {
          address: registration.user_address,
          spaceIds: [spaceAddress],
          items: [newSpaceItem],
        },
        keyset,
      });
    } else {
      // Update both spaceIds and items (if items exists)
      const updatedConfig = {
        ...config,
        spaceIds: [...config.spaceIds, spaceAddress],
      };
      // Only add to items if the config already has items array
      if (config.items) {
        updatedConfig.items = [...config.items, newSpaceItem];
      }
      await this.saveConfig({
        config: updatedConfig,
        keyset,
      });
    }
    // Ensure member list reflects the creator immediately
    await queryClient.invalidateQueries({
      queryKey: buildSpaceMembersKey({ spaceId: spaceAddress }),
    });
    await queryClient.invalidateQueries({ queryKey: buildSpacesKey({}) });
    await queryClient.invalidateQueries({
      queryKey: buildConfigKey({ userAddress: registration.user_address }),
    });
    this.enqueueOutbound(async () => {
      return [
        JSON.stringify({ type: 'listen', inbox_addresses: [inboxAddress] }),
      ];
    });
    return { spaceId: spaceAddress, channelId: groupAddress };
  }

  /**
   * Updates space manifest: encrypts, uploads to API, updates local DB and cache.
   */
  async updateSpace(space: Space, queryClient: QueryClient) {
    const config_key = await this.messageDB.getSpaceKey(space.spaceId, 'config');
    const owner_key = await this.messageDB.getSpaceKey(space.spaceId, 'owner');
    const ephemeral_key = JSON.parse(
      ch.js_generate_x448()
    ) as secureChannel.X448Keypair;
    const ciphertext = ch.js_encrypt_inbox_message(
      JSON.stringify({
        inbox_public_key: [
          ...hexToSpreadArray(config_key.publicKey),
        ],
        ephemeral_private_key: ephemeral_key.private_key,
        plaintext: [
          ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
        ],
      } as secureChannel.SealedInboxMessageEncryptRequest)
    );
    const ts = Date.now();
    const manifest = {
      space_address: space.spaceId,
      space_manifest: ciphertext,
      ephemeral_public_key: Buffer.from(
        new Uint8Array(ephemeral_key.public_key)
      ).toString('hex'),
      timestamp: ts,
      owner_public_key: owner_key.publicKey,
      owner_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(owner_key.privateKey, 'hex').toString('base64'),
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
    await this.apiClient.postSpaceManifest(space.spaceId, manifest);
    await this.messageDB.saveSpace(space);
    await this.submitUpdateSpace(manifest);
    queryClient.invalidateQueries({
      queryKey: buildSpaceKey({ spaceId: space.spaceId }),
    });
  }

  /**
   * Deletes space: sends delete message via hub, removes from DB and config, updates cache.
   */
  async deleteSpace(spaceId: string, queryClient: QueryClient) {
    const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
    const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
    const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');

    // Check if hub key exists and has an address
    if (!hubKey || !hubKey.address) {
      console.error('Hub key or address missing for space:', spaceId, {
        hubKey,
      });
      throw new Error(
        t`Unable to leave space due to incomplete configuration. The space data may be corrupted.`
      );
    }

    const envelope = await secureChannel.SealHubEnvelope(
      hubKey.address,
      {
        type: 'ed448',
        private_key: [
          ...hexToSpreadArray(hubKey.privateKey),
        ],
        public_key: [...hexToSpreadArray(hubKey.publicKey)],
      },
      JSON.stringify({
        type: 'control',
        message: {
          type: 'leave',
          inboxPublicKey: inboxKey.publicKey,
          inboxSignature: Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(
                  new Uint8Array([
                    ...new Uint8Array(
                      Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                    ),
                  ])
                ).toString('base64')
              )
            ),
            'base64'
          ).toString('hex'),
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
    const message = JSON.stringify({ type: 'group', ...envelope });
    this.enqueueOutbound(async () => [message]);
    await this.apiClient.postHubDelete({
      hub_address: hubKey.address!,
      hub_public_key: hubKey.publicKey,
      hub_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(hubKey.privateKey, 'hex').toString('base64'),
            Buffer.from(
              new Uint8Array([
                ...new Uint8Array(
                  Buffer.from('delete' + inboxKey.publicKey, 'utf-8')
                ),
              ])
            ).toString('base64')
          )
        ),
        'base64'
      ).toString('hex'),
      inbox_public_key: inboxKey.publicKey,
      inbox_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
            Buffer.from(
              new Uint8Array([
                ...new Uint8Array(
                  Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                ),
              ])
            ).toString('base64')
          )
        ),
        'base64'
      ).toString('hex'),
    });
    const states = await this.messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });
    for (const state of states) {
      await this.messageDB.deleteEncryptionState(state);
    }
    const messages = await this.messageDB.getAllSpaceMessages({ spaceId });
    for (const message of messages) {
      await this.messageDB.deleteMessage(message.messageId);
    }
    const members = await this.messageDB.getSpaceMembers(spaceId);
    for (const member of members) {
      await this.messageDB.deleteSpaceMember(spaceId, member.user_address);
    }
    const keys = await this.messageDB.getSpaceKeys(spaceId);
    for (const key of keys) {
      await this.messageDB.deleteSpaceKey(spaceId, key.keyId);
    }
    let userConfig = await this.messageDB.getUserConfig({ address: this.selfAddress });
    userConfig = {
      ...(userConfig ?? { address: this.selfAddress }),
      spaceIds: [...(userConfig?.spaceIds.filter((s) => s != spaceId) ?? [])],
    };
    await this.saveConfig({
      config: userConfig,
      keyset: this.keyset,
    });
    await queryClient.setQueryData(
      buildConfigKey({ userAddress: this.selfAddress }),
      () => userConfig
    );
    await this.messageDB.deleteSpace(spaceId);
  }

  /**
   * Kicks user from space: validates permissions, sends kick message, rekeys encryption.
   */
  async kickUser(
    spaceId: string,
    userAddress: string,
    user_keyset: secureChannel.UserKeyset,
    device_keyset: secureChannel.DeviceKeyset,
    registration: secureChannel.UserRegistration,
    queryClient: QueryClient
  ) {
    // Get space information to validate kick operation
    const space = await this.messageDB.getSpace(spaceId);

    if (!space) {
      throw new Error(`Space ${spaceId} not found`);
    }

    // Note: Only space owners can kick (requires owner's ED448 key at protocol level)
    // The kick message signature verification ensures only the actual owner can kick

    this.enqueueOutbound(async () => {
      const spaceKey = await this.messageDB.getSpaceKey(spaceId, spaceId);
      const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');

      // Get the OLD config key BEFORE generating new one - needed for sealing rekey messages
      const oldConfigKey = await this.messageDB.getSpaceKey(spaceId, 'config');

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
      const space = await this.messageDB.getSpace(spaceId);

      // Remove kicked user from all roles
      if (space) {
        space.roles = space.roles.map(role => ({
          ...role,
          members: role.members.filter(m => m !== userAddress)
        }));
      }

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

      await this.apiClient.postSpaceManifest(spaceId, manifest);
      const members = await this.messageDB.getSpaceMembers(spaceId);
      const filteredMembers = members.filter(
        (m) =>
          m.inbox_address !== '' &&
          m.inbox_address &&
          m.user_address != userAddress &&
          m.user_address != this.selfAddress
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
      const outbounds: string[] = [];
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
      const ownRatchet = JSON.parse(session.state);
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
            private_key: [
              ...hexToSpreadArray(hubKey.privateKey),
            ],
            public_key: [
              ...hexToSpreadArray(hubKey.publicKey),
            ],
          },
          {
            type: 'ed448',
            private_key: [
              ...hexToSpreadArray(ownerKey.privateKey),
            ],
            public_key: [
              ...hexToSpreadArray(ownerKey.publicKey),
            ],
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'rekey',
              info: JSON.stringify(innerEnvelope),
              kick: userAddress,
            },
          }),
          // Use OLD config key for encryption so recipients can decrypt with their current key
          oldConfigKey
            ? {
                type: 'x448' as const,
                public_key: [...hexToSpreadArray(oldConfigKey.publicKey)],
                private_key: [...hexToSpreadArray(oldConfigKey.privateKey)],
              }
            : undefined
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
        idCounter++;
      }
      const envelope = await secureChannel.SealSyncEnvelope(
        members.find((m) => m.user_address === userAddress)!.inbox_address,
        hubKey.address!,
        {
          type: 'ed448',
          private_key: [
            ...hexToSpreadArray(hubKey.privateKey),
          ],
          public_key: [
            ...hexToSpreadArray(hubKey.publicKey),
          ],
        },
        {
          type: 'ed448',
          private_key: [
            ...hexToSpreadArray(ownerKey.privateKey),
          ],
          public_key: [
            ...hexToSpreadArray(ownerKey.publicKey),
          ],
        },
        JSON.stringify({
          type: 'control',
          message: {
            type: 'kick',
            kick: userAddress,
          },
        }),
        // Use OLD config key for encryption so kicked user can decrypt the kick message
        oldConfigKey
          ? {
              type: 'x448' as const,
              public_key: [...hexToSpreadArray(oldConfigKey.publicKey)],
              private_key: [...hexToSpreadArray(oldConfigKey.privateKey)],
            }
          : undefined
      );
      outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      const messageId = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from('kick' + userAddress, 'utf-8')
      );
      const msg = {
        channelId: space!.defaultChannelId,
        spaceId: spaceId,
        messageId: Buffer.from(messageId).toString('hex'),
        digestAlgorithm: 'SHA-256',
        nonce: Buffer.from(messageId).toString('hex'),
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content: { senderId: userAddress, type: 'kick' } as KickMessage,
      } as Message;
      await this.saveMessage(
        msg,
        this.messageDB,
        spaceId,
        space!.defaultChannelId,
        'group',
        {}
      );
      await this.addMessage(queryClient, spaceId, space!.defaultChannelId, msg);
      try {
        const kicked = await this.messageDB.getSpaceMember(spaceId, userAddress);
        if (kicked) {
          await this.messageDB.saveSpaceMember(spaceId, {
            ...kicked,
            inbox_address: '',
            isKicked: true,
          });
          await queryClient.setQueryData(
            buildSpaceMembersKey({ spaceId }),
            (
              oldData: (secureChannel.UserProfile & {
                inbox_address: string;
                isKicked?: boolean;
              })[]
            ) => {
              const previous = oldData ?? [];
              return previous.map((m) =>
                m.user_address === userAddress
                  ? { ...m, inbox_address: '', isKicked: true }
                  : m
              );
            }
          );
        }
      } catch {}

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

      await this.apiClient.postSpaceInviteEvals(out);

      space!.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
      await this.messageDB.saveSpace(space!);
      await queryClient.setQueryData(
        buildSpaceKey({ spaceId: space?.spaceId! }),
        space
      );

      await this.messageDB.saveEncryptionState(
        { ...state, state: JSON.stringify(session) },
        true
      );
      return outbounds;
    });
  }

  /**
   * Creates new channel in space: generates keys, saves to DB, returns channel ID.
   */
  async createChannel(spaceId: string) {
    const gp = ch.js_generate_ed448();
    const groupPair = JSON.parse(gp);
    const gh = await sha256.digest(
      Buffer.from(new Uint8Array(groupPair.public_key))
    );
    const groupAddress = base58btc.baseEncode(gh.bytes);

    await this.messageDB.saveSpaceKey({
      spaceId: spaceId,
      keyId: groupAddress,
      publicKey: Buffer.from(new Uint8Array(groupPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(groupPair.private_key)).toString(
        'hex'
      ),
    });

    return groupAddress;
  }

  /**
   * Sends control message to space via hub (signed with hub key).
   */
  async sendHubMessage(spaceId: string, message: string) {
    const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
    const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
    const envelope = await secureChannel.SealHubEnvelope(
      hubKey.address!,
      {
        type: 'ed448',
        private_key: [
          ...hexToSpreadArray(hubKey.privateKey),
        ],
        public_key: [...hexToSpreadArray(hubKey.publicKey)],
      },
      message,
      configKey
        ? {
            type: 'x448',
            public_key: [...hexToSpreadArray(configKey.publicKey)],
            private_key: [...hexToSpreadArray(configKey.privateKey)],
          }
        : undefined
    );
    return JSON.stringify({ type: 'group', ...envelope });
  }
}
