// EncryptionService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles encryption state management and key operations

import { MessageDB, EncryptionState } from '../db/messages';
import { int64ToBytes } from '@quilibrium/quorum-shared';
import type { Space } from '@quilibrium/quorum-shared';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
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

  /**
   * Resets the Double Ratchet for a conversation: forgets the ratchet states so
   * the next send re-initialises, while KEEPING the inbox routing intact.
   *
   * The routing must survive. Our peer still holds a confirmed session pointing
   * at our existing conversation inbox and will keep writing to that address —
   * it has no way to learn we reset. If we drop the mapping, those frames arrive
   * at an address we no longer recognise and are silently discarded
   * (`RX-NOSTATE`), and our next send mints a BRAND-NEW inbox the peer never
   * hears about. The result is a permanently one-way conversation: our messages
   * reach the peer (fresh init envelopes to their device inbox) while every
   * message they send disappears. Measured live 2026-07-25: immediately after a
   * desktop reset, mobile kept posting to the old inbox with a still-confirmed
   * session and desktop logged `RX-NOSTATE` for every frame.
   *
   * This mirrors mobile's `encryptionService.resetSession`, which states the
   * same rule explicitly: it deletes ratchet states but deliberately keeps
   * conversation inbox keypairs ("the addresses are still valid for receiving")
   * and inbox mappings ("routing still needs to work"). The desktop reset action
   * added 2026-07-17 mirrored the deletion but not those exclusions.
   */
  async deleteEncryptionStates({ conversationId }: { conversationId: string }) {
    try {
      const states = await this.messageDB.getEncryptionStates({ conversationId });
      for (const state of states) {
        await this.messageDB.deleteEncryptionState(state);
        // Intentionally NOT deleting the inbox mapping — see above. Without the
        // mapping the peer's in-flight session becomes unroutable and the
        // conversation dies in one direction with no recovery path.
      }
      try {
        await this.messageDB.deleteLatestState(conversationId);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  /**
   * Resets the Double Ratchet for EVERY direct conversation — the global
   * "Fix DM Encryption" action, mirroring mobile's entry point in ProfileModal.
   *
   * Deliberately a fan-out over `deleteEncryptionStates` rather than a wholesale
   * wipe of the encryption store. Mobile's global reset calls
   * `encryptionStateStorage.clearAll()`, which also drops conversation inbox
   * keypairs and inbox mappings. On desktop that is precisely the failure
   * documented on `deleteEncryptionStates` above and measured live 2026-07-25:
   * the peer keeps writing to the old inbox with a still-confirmed session,
   * every frame lands as `RX-NOSTATE`, and the conversation goes permanently
   * one-way with no recovery path. Routing each conversation through the
   * hardened per-conversation reset keeps the mappings intact, so the promise
   * this action makes to the user — the next message to each contact
   * establishes a fresh secure connection — holds in BOTH directions.
   *
   * Returns the number of conversations reset, for the success message.
   */
  async resetAllDirectMessageSessions(): Promise<number> {
    // Sweep every DM conversation, paginating the same way getAllDMData does
    // for backup export. Collected into a Set first so the reset loop cannot
    // double-visit a conversation returned on two pages.
    const conversationIds = new Set<string>();
    let cursor: number | undefined;
    for (;;) {
      const page = await this.messageDB.getConversations({
        type: 'direct',
        cursor,
        limit: 1000,
      });
      const sizeBefore = conversationIds.size;
      for (const conversation of page.conversations) {
        conversationIds.add(conversation.conversationId);
      }
      // Stop when the store is exhausted, or when a page contributed nothing
      // new — the latter guards a cursor that fails to advance, which would
      // otherwise spin forever for a user sitting exactly on the page size.
      if (!page.nextCursor || conversationIds.size === sizeBefore) break;
      cursor = page.nextCursor;
    }

    for (const conversationId of conversationIds) {
      // deleteEncryptionStates swallows its own failures, so one unreadable
      // record cannot abort the sweep and leave the rest untouched.
      await this.deleteEncryptionStates({ conversationId });
    }

    return conversationIds.size;
  }

  /**
   * Ensures space has valid keys. If missing, generates new keys and migrates all data to new address.
   */
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
    } catch { /* ignore - spaceKey remains undefined */ }
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
        ...hexToSpreadArray(ownerKey!.publicKey),
        ...int64ToBytes(ts),
      ])
    ).toString('base64');
    const spacePayload = Buffer.from(
      new Uint8Array([
        ...spacePair.public_key,
        ...configPair.public_key,
        ...hexToSpreadArray(ownerKey!.publicKey),
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