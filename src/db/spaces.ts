import { Space } from '../api/quorumApi';

export class SpacesDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getSpaces(): Promise<Space[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('spaces', 'readonly');
      const store = transaction.objectStore('spaces');

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSpace(spaceId: string): Promise<Space | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('spaces', 'readonly');
      const store = transaction.objectStore('spaces');

      const request = store.get(spaceId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSpace(space: Space): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('spaces', 'readwrite');
      const store = transaction.objectStore('spaces');

      const request = store.put(space);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSpace(spaceId: string): Promise<Space | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('spaces', 'readwrite');
      const store = transaction.objectStore('spaces');

      const request = store.delete(spaceId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

}