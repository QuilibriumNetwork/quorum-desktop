/**
 * Unified Image Processing Configuration (compatibility re-export).
 *
 * The actual config now lives in `sharedConfig.ts` — a pure, platform-agnostic
 * module staged to move into quorum-shared. This file is kept as a thin
 * re-export so existing importers (`./config`) continue to work unchanged.
 */

export {
  FILE_SIZE_LIMITS,
  IMAGE_CONFIGS,
  getImageConfig,
} from './sharedConfig';

export type { ImageConfig, ImageConfigType } from './sharedConfig';
