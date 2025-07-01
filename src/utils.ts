import { UserConfig } from "../src/db/messages";

export enum DefaultImages {
  UNKNOWN_USER = '/unknown.png'
}

export const getDefaultUserConfig = (address: string): UserConfig => {
  return {
    address: address,
    allowSync: false,
    nonRepudiable: true,
    spaceKeys: [],
    spaceIds: [],
    timestamp: Date.now(),
  };
};