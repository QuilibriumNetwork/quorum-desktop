import { Message } from '../api/quorumApi';

export interface EncryptedMessage {
  encryptedContent: string;
  inboxAddress: string;
  timestamp: number;
}

export interface DecryptionResult {
  decryptedMessage: Message;
  newState: any;
}

export class MessagesDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getMessage({
    spaceId,
    channelId,
    messageId,
  }: {
    spaceId: string;
    channelId: string;
    messageId: string;
  }): Promise<Message | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');

      const request = store.get(messageId);

      request.onsuccess = (event) => {
        const message = request.result;

        if (message?.channelId === channelId && message?.spaceId === spaceId) {
          resolve(message as Message);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSpaceMessages({
    spaceId,
    getSpace,
  }: {
    spaceId: string;
    getSpace: (spaceId: string) => Promise<any>;
  }): Promise<Message[]> {
    return new Promise(async (resolve, reject) => {
      const space = await getSpace(spaceId);
      const channelIds = space!.groups
        .flatMap((g: any) => g.channels.map((c: any) => c.channelId))
        .sort();
      const transaction = this.db.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      let range: IDBKeyRange;

      // Initial load - get latest messages
      range = IDBKeyRange.bound(
        [spaceId, channelIds[0], 0],
        [spaceId, channelIds[channelIds.length - 1], Number.MAX_VALUE]
      );

      const request = index.getAll(range);

      request.onsuccess = (event) => {
        const messages = request.result;
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages({
    spaceId,
    channelId,
    cursor,
    direction = 'backward',
    limit = 100,
  }: {
    spaceId: string;
    channelId: string;
    cursor?: number;
    direction?: 'forward' | 'backward';
    limit?: number;
  }): Promise<{
    messages: Message[];
    nextCursor: number | null;
    prevCursor: number | null;
  }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('by_conversation_time');

      let range: IDBKeyRange;
      if (!cursor) {
        // Initial load - get latest messages
        range = IDBKeyRange.bound(
          [spaceId, channelId, 0],
          [spaceId, channelId, Number.MAX_VALUE]
        );
      } else if (direction === 'forward') {
        // Get messages newer than cursor
        range = IDBKeyRange.bound(
          [spaceId, channelId, cursor],
          [spaceId, channelId, Number.MAX_VALUE],
          true
        );
      } else {
        // Get messages older than cursor
        range = IDBKeyRange.bound(
          [spaceId, channelId, 0],
          [spaceId, channelId, cursor],
          false,
          true // exclude the cursor value itself
        );
      }

      // For initial load and backward pagination, we want reverse order
      const request =
        !cursor || direction === 'backward'
          ? index.openCursor(range, 'prev')
          : index.openCursor(range, 'next');

      const messages: Message[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Calculate cursors for next/prev pages
          const nextCursor =
            messages.length === limit
              ? direction === 'forward'
                ? messages[messages.length - 1].createdDate
                : messages[0].createdDate
              : null;

          const prevCursor =
            messages.length > 0
              ? direction === 'forward'
                ? messages[0].createdDate
                : messages[messages.length - 1].createdDate
              : null;

          // For backward pagination and initial load, reverse the array
          // to maintain chronological order
          if (!cursor || direction === 'backward') {
            messages.reverse();
          }

          resolve({
            messages,
            nextCursor,
            prevCursor,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const messageRequest = store.put(message);

      messageRequest.onsuccess = () => resolve();
      messageRequest.onerror = () => reject(messageRequest.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const messageRequest = store.delete(messageId);
      messageRequest.onerror = () => reject(messageRequest.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getDirectMessages(conversationId: string): Promise<Message[]> {
    // Parse conversationId to get spaceId and channelId
    const [spaceId, channelId] = conversationId.split('/');
    if (!spaceId || !channelId) return [];

    const result = await this.getMessages({ spaceId, channelId, limit: 1000 });
    return result.messages;
  }
}
