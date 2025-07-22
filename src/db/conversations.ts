import { Conversation, Message } from '../api/quorumApi';

export class ConversationsDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getInboxMapping(inboxId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('inbox_mapping', 'readonly');
      const store = transaction.objectStore('inbox_mapping');
      const request = store.get(inboxId);

      request.onsuccess = () => resolve(request.result?.conversationId || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveReadTime({
    conversationId,
    lastMessageTimestamp,
  }: {
    conversationId: string;
    lastMessageTimestamp: number;
  }): Promise<void> {
    const conversation = await this.getConversation({ conversationId });

    if (conversation.conversation) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction('conversations', 'readwrite');
        const store = transaction.objectStore('conversations');
        const request = store.put({
          ...conversation.conversation,
          lastReadTimestamp: lastMessageTimestamp,
        });

        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getConversation({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<{ conversation?: Conversation }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('conversations', 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get([conversationId]);

      request.onsuccess = () => {
        const conversation = request.result;
        resolve({ conversation });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('conversations', 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conversation);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getConversations({
    type,
    cursor,
    limit = 1000,
  }: {
    type: 'direct' | 'group';
    cursor?: number;
    limit?: number;
  }): Promise<{ conversations: Conversation[]; nextCursor: number | null }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('conversations', 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('by_type_time');

      const range = cursor
        ? IDBKeyRange.upperBound([type, cursor])
        : IDBKeyRange.bound([type, 0], [type, Number.MAX_VALUE]);

      const request = index.getAll(range, limit);

      request.onsuccess = () => {
        const conversations = request.result;
        const nextCursor =
          conversations.length === limit
            ? conversations[conversations.length - 1].timestamp
            : null;
        resolve({ conversations, nextCursor });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversationUsers(
    conversationId: string,
    addresses: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        'conversation_users',
        'readwrite'
      );
      const store = transaction.objectStore('conversation_users');
      for (const address of addresses) {
        store.put({ conversationId, address });
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveConversationFromMessage(
    message: Message,
    address: string,
    conversationType: string,
    icon: string,
    displayName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('conversations', 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put({
        conversationId: message.spaceId + '/' + message.channelId,
        address: address,
        icon: icon,
        displayName: displayName,
        type: conversationType,
        timestamp: message.createdDate,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
