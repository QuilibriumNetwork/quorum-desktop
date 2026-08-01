// The MessageServiceDependencies a bot needs. For DM traffic the space/sync
// dependencies are never exercised, so they are loud no-ops (they log if a DM
// path ever reaches them — a signal something unexpected happened). The few that
// DM receive/send DO use are wired faithfully to the app's own implementations:
//   - deleteInboxMessages: signs + POSTs /inbox/delete (copied from MessageDB.tsx)
//   - deleteEncryptionStates: get + delete the conversation's rows via MessageDB
//   - enqueueOutbound: run the action and push its frames to the socket
//   - addOrUpdateConversation: persist the conversation row (the UI/query-cache
//     half is irrelevant headlessly)
import { channel, channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { logger } from '@quilibrium/quorum-shared';
import type { QueryClient } from '@tanstack/react-query';
import type { MessageDB } from '../../../db/messages';
import type { QuorumApiClient } from '../../../api/baseTypes';
import type { WsTransport } from './transport';
import { preferIncomingProfileField } from '../../../utils/conversationProfile';

type Ref<T> = { current: T };

/** Faithful copy of MessageDB.tsx deleteInboxMessages (signs the delete). */
export async function deleteInboxMessages(
  inboxKeyset: channel.InboxKeyset,
  timestamps: number[],
  apiClient: QuorumApiClient
): Promise<void> {
  const del = {
    inbox_address: inboxKeyset.inbox_address,
    timestamps,
    inbox_public_key: Buffer.from(
      new Uint8Array(inboxKeyset.inbox_key.public_key)
    ).toString('hex'),
    inbox_signature: Buffer.from(
      JSON.parse(
        channel_raw.js_sign_ed448(
          Buffer.from(new Uint8Array(inboxKeyset.inbox_key.private_key)).toString('base64'),
          Buffer.from(
            inboxKeyset.inbox_address + timestamps.map((t) => `${t}`).join('')
          ).toString('base64')
        )
      ) as string,
      'base64'
    ).toString('hex'),
  } as channel.DeleteMessages;
  await apiClient.deleteInbox(del);
}

export interface DepsInput {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  transport: WsTransport;
}

/** Build the dependency object MessageService's constructor expects. */
export function makeDeps(input: DepsInput) {
  const { messageDB, apiClient, transport } = input;

  const noop = (label: string) => async (...args: unknown[]) => {
    logger.warn(`[harness] unexpected DM dep call: ${label}`, { argc: args.length });
  };

  return {
    messageDB,
    apiClient,

    // Run the outbound action and push each resulting frame to the socket, so
    // delivery/read receipts and re-listens actually leave the bot.
    enqueueOutbound: (action: () => Promise<string[]>) => {
      void (async () => {
        try {
          const frames = await action();
          for (const f of frames) transport.send(f);
        } catch (err) {
          logger.warn('[harness] enqueueOutbound action failed', { err });
        }
      })();
    },

    deleteInboxMessages,

    deleteEncryptionStates: async ({ conversationId }: { conversationId: string }) => {
      const rows = await messageDB.getEncryptionStates({ conversationId });
      for (const r of rows) await messageDB.deleteEncryptionState(r);
    },

    addOrUpdateConversation: async (
      _queryClient: QueryClient,
      address: string,
      timestamp: number,
      _lastReadTimestamp: number,
      updatedUserProfile?: Partial<channel.UserProfile>
    ) => {
      const conversationId = address + '/' + address;
      try {
        const existing = await messageDB.getConversation({ conversationId });
        if (existing?.conversation) {
          await messageDB.saveConversation({
            ...existing.conversation,
            // Must match MessageDB.addOrUpdateConversation exactly — the harness
            // exists to reproduce production behaviour, so a divergent merge here
            // would hide the very bug it is meant to catch.
            displayName: preferIncomingProfileField(
              updatedUserProfile?.display_name,
              existing.conversation.displayName
            ),
            icon: preferIncomingProfileField(
              updatedUserProfile?.user_icon,
              existing.conversation.icon
            ),
            timestamp: Math.max(timestamp, existing.conversation.timestamp),
          });
        }
      } catch (err) {
        logger.warn('[harness] addOrUpdateConversation persist failed', { err });
      }
    },

    navigate: () => {},
    spaceInfo: { current: {} } as Ref<Record<string, channel.SpaceRegistration>>,
    syncInfo: { current: {} } as Ref<Record<string, unknown>>,

    // Space/sync surface — not reached by DM traffic. Loud no-ops.
    synchronizeAll: noop('synchronizeAll'),
    informSyncData: noop('informSyncData'),
    initiateSync: noop('initiateSync'),
    directSync: noop('directSync'),
    saveConfig: noop('saveConfig'),
    sendHubMessage: (async () => '' ) as unknown as (spaceId: string, message: string) => Promise<string>,
    handleSyncInitiateV2: noop('handleSyncInitiateV2'),
    handleSyncManifest: noop('handleSyncManifest'),
  };
}
