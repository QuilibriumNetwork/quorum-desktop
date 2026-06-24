/**
 * Image-processing configuration — re-exported from quorum-shared.
 *
 * The canonical config now lives in `@quilibrium/quorum-shared`
 * (`src/utils/imageConfig.ts`) so desktop and mobile stay consistent. This file
 * is kept as the desktop-local import point (`./sharedConfig`) and simply
 * re-exports the shared symbols.
 */

export {
  FILE_SIZE_LIMITS,
  IMAGE_CONFIGS,
  getImageConfig,
} from '@quilibrium/quorum-shared';

export type {
  ImageConfig,
  ImageConfigType,
  ImageProcessingOptions,
} from '@quilibrium/quorum-shared';
