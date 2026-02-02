import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from './image.js';

/**
 * Creates a test image buffer with specified dimensions.
 */
async function createTestImage(
  width: number,
  height: number,
  format: 'png' | 'jpeg' = 'png'
): Promise<Buffer> {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  });

  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

describe('optimizeImage', () => {
  it('should return a base64 encoded string', async () => {
    const testBuffer = await createTestImage(100, 100);
    const result = await optimizeImage(testBuffer);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce valid base64 that can be decoded', async () => {
    const testBuffer = await createTestImage(100, 100);
    const result = await optimizeImage(testBuffer);

    // Should not throw when decoding
    const decoded = Buffer.from(result, 'base64');
    expect(decoded.length).toBeGreaterThan(0);
  });

  it('should output JPEG format', async () => {
    const testBuffer = await createTestImage(100, 100);
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.format).toBe('jpeg');
  });

  it('should not resize images smaller than 1024px', async () => {
    const testBuffer = await createTestImage(500, 300);
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(300);
  });

  it('should resize images larger than 1024px (landscape)', async () => {
    const testBuffer = await createTestImage(2000, 1000);
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(512); // Maintains aspect ratio
  });

  it('should resize images larger than 1024px (portrait)', async () => {
    const testBuffer = await createTestImage(1000, 2000);
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.width).toBe(512); // Maintains aspect ratio
    expect(metadata.height).toBe(1024);
  });

  it('should resize square images larger than 1024px', async () => {
    const testBuffer = await createTestImage(2048, 2048);
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
  });

  it('should handle PNG input', async () => {
    const testBuffer = await createTestImage(200, 200, 'png');
    const result = await optimizeImage(testBuffer);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle JPEG input', async () => {
    const testBuffer = await createTestImage(200, 200, 'jpeg');
    const result = await optimizeImage(testBuffer);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should compress the image (output smaller than raw)', async () => {
    // Create a large uncompressed image
    const testBuffer = await createTestImage(1000, 1000, 'png');
    const result = await optimizeImage(testBuffer);
    const decoded = Buffer.from(result, 'base64');

    // JPEG compression should result in smaller file than PNG
    expect(decoded.length).toBeLessThan(testBuffer.length);
  });
});
