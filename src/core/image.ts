import sharp from 'sharp';

/**
 * Optimizes an image buffer for transmission.
 * Resizes to max 1024x1024 (inside), converts to JPEG (quality 80),
 * and returns as a base64 string.
 * 
 * @param buffer The input image buffer.
 * @returns A Promise resolving to the base64 encoded string of the optimized image.
 */
export async function optimizeImage(buffer: Buffer): Promise<string> {
  const optimizedBuffer = await sharp(buffer)
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  return optimizedBuffer.toString('base64');
}
