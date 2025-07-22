import { channel } from '@quilibrium/quilibrium-js-sdk-channels';

export class SpaceMembersDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async saveSpaceMember(
    spaceId: string,
    userProfile: channel.UserProfile & { inbox_address: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_members', 'readwrite');
      const store = transaction.objectStore('space_members');
      store.put({ ...userProfile, spaceId });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<channel.UserProfile & { inbox_address: string }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_members', 'readonly');
      const store = transaction.objectStore('space_members');

      const request = store.get([spaceId, user_address]);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSpaceMembers(
    spaceId: string
  ): Promise<(channel.UserProfile & { inbox_address: string })[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_members', 'readonly');
      const store = transaction.objectStore('space_members');

      const range = IDBKeyRange.bound([spaceId, '\u0000'], [spaceId, '\uffff']);

      const request = store.getAll(range);

      request.onsuccess = () => {
        const members = request.result;
        resolve(members);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSpaceMember(
    spaceId: string,
    user_address: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('space_members', 'readwrite');
      const store = transaction.objectStore('space_members');

      const request = store.delete([spaceId, user_address]);

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}
