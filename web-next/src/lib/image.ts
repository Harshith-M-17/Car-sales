const MAX_DIMENSION = 2000;
const PASSTHROUGH_BYTES = 1_500_000;

/**
 * Downscales and re-encodes photos in the browser before upload. Phone photos are
 * often 4–12 MB; this typically sends ~400 KB instead, and converts HEIC (Safari)
 * to JPEG which the server can always decode.
 */
export async function prepareImage(file: File): Promise<Blob> {
  const passthrough =
    ['image/jpeg', 'image/webp'].includes(file.type) && file.size <= PASSTHROUGH_BYTES;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name}: not a supported image`);
  }
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (passthrough && scale === 1) return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', 0.85),
    );
  } finally {
    bitmap.close();
  }
}
