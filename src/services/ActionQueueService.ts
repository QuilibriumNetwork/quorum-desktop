/**
 * ActionQueueService - Persistent Background Task Queue
 *
 * Provides crash-resistant, offline-capable task processing for operations like:
 * - Sending messages
 * - Saving user config
 * - Space settings updates
 * - Moderation actions (kick, mute)
 *
 * See: .agents/tasks/background-action-queue.md
 */

import { MessageDB } from '../db/messages';
import type { QueueTask, ActionType, QueueStats } from '../types/actionQueue';
import type { ActionQueueHandlers } from './ActionQueueHandlers';
import { showError } from '../utils/toast';

export class ActionQueueService {
  private messageDB: MessageDB;
  private handlers: ActionQueueHandlers | null = null; // Lazy init to avoid circular deps
  private isProcessing = false;
  private processInterval: ReturnType<typeof setInterval> | null = null;

  // Callback to check online status from ActionQueueContext
  // Uses WebSocket state instead of unreliable navigator.onLine
  // See: .agents/tasks/offline-detection-and-optimistic-message-reliability.md
  private isOnlineCallback?: () => boolean;

  // Debounced queue update event
  private queueUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly queueUpdateDebounceMs = 500;

  // Config
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 2000;
  private readonly maxRetryDelayMs = 5 * 60 * 1000; // 5 minutes
  private readonly processIntervalMs = 1000;
  private readonly batchSize = 10;
  private readonly multiTabGraceMs = 30000; // 30 seconds grace for other tabs

  // Queue limits
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_TASK_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(messageDB: MessageDB) {
    this.messageDB = messageDB;
    // Note: handlers set later via setHandlers() to avoid circular deps
  }

  /**
   * Set callback to check online status.
   * Uses ActionQueueContext's isOnline which combines WebSocket + navigator.onLine.
   */
  setIsOnlineCallback(callback: () => boolean): void {
    this.isOnlineCallback = callback;
  }

  /**
   * Set handlers after all services are initialized.
   * Call this from the context provider after everything is wired up.
   */
  setHandlers(handlers: ActionQueueHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Enqueue a task for background processing
   */
  async enqueue(
    type: ActionType,
    context: Record<string, unknown>,
    key: string
  ): Promise<number> {
    // Check queue size limits
    const stats = await this.messageDB.getQueueStats();
    if (stats.total >= this.MAX_QUEUE_SIZE) {
      await this.pruneOldTasks();

      const newStats = await this.messageDB.getQueueStats();
      if (newStats.pending >= this.MAX_QUEUE_SIZE / 2) {
        throw new Error('Action queue is full. Please try again later.');
      }
    }

    const task: Omit<QueueTask, 'id'> = {
      taskType: type,
      context,
      key,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.maxRetries,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };

    const id = await this.messageDB.addQueueTask(task);
    this.notifyQueueUpdated();
    this.processQueue(); // Trigger processing
    return id;
  }

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    if (this.processInterval) return;

    // Reset stuck tasks from previous crash
    const reset = await this.messageDB.resetStuckProcessingTasks();
    if (reset > 0) {
      console.log(`[ActionQueue] Reset ${reset} stuck tasks on startup`);
    }

    this.processInterval = setInterval(
      () => this.processQueue(),
      this.processIntervalMs
    );
    this.processQueue();
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process pending tasks in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    // Check online status via callback (uses WebSocket + navigator.onLine)
    // Falls back to navigator.onLine if callback not set yet
    const isOnline = this.isOnlineCallback
      ? this.isOnlineCallback()
      : typeof navigator !== 'undefined'
        ? navigator.onLine
        : true;
    if (!isOnline) return;

    if (!this.handlers) {
      console.warn('[ActionQueue] Handlers not initialized');
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      const pending = await this.messageDB.getQueueTasksByStatus(
        'pending',
        this.batchSize
      );
      const ready = pending.filter((t) => t.nextRetryAt <= now);

      if (ready.length === 0) return;

      // Sequential processing (simpler, safer)
      for (const task of ready) {
        await this.processTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: QueueTask): Promise<void> {
    if (!this.handlers) {
      throw new Error('ActionQueueService: Handlers not initialized');
    }

    // === MULTI-TAB SAFETY: Status-based gating ===
    // Re-fetch task to check current status (reduces race window to milliseconds)
    const freshTask = await this.messageDB.getQueueTask(task.id!);
    if (!freshTask || freshTask.status !== 'pending') {
      // Another tab already grabbed it - skip
      return;
    }

    // Check if recently started by another tab (may still be processing)
    if (
      freshTask.processingStartedAt &&
      Date.now() - freshTask.processingStartedAt < this.multiTabGraceMs
    ) {
      // Give the other tab time to finish
      return;
    }

    const handler = this.handlers.getHandler(task.taskType);
    if (!handler) {
      task.status = 'failed';
      task.error = `No handler registered for task type: ${task.taskType}`;
      await this.messageDB.updateQueueTask(task);
      this.notifyQueueUpdated();
      return;
    }

    // Mark as processing with timestamp for crash recovery & multi-tab gating
    task.status = 'processing';
    task.processingStartedAt = Date.now();
    await this.messageDB.updateQueueTask(task);

    try {
      await handler.execute(task.context);

      // Success - delete task
      await this.messageDB.deleteQueueTask(task.id!);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check for auth errors - don't retry, user needs to re-login
      if (
        err.message.includes('401') ||
        err.message.toLowerCase().includes('unauthorized')
      ) {
        task.status = 'failed';
        task.error = 'Session expired. Please log in again.';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('quorum:session-expired'));
        }
        // Call onFailure callback for auth errors
        handler.onFailure?.(task.context, err);
        await this.messageDB.updateQueueTask(task);
        this.notifyQueueUpdated();
        return;
      }

      if (handler.isPermanentError(err)) {
        task.status = 'failed';
        task.error = err.message;
        task.processedAt = Date.now();
        if (handler.failureMessage) {
          showError(handler.failureMessage);
        }
        // Call onFailure callback for permanent errors
        handler.onFailure?.(task.context, err);
      } else {
        task.retryCount++;
        if (task.retryCount >= task.maxRetries) {
          task.status = 'failed';
          task.error = `Max retries exceeded: ${err.message}`;
          task.processedAt = Date.now();
          if (handler.failureMessage) {
            showError(handler.failureMessage);
          }
          // Call onFailure callback when max retries exceeded
          handler.onFailure?.(task.context, err);
        } else {
          task.status = 'pending';
          task.nextRetryAt = Date.now() + this.calculateBackoff(task.retryCount);
          task.error = err.message;
          // Don't show toast for retryable errors
        }
      }

      task.processingStartedAt = undefined;
      await this.messageDB.updateQueueTask(task);
    }

    this.notifyQueueUpdated();
  }

  /**
   * Debounced event to notify UI of queue changes.
   * Prevents event spam when processing many tasks rapidly.
   */
  private notifyQueueUpdated(): void {
    if (this.queueUpdateTimer) {
      clearTimeout(this.queueUpdateTimer);
    }

    this.queueUpdateTimer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('quorum:queue-updated'));
      }
      this.queueUpdateTimer = null;
    }, this.queueUpdateDebounceMs);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const delay = this.baseRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.maxRetryDelayMs);
  }

  /**
   * Prune old tasks to prevent queue from growing unbounded
   */
  private async pruneOldTasks(): Promise<void> {
    const cutoff = Date.now() - this.MAX_TASK_AGE_MS;

    // Delete old completed tasks
    await this.messageDB.pruneCompletedTasks(this.MAX_TASK_AGE_MS);

    // Delete old failed tasks
    const failed = await this.messageDB.getQueueTasksByStatus('failed', 1000);
    for (const task of failed) {
      if (task.processedAt && task.processedAt < cutoff) {
        await this.messageDB.deleteQueueTask(task.id!);
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return this.messageDB.getQueueStats();
  }
}
