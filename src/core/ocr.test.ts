import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findTextBounds } from './ocr.js';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Mock dependencies
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));

vi.mock('sharp', () => {
    const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('processed'));
    const mockThreshold = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockGrayscale = vi.fn().mockReturnValue({ threshold: mockThreshold });
    const sharpFn = vi.fn().mockReturnValue({ grayscale: mockGrayscale });
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
    // Setup Tesseract result
    mockWorker.recognize.mockResolvedValue({
      data: {
        words: [
          { text: 'Hello', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
          { text: 'World', bbox: { x0: 60, y0: 10, x1: 100, y1: 30 } },
        ],
      },
    });

    const buffer = Buffer.from('fake-image');
    const result = await findTextBounds(buffer, 'world');

    // Verify Sharp chain
    expect(sharp).toHaveBeenCalledWith(buffer);
    // Note: can't easily verify chain strictly without better mocks, but the fact it ran without error suggests chain worked.
    
    // Verify Worker usage
    expect(createWorker).toHaveBeenCalledWith('eng');
    expect(mockWorker.recognize).toHaveBeenCalledWith(Buffer.from('processed'));
    expect(mockWorker.terminate).toHaveBeenCalled();

    // Verify Result logic
    expect(result).toEqual({ x: 60, y: 10, width: 40, height: 20 });
  });

  it('should return null if text not found', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        words: [
          { text: 'Hello', bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
        ],
      },
    });

    const result = await findTextBounds(Buffer.from('img'), 'Moon');
    expect(result).toBeNull();
  });
});
