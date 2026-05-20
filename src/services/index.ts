// Service exports for clean imports

// Class-based services (extracted from MessageDB - need instantiation)
export { MessageService } from './MessageService';
export { EncryptionService } from './EncryptionService';
export { SpaceService } from './SpaceService';
export { SyncService } from './SyncService';
export { ConfigService } from './ConfigService';
export { InvitationService } from './InvitationService';

// Action Queue (background task processing)
export { ActionQueueService } from './ActionQueueService';
export { ActionQueueHandlers } from './ActionQueueHandlers';
export type { HandlerDependencies, TaskHandler } from './ActionQueueHandlers';

// Backup
export { BackupService, BackupError } from './BackupService';
export type { BackupFile, BackupPayload, BackupErrorType } from './BackupService';

// Utility services
export { SearchService } from './SearchService';
export { notificationService } from './NotificationService';
