export type SpaceKey = {
  address?: string;
  spaceId: string;
  keyId: string;
  publicKey: string;
  privateKey: string;
};

export class SpaceKeysDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getSpaceKey(
    spaceId: string,
    keyId: string
  ): Promise<SpaceKey> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_keys', 'readonly');
      const store = transaction.objectStore('space_keys');
      const request = store.get([spaceId, keyId]);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSpaceKeys(spaceId: string): Promise<SpaceKey[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_keys', 'readonly');
      const store = transaction.objectStore('space_keys');

      const range = IDBKeyRange.bound([spaceId, '\u0000'], [spaceId, '\uffff']);

      const request = store.getAll(range);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSpaceKey(key: SpaceKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['space_keys'], 'readwrite');

      const stateStore = transaction.objectStore('space_keys');
      stateStore.put(key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteSpaceKey(spaceId: string, keyId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['space_keys'], 'readwrite');

      const stateStore = transaction.objectStore('space_keys');
      stateStore.delete([spaceId, keyId]);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
