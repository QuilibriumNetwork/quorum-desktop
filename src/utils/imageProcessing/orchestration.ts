/**
 * Image-processing orchestration — re-exported from quorum-shared.
 *
 * The platform-agnostic orchestration now lives in `@quilibrium/quorum-shared`
 * (`src/utils/imageOrchestration.ts`). Desktop injects its compressorjs adapter
 * (see unifiedProcessor.ts) into these shared functions. This file is the
 * desktop-local import point (`./orchestration`).
 */

export {
  ImageProcessingError,
  processImageWithConfig,
  processAttachmentWithConfig,
  shouldGenerateGifThumbnail,
} from '@quilibrium/quorum-shared';

export type {
  ImageErrorCode,
  ImageInput,
  ImagePlatform,
  AttachmentResult,
} from '@quilibrium/quorum-shared';
