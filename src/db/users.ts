import { channel } from '@quilibrium/quilibrium-js-sdk-channels';

export type UserConfig = {
  address: string;
  spaceIds: string[];
  timestamp?: number;
  nonRepudiable?: boolean;
  allowSync?: boolean;
  spaceKeys?: {
    spaceId: string;
    encryptionState: {
      conversationId: string;
      inboxId: string;
      state: string;
      timestamp: number;
    };
    keys: {
      keyId: string;
      address?: string;
      publicKey: string;
      privateKey: string;
      spaceId: string;
    }[];
  }[];
};

export class UsersDB {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getUser({
    address,
  }: {
    address: string;
  }): Promise<{ userProfile: channel.UserProfile }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('user_info', 'readonly');
      const store = transaction.objectStore('user_info');

      const request = store.get(address);

      request.onsuccess = () => {
        const userProfile = request.result;
        resolve({ userProfile });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUserConfig({ address }: { address: string }): Promise<UserConfig> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('user_config', 'readonly');
      const store = transaction.objectStore('user_config');

      const request = store.get(address);

      request.onsuccess = () => {
        const userConfig = request.result;
        resolve(userConfig);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserProfile(userProfile: channel.UserProfile): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('user_info', 'readwrite');
      const store = transaction.objectStore('user_info');
      const request = store.put(userProfile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserConfig(userConfig: UserConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('user_config', 'readwrite');
      const store = transaction.objectStore('user_config');
      const request = store.put(userConfig);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
