// The SPACE service graph, wired the way MessageDB.tsx wires it — minus React.
//
// The DM harness stubs the ~17 space/sync dependencies as loud no-ops because DM
// traffic never reaches them (`deps.ts`). For spaces they are load-bearing: a
// post reaches a peer only when a sync reconciles the two clients, and the
// member roster rides the same exchange. So this builds the real services —
// ConfigService, SyncService, InvitationService, SpaceService — and hands
// MessageService their real methods.
//
// Construction order is forced by a genuine cycle in the app's own graph:
//
//   SpaceService.sendHubMessage ← ConfigService, SyncService, InvitationService
//   SyncService.*               ← MessageService
//   MessageService.saveMessage  ← SpaceService
//
// MessageDB.tsx breaks it with a `sendHubMessageRef` forward ref and by defining
// saveMessage/addMessage as closures over a `messageService` that is assigned
// later. This mirrors both, deliberately: the harness reproduces production
// behaviour, so a "tidier" construction order that changed who observes what
// would undermine the measurement.
import { QueryClient } from '@tanstack/react-query';
import { logger } from '@quilibrium/quorum-shared';
import type { Message } from '@quilibrium/quorum-shared';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageService } from '../../../services/MessageService';
import type { MessageServiceDependencies } from '../../../services/MessageService';
import { ConfigService } from '../../../services/ConfigService';
import { SyncService } from '../../../services/SyncService';
import { InvitationService } from '../../../services/InvitationService';
import { SpaceService } from '../../../services/SpaceService';
import { ActionQueueService } from '../../../services/ActionQueueService';
import { ActionQueueHandlers } from '../../../services/ActionQueueHandlers';
import type { HandlerDependencies } from '../../../services/ActionQueueHandlers';
import type { MessageDB } from '../../../db/messages';
import type { QuorumApiClient } from '../../../api/baseTypes';
import type { WsTransport } from './transport';
import { createOutboundQueue, type OutboundQueue } from './outbound';
import { deleteInboxMessages } from './deps';
import { preferIncomingProfileField } from '../../../utils/conversationProfile';

export interface SpaceGraphInput {
  messageDB: MessageDB;
  apiClient: QuorumApiClient;
  transport: WsTransport;
  queryClient: QueryClient;
  selfAddress: string;
  keyset: {
    userKeyset: secureChannel.UserKeyset;
    deviceKeyset: secureChannel.DeviceKeyset;
  };
}

export interface SpaceGraph {
  messageService: MessageService;
  spaceService: SpaceService;
  syncService: SyncService;
  invitationService: InvitationService;
  configService: ConfigService;
  actionQueueService: ActionQueueService;
  outbound: OutboundQueue;
  /** Live refs the services share, exposed so a scenario can inspect them. */
  spaceInfo: { current: Record<string, secureChannel.SpaceRegistration> };
  syncInfo: { current: Record<string, unknown> };
}

export function createSpaceGraph(input: SpaceGraphInput): SpaceGraph {
  const { messageDB, apiClient, transport, queryClient, selfAddress, keyset } = input;

  const spaceInfo = { current: {} as Record<string, secureChannel.SpaceRegistration> };
  const syncInfo = { current: {} as Record<string, unknown> };

  const outbound = createOutboundQueue(transport);
  const enqueueOutbound = outbound.enqueue;

  // Forward reference — SpaceService is built last but three services above it
  // need its sendHubMessage. Same shape as MessageDB.tsx's sendHubMessageRef.
  const spaceServiceRef: { current?: SpaceService } = {};
  const sendHubMessage = async (spaceId: string, message: string): Promise<string> => {
    if (!spaceServiceRef.current) {
      throw new Error('sendHubMessage called before SpaceService was built');
    }
    return spaceServiceRef.current.sendHubMessage(spaceId, message);
  };

  const configService = new ConfigService({
    messageDB,
    apiClient,
    spaceInfo,
    enqueueOutbound,
    sendHubMessage,
    queryClient,
  });

  const getConfig = (args: { address: string; userKey: secureChannel.UserKeyset }) =>
    configService.getConfig(args);
  const saveConfig = (args: { config: unknown; keyset: unknown }) =>
    configService.saveConfig(args as Parameters<ConfigService['saveConfig']>[0]);

  const syncService = new SyncService({
    messageDB,
    enqueueOutbound,
    syncInfo,
    sendHubMessage,
  });

  const invitationService = new InvitationService({
    messageDB,
    apiClient,
    spaceInfo,
    selfAddress,
    enqueueOutbound,
    queryClient,
    getConfig,
    saveConfig,
    sendHubMessage,
    requestSync: (spaceId: string) => syncService.requestSync(spaceId),
  });

  // The same simple implementation the DM harness uses. The app routes this
  // through EncryptionService, which adds a space-rekey path this harness has no
  // caller for; the deletion itself is identical.
  const deleteEncryptionStates = async ({ conversationId }: { conversationId: string }) => {
    const rows = await messageDB.getEncryptionStates({ conversationId });
    for (const r of rows) await messageDB.deleteEncryptionState(r);
  };

  const addOrUpdateConversation = async (
    _queryClient: QueryClient,
    address: string,
    timestamp: number,
    _lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => {
    const conversationId = address + '/' + address;
    try {
      const existing = await messageDB.getConversation({ conversationId });
      if (existing?.conversation) {
        await messageDB.saveConversation({
          ...existing.conversation,
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
  };

  const messageService = new MessageService({
    messageDB,
    apiClient,
    enqueueOutbound,
    addOrUpdateConversation,
    deleteEncryptionStates,
    deleteInboxMessages,
    navigate: () => {},
    spaceInfo,
    syncInfo,
    synchronizeAll: (spaceId: string, inboxAddress: string) =>
      syncService.synchronizeAll(spaceId, inboxAddress),
    informSyncData: (
      spaceId: string,
      inboxAddress: string,
      messageCount: number,
      memberCount: number,
      theirSummary?: unknown
    ) =>
      syncService.informSyncData(
        spaceId,
        inboxAddress,
        messageCount,
        memberCount,
        theirSummary as Parameters<SyncService['informSyncData']>[4]
      ),
    initiateSync: (spaceId: string) => syncService.initiateSync(spaceId),
    requestSync: (spaceId: string) => syncService.requestSync(spaceId),
    directSync: (spaceId: string, message: unknown) =>
      syncService.directSync(spaceId, message as Parameters<SyncService['directSync']>[1]),
    saveConfig,
    sendHubMessage,
    handleSyncInitiateV2: (spaceId: string, message: unknown) =>
      syncService.handleSyncInitiateV2(
        spaceId,
        message as Parameters<SyncService['handleSyncInitiateV2']>[1]
      ),
    handleSyncManifest: (spaceId: string, targetInbox: string, payload: unknown) =>
      syncService.handleSyncManifest(
        spaceId,
        targetInbox,
        payload as Parameters<SyncService['handleSyncManifest']>[2]
      ),
  } as unknown as MessageServiceDependencies);

  // SpaceService's saveMessage/addMessage go through MessageService AND update
  // the sync cache — MessageDB.tsx does both, and skipping the cache update
  // would leave the sync digest stale for locally-authored messages, which is
  // exactly the kind of divergence that would fake a delivery bug.
  const saveMessage = async (
    message: Message,
    db: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string }
  ) => {
    const result = await messageService.saveMessage(
      message,
      db,
      spaceId,
      channelId,
      conversationType,
      updatedUserProfile
    );
    syncService.updateCacheWithMessage(spaceId, channelId, message);
    return result;
  };

  const addMessage = async (
    qc: QueryClient,
    spaceId: string,
    channelId: string,
    message: Message
  ) => messageService.addMessage(qc, spaceId, channelId, message);

  const spaceService = new SpaceService({
    messageDB,
    apiClient,
    enqueueOutbound,
    saveConfig,
    selfAddress,
    keyset,
    spaceInfo,
    saveMessage,
    addMessage,
  } as unknown as ConstructorParameters<typeof SpaceService>[0]);
  spaceServiceRef.current = spaceService;

  const actionQueueService = new ActionQueueService(messageDB);
  // Handlers BEFORE the keyset: setUserKeyset kicks processQueue immediately, and
  // with no handlers yet that logs "[ActionQueue] Handlers not initialized". The
  // app hits the same warning because both wirings are separate useEffects; here
  // there is no reason to reproduce a log line that means nothing.
  actionQueueService.setHandlers(
    new ActionQueueHandlers({
      messageDB,
      messageService,
      configService,
      spaceService,
      queryClient,
      getUserKeyset: () => actionQueueService.getUserKeyset(),
    } as unknown as HandlerDependencies)
  );
  // Same signal the app uses (ActionQueueContext: wsConnected && navigator.onLine).
  // Without it the service falls back to jsdom's navigator.onLine, which is a
  // hardcoded `true` — so a scenario that closes the socket to test a reconnect
  // would still see the queue draining into a dead transport.
  actionQueueService.setIsOnlineCallback(() => transport.connected);
  actionQueueService.setUserKeyset(keyset);
  messageService.setActionQueueService(actionQueueService);

  return {
    messageService,
    spaceService,
    syncService,
    invitationService,
    configService,
    actionQueueService,
    outbound,
    spaceInfo,
    syncInfo,
  };
}
