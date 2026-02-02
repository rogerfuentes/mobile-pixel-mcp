import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

/**
 * Finds the bounding box of a specific text within an image buffer using OCR.
 * 
 * @param imageBuffer The raw image buffer (PNG/JPEG)
 * @param searchText The text to search for (case-insensitive fuzzy match)
 * @returns Bounding box { x, y, width, height } or null if not found
 */
export async function findTextBounds(
  imageBuffer: Buffer,
  searchText: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const worker = await createWorker('eng', 1, {
    // logger: m => console.log(m)
  });

  try {
    const metadata = await sharp(imageBuffer).metadata();
    const height = metadata.height || 0;
    const width = metadata.width || 0;
    
    const bottomCropTop = Math.floor(height * 0.6); 
    const bottomCropHeight = height - bottomCropTop;
    
    // Dynamic scaling to ensure correct coordinate mapping
    const targetWidth = 2000;
    const scaleFactor = width > 0 ? (targetWidth / width) : 2;

    type Variant = {
      name: string;
      scale?: number;
      offsetY?: number;
      process: (s: sharp.Sharp) => sharp.Sharp;
    };

    const variants: Variant[] = [
      // 1. Thresholded (Fast, Standard)
      { name: 'threshold', process: (s) => s.removeAlpha().grayscale().threshold(128) },
      // 2. Inverted Thresholded (Fast, Dark Mode Full Screen)
      { name: 'inverted_threshold', process: (s) => s.removeAlpha().grayscale().negate().threshold(128) },
      
      // 3. Inverted Bottom Crop (Footer Buttons)
      {   
          name: 'inverted_bottom_crop', 
          scale: scaleFactor, 
          offsetY: bottomCropTop,
          process: (s) => s
            .extract({ left: 0, top: bottomCropTop, width: width, height: bottomCropHeight })
            .resize({ width: targetWidth })
            .removeAlpha()
            .grayscale()
            .negate()
      },

      // 4. Inverted Top Crop (Header Buttons)
      {   
          name: 'inverted_top_crop', 
          scale: scaleFactor, 
          offsetY: 0,
          process: (s) => s
            .extract({ left: 0, top: 0, width: width, height: Math.floor(height * 0.4) }) 
            .resize({ width: targetWidth })
            .removeAlpha()
            .grayscale()
            .negate()
      },
    ];

    const matches: Array<{ x: number, y: number, width: number, height: number, text: string, variant: string }> = [];

    for (const variant of variants) {
      const processedBuffer = await variant.process(sharp(imageBuffer)).toBuffer();
      const result = await worker.recognize(processedBuffer);

      const lowerSearchText = searchText.toLowerCase().trim();
      const data = result.data as any;
      const blocks = data.blocks || [];

      for (const block of blocks) {
        if (!block.paragraphs) continue;
        for (const paragraph of block.paragraphs) {
          if (!paragraph.lines) continue;
          for (const line of paragraph.lines) {
             const lowerLine = line.text.toLowerCase().replace(/\s+/g, ' ');
             const cleanSearch = lowerSearchText.replace(/\s+/g, ' ');

             if (lowerLine.includes(cleanSearch)) {
                const { x0, y0, x1, y1 } = line.bbox;
                const scale = variant.scale || 1;
                const offsetY = variant.offsetY || 0;
                
                matches.push({
                    x: Math.round(x0 / scale), 
                    y: Math.round(y0 / scale) + offsetY,
                    width: Math.round((x1 - x0) / scale), 
                    height: Math.round((y1 - y0) / scale),
                    text: lowerLine,
                    variant: variant.name
                });
             }
          }
        }
      }
    }

    // Heuristics to pick the "Best" match
    if (matches.length > 0) {
        // Sort matches by:
        // 1. Exactness of text (length difference)
        // 2. Y-coordinate (Prefer Bottom-most for footer buttons, Top-most for headers?)
        //    Since "Home buyer" is notoriously a footer button, biasing towards Higher Y (Bottom) is safer contextually
        //    where "Agent" might be above it.
        
        matches.sort((a, b) => {
             const diffA = Math.abs(a.text.length - searchText.length);
             const diffB = Math.abs(b.text.length - searchText.length);
             if (diffA !== diffB) return diffA - diffB; // Shortest match first
             return b.y - a.y; // Bottom-most first
        });
        
        return matches[0];
    }

    return null;
  } finally {
    await worker.terminate();
  }
}
