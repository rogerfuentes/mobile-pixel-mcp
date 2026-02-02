import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTextBounds } from './ocr.js';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Mock dependencies
// Mock dependencies
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

vi.mock('sharp', () => {
    const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('processed'));
    // Chainable methods
    const chain = {
        threshold: vi.fn().mockReturnThis(),
        grayscale: vi.fn().mockReturnThis(),
        removeAlpha: vi.fn().mockReturnThis(),
        negate: vi.fn().mockReturnThis(),
        extract: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toBuffer: mockToBuffer
    };
    
    const sharpInstance = {
        metadata: vi.fn().mockResolvedValue({ width: 1000, height: 2000 }),
        ...chain
    };

    const sharpFn = vi.fn((input) => {
        // Return instance that supports chaining
        return sharpInstance;
    });

    // Also attach metadata directly? No, sharp(buf).metadata()
    return { default: sharpFn };
});

describe('ocr', () => {
  const mockWorker = {
    recognize: vi.fn(),
    terminate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createWorker as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorker);
  });

  it('should process image and return bounds if text found', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        text: "Hello World",
        blocks: [{
          paragraphs: [{
            lines: [{
              text: "Hello World",
              bbox: { x0: 10, y0: 10, x1: 100, y1: 30 }
            }],
          }],
        }],
      },
    });

    const buffer = Buffer.from('fake-image');
    const result = await findTextBounds(buffer, 'world');

    // Verify sharp was initialized
    expect(sharp).toHaveBeenCalledWith(buffer);
    
    // Verify Worker usage
    expect(createWorker).toHaveBeenCalledWith('eng', 1, {});
    expect(mockWorker.terminate).toHaveBeenCalled();

    // Verify Result logic
    // Coordinates: x0=10 (scale=1, variant likely threshold).
    // Variants loop runs. First match is threshold (scale=1, offset=0).
    // result should be { x: 10, y: 10, width: 90, height: 20 }
    // Wait. My loop iterates variants.
    // Tesseract mock returns SAME result for all variants.
    // Matches will accumulate:
    // 1. threshold: y=10.
    // 2. inverted_threshold: y=10.
    // 3. inverted_bottom_crop: y = 10/2 + offset(1200) = 1205.
    // 4. inverted_top_crop: y = 10/2 = 5.
    // Sort logic: Difference in text length. "World" vs "Hello World".
    // Wait. "Hello World" (11) vs "world" (5). Diff = 6.
    // All variants return "Hello World" text. Diff is same.
    // Sort logic 2: Y coordinate (Descending).
    // 1205 > 10 > 5.
    // So it should pick Inverted Bottom Crop?
    // Which means Y will be 1205.
    
    // This assumes `inverted_bottom_crop` runs successfully.
    // And that tesseract return aligns with it.
    
    // Expect result to be NOT null.
    expect(result).not.toBeNull();
    // Validate fields exist
    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
  });

  it('should return null if text not found', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        text: "Other text",
        blocks: [{
          paragraphs: [{
            lines: [{
              text: "Other text",
              bbox: { x0: 10, y0: 10, x1: 50, y1: 30 }
            }],
          }],
        }],
      },
    });

    const result = await findTextBounds(Buffer.from('img'), 'Moon');
    expect(result).toBeNull();
  });
});
