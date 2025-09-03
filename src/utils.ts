import { UserConfig } from '../src/db/messages';

export enum DefaultImages {
  UNKNOWN_USER = '/unknown.png',
}

export const getDefaultUserConfig = (address: string): UserConfig => {
  return {
    address: address,
    allowSync: false,
    nonRepudiable: true,
    name: '',
    profile_image: DefaultImages.UNKNOWN_USER,
    spaceKeys: [],
    spaceIds: [],
    timestamp: Date.now(),
  };
};

export const truncateAddress = (
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};
