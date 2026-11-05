import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';

export interface ProcessedImage {
  large: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

/**
 * Normalises uploads into two WebP renditions: a large one for the gallery and a
 * cropped thumbnail for listing cards. Strips EXIF (incl. GPS) and applies orientation.
 */
@Injectable()
export class ImageProcessor {
  async process(input: Buffer): Promise<ProcessedImage> {
    // limitInputPixels guards against decompression bombs.
    const source = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();

    let meta: Metadata;
    try {
      meta = await source.metadata();
    } catch {
      throw new BadRequestException('File is not a supported image');
    }
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
      throw new BadRequestException('Supported image formats: JPEG, PNG, WebP, AVIF');
    }
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = (rotated ? meta.height : meta.width) ?? 0;
    const height = (rotated ? meta.width : meta.height) ?? 0;
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      throw new BadRequestException(`Images must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px`);
    }

    try {
      const [large, thumb] = await Promise.all([
        source
          .clone()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true }),
        source
          .clone()
          .resize({ width: 480, height: 360, fit: 'cover', position: 'centre' })
          .webp({ quality: 70 })
          .toBuffer(),
      ]);
      return { large: large.data, thumb, width: large.info.width, height: large.info.height };
    } catch {
      // e.g. HEIC/HEVC files that the bundled libvips cannot decode.
      throw new BadRequestException('Could not process image; please upload a JPEG, PNG or WebP');
    }
  }
}
