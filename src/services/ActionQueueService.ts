import { ACTION_QUEUE_CONCURRENCY } from '../config/actionQueue';
import { QueueTask, ActionType } from '../actions/types';

type HandlersMap = {
  [K in ActionType]?: (context: any) => Promise<void>;
};

export class ActionQueueService {
  private processing = false;
  private concurrency: number;
  private handlers: HandlersMap;
  private messageDB: any;

  constructor({ handlers, messageDB, concurrency }: { handlers: HandlersMap; messageDB: any; concurrency?: number }) {
    this.handlers = handlers;
    this.messageDB = messageDB;
    this.concurrency = Math.max(1, concurrency ?? ACTION_QUEUE_CONCURRENCY);
  }

  async addTask(taskType: ActionType, context: any, key: string): Promise<number> {
    const id = await this.messageDB.addQueueTask({ taskType, context, key, status: 'pending', retryCount: 0, createdAt: Date.now() });
    // Trigger processing asynchronously
    this.processQueue().catch(() => {});
    try {
      (window as any).dispatchEvent(new CustomEvent('quorum:queue-updated'));
    } catch {}
    return id;
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.messageDB.resetProcessingToPending();
      const pending: QueueTask[] = await this.messageDB.getPendingQueueTasks();
      if (!pending.length) return;
      const groups = this.groupByKey(pending);
      const keys = Object.keys(groups);
      for (let i = 0; i < keys.length; i += this.concurrency) {
        const slice = keys.slice(i, i + this.concurrency);
        await Promise.all(slice.map((k) => this.processKeySerial(groups[k])));
      }
      try {
        (window as any).dispatchEvent(new CustomEvent('quorum:queue-updated'));
      } catch {}
    } finally {
      this.processing = false;
    }
  }

  private groupByKey(tasks: QueueTask[]): Record<string, QueueTask[]> {
    return tasks.reduce((acc, t) => {
      (acc[t.key] ||= []).push(t);
      return acc;
    }, {} as Record<string, QueueTask[]>);
  }

  private async processKeySerial(tasks: QueueTask[]) {
    // sort by createdAt ascending to preserve order
    tasks.sort((a, b) => a.createdAt - b.createdAt);
    for (const task of tasks) {
      await this.runTask(task);
    }
  }

  private async runTask(task: QueueTask) {
    // mark processing
    task.status = 'processing';
    task.processedAt = Date.now();
    await this.messageDB.updateQueueTask(task);

    const handler = this.handlers[task.taskType];
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler for task type: ${task.taskType}`;
      await this.messageDB.updateQueueTask(task);
      return;
    }

    try {
      await handler(task.context);
      // delete tasks after success
      if (task.id != null) {
        await this.messageDB.deleteQueueTask(task.id);
      }
      try {
        (window as any).dispatchEvent(new CustomEvent('quorum:queue-updated'));
      } catch {}
      try {
        const msg = this.successMessage(task.taskType);
        if (msg) {
          (window as any).dispatchEvent(
            new CustomEvent('quorum:toast', { detail: { message: msg, variant: 'success' } })
          );
        }
      } catch {}
    } catch (err: any) {
      // simple retry policy: up to 3 attempts with exponential backoff trigger via next cycles
      task.retryCount = (task.retryCount ?? 0) + 1;
      task.status = task.retryCount >= 3 ? 'failed' : 'pending';
      task.error = err?.message || String(err);
      await this.messageDB.updateQueueTask(task);
      try {
        (window as any).dispatchEvent(new CustomEvent('quorum:queue-updated'));
      } catch {}
      try {
        if (task.status === 'failed') {
          (window as any).dispatchEvent(
            new CustomEvent('quorum:toast', { detail: { message: this.failureMessage(task.taskType, task.error), variant: 'error' } })
          );
        }
      } catch {}
    }
  }

  private successMessage(type: ActionType): string | null {
    switch (type) {
      case 'send-message':
        return 'Message sent';
      case 'save-user-config':
        return 'Settings saved';
      case 'kick-user':
        return 'User kicked';
      default:
        return null;
    }
  }

  private failureMessage(type: ActionType, error?: string): string {
    const base = (() => {
      switch (type) {
        case 'send-message':
          return 'Failed to send message';
        case 'save-user-config':
          return 'Failed to save settings';
        case 'kick-user':
          return 'Failed to kick user';
        default:
          return 'Task failed';
      }
    })();
    return error ? `${base}: ${error}` : base;
  }
}


