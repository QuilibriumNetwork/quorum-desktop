// EncryptionService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles encryption state management and key operations

import { MessageDB, EncryptionState } from '../db/messages';
import { Space } from '../api/quorumApi';
import { sha256, base58btc } from '../utils/crypto';
import { int64ToBytes } from '../utils/bytes';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildConfigKey } from '../hooks';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../utils';
import { QuorumApiClient } from '../api/baseTypes';

// Type definitions for the service
export interface EncryptionServiceDependencies {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  keyset: {
    deviceKeyset: secureChannel.DeviceKeyset;
    userKeyset: secureChannel.UserKeyset;
  };
  updateSpace: (space: Space) => Promise<void>;
  selfAddress: string;
}

export class EncryptionService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private keyset: {
    deviceKeyset: secureChannel.DeviceKeyset;
    userKeyset: secureChannel.UserKeyset;
  };
  private updateSpace: (space: Space) => Promise<void>;
  private selfAddress: string;

  constructor(dependencies: EncryptionServiceDependencies) {
    this.messageDB = dependencies.messageDB;
    this.apiClient = dependencies.apiClient;
    this.saveConfig = dependencies.saveConfig;
    this.keyset = dependencies.keyset;
    this.updateSpace = dependencies.updateSpace;
    this.selfAddress = dependencies.selfAddress;
  }

  // EXACT COPY: deleteEncryptionStates function from MessageDB.tsx line 258-276
  async deleteEncryptionStates({ conversationId }: { conversationId: string }) {
    try {
      const states = await this.messageDB.getEncryptionStates({ conversationId });
      for (const state of states) {
        await this.messageDB.deleteEncryptionState(state);
        if (state.inboxId) {
          try {
            await this.messageDB.deleteInboxMapping(state.inboxId);
          } catch {}
        }
      }
      try {
        await this.messageDB.deleteLatestState(conversationId);
      } catch {}
    } catch {}
  }

  // EXACT COPY: ensureKeyForSpace function from MessageDB.tsx line 1990-2186
  async ensureKeyForSpace(user_address: string, space: Space, queryClient: QueryClient) {
    let spaceKey:
      | {
          address?: string;
          spaceId: string;
          keyId: string;
          publicKey: string;
          privateKey: string;
        }
      | undefined = undefined;
    try {
      spaceKey = await this.messageDB.getSpaceKey(space.spaceId, space.spaceId);
    } catch {}
    if (spaceKey) {
      return space.spaceId;
    }

    const sp = ch.js_generate_ed448();
    const spacePair = JSON.parse(sp);
    const sh = await sha256.digest(
      Buffer.from(new Uint8Array(spacePair.public_key))
    );
    const spaceAddress = base58btc.baseEncode(sh.bytes);
    const cp = ch.js_generate_x448();
    const configPair = JSON.parse(cp);
    let ownerKey: {
      address?: string;
      spaceId: string;
      keyId: string;
      publicKey: string;
      privateKey: string;
    };
    let inboxAddress = '';

    const keys = await this.messageDB.getSpaceKeys(space.spaceId);
    for (const key of keys) {
      await this.messageDB.deleteSpaceKey(space.spaceId, key.keyId);
      if (key.keyId != 'config') {
        await this.messageDB.saveSpaceKey({ ...key, spaceId: spaceAddress });
      }

      if (key.keyId == 'inbox') {
        inboxAddress = key.address!;
      }

      if (key.keyId.startsWith('Qm')) {
        const conversations = await this.messageDB.getConversations({
          type: 'group',
          limit: 100000,
        });
        for (const conv of conversations.conversations) {
          conv.conversationId =
            spaceAddress + '/' + conv.conversationId.split('/')[1];
          await this.messageDB.saveConversation(conv);
        }
        const messages = await this.messageDB.getMessages({
          spaceId: space.spaceId,
          channelId: key.keyId,
          limit: 100000,
        });
        for (const message of messages.messages) {
          await this.messageDB.saveMessage(
            { ...message, spaceId: spaceAddress },
            0,
            spaceAddress,
            'group',
            DefaultImages.UNKNOWN_USER,
            t`Unknown User`
          );
        }
      }

      if (key.keyId == 'owner') {
        ownerKey = key;
      }
    }

    const encryptionStates = await this.messageDB.getEncryptionStates({
      conversationId: space.spaceId + '/' + space.spaceId,
    });
    for (const es of encryptionStates) {
      await this.messageDB.deleteEncryptionState(es);
      es.conversationId = spaceAddress + '/' + spaceAddress;
      await this.messageDB.saveEncryptionState(es, true);
    }

    const members = await this.messageDB.getSpaceMembers(space.spaceId);
    for (const member of members) {
      await this.messageDB.deleteSpaceMember(space.spaceId, member.user_address);
      if (member.user_address == this.selfAddress) {
        await this.messageDB.saveSpaceMember(spaceAddress, {
          ...member,
          spaceId: spaceAddress,
          inbox_address: inboxAddress,
        } as any);
      } else {
        await this.messageDB.saveSpaceMember(spaceAddress, {
          ...member,
          spaceId: spaceAddress,
        } as any);
      }
    }

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

    const ts = Date.now();
    const ownerPayload = Buffer.from(
      new Uint8Array([
        ...spacePair.public_key,
        ...configPair.public_key,
        ...new Uint8Array(Buffer.from(ownerKey!.publicKey, 'hex')),
        ...int64ToBytes(ts),
      ])
    ).toString('base64');
    const spacePayload = Buffer.from(
      new Uint8Array([
        ...spacePair.public_key,
        ...configPair.public_key,
        ...new Uint8Array(Buffer.from(ownerKey!.publicKey, 'hex')),
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
        Buffer.from(
          new Uint8Array(Buffer.from(ownerKey!.privateKey, 'hex'))
        ).toString('base64'),
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
      owner_public_keys: [ownerKey!.publicKey],
      owner_signatures: [
        Buffer.from(ownerSignature, 'base64').toString('hex'),
      ],
      timestamp: ts,
    });

    const config = await this.messageDB.getUserConfig({ address: user_address });
    config.spaceIds = config.spaceIds.map((s) =>
      s == space.spaceId ? spaceAddress : s
    );
    await this.saveConfig({ config, keyset: this.keyset });

    await this.messageDB.deleteSpace(space.spaceId);
    await this.messageDB.saveSpaceKey({
      spaceId: spaceAddress,
      keyId: spaceAddress,
      address: spaceAddress,
      publicKey: Buffer.from(new Uint8Array(spacePair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(spacePair.private_key)).toString(
        'hex'
      ),
    });
    space.spaceId = spaceAddress;
    await this.updateSpace(space);
    const spaces = await this.messageDB.getSpaces();
    queryClient.setQueryData(buildSpacesKey({}), (oldData) => {
      return spaces;
    });
    queryClient.setQueryData(
      buildConfigKey({ userAddress: user_address }),
      () => {
        return config;
      }
    );
    return spaceAddress;
  }
}