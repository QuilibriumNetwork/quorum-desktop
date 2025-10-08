export type ActionType = 'send-message' | 'save-user-config' | 'kick-user';

export type QueueTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueTask {
  id?: number;
  taskType: ActionType;
  context: any;
  key: string; // per-key serial grouping
  status: QueueTaskStatus;
  retryCount: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
}

export type BuildKey = (context: any) => string;


