export interface EncryptionState {
  state: string;
  timestamp: number;
  conversationId: string;
  inboxId: string;
  sentAccept?: boolean;
}

export class EncryptionStatesDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getAllEncryptionStates(): Promise<EncryptionState[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('encryption_states', 'readonly');
      const store = transaction.objectStore('encryption_states');

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEncryptionStates({
    conversationId,
  }: {
    conversationId: string;
  }): Promise<EncryptionState[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('encryption_states', 'readonly');
      const store = transaction.objectStore('encryption_states');

      const request = store.getAll(
        IDBKeyRange.bound(
          [conversationId, '\u0000'],
          [conversationId, '\uffff']
        )
      );

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveEncryptionState(
    state: EncryptionState,
    wasFirstAttempt: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['encryption_states', 'latest_states'],
        'readwrite'
      );

      // Always save to history
      const stateStore = transaction.objectStore('encryption_states');
      stateStore.put(state);

      // Only update latest state if this was the first successful attempt
      if (wasFirstAttempt) {
        const latestStore = transaction.objectStore('latest_states');
        latestStore.put(state);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteEncryptionState(state: EncryptionState): Promise<void> {
    if (!state) return;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['encryption_states'],
        'readwrite'
      );

      const stateStore = transaction.objectStore('encryption_states');
      stateStore.delete([state.conversationId, state.inboxId]);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
