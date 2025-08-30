import { UserConfig } from '../src/db/messages';

export enum DefaultImages {
  UNKNOWN_USER = '/unknown.png',
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

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0);

