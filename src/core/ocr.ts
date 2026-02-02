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
  // 1. Pre-process image: Grayscale + Threshold
  // This enhances contrast for better OCR accuracy, especially on UI elements.
  const sharpInstance = sharp(imageBuffer)
    .grayscale()
    .threshold(128);
    
  // Try negating if dark mode? 
  // .negate() 
    
  const processedBuffer = await sharpInstance.toBuffer();
  
  // DEBUG: Save image
  const { writeFile } = await import('node:fs/promises');
  await writeFile('debug_ocr_processed.png', processedBuffer);

  // 2. Initialize Tesseract Worker
  const worker = await createWorker('eng', 1, {
    // logger: m => console.log(m)
  });
  
  try {
    // 3. Perform OCR
    const result = await worker.recognize(processedBuffer);
    
    // 4. Search for text in results
    const lowerSearchText = searchText.toLowerCase();
    
    // Iterate through blocks -> paragraphs -> lines -> words
    const data = result.data as any; // Tesseract v5 structure
    const blocks = data.blocks || [];
    
    // Debug
    // console.log("Keys:", Object.keys(data));
    // console.log("Blocks:", blocks.length);
    
    for (const block of blocks) {
      if (!block.paragraphs) continue;
      for (const paragraph of block.paragraphs) {
        if (!paragraph.lines) continue;
        for (const line of paragraph.lines) {
          if (!line.words) continue;
          for (const word of line.words) {
             const lowerWord = word.text.toLowerCase().replace(/[.,!?;:]/g, ''); // Clean punctuation
             
             // Check strict inclusion or exact match?
             // Simple includes is safer for "General" vs "General,"
             if (lowerWord.includes(lowerSearchText)) {
                // console.log(`MATCH FOUND! Word: "${word.text}" matches "${lowerSearchText}"`);
                const { x0, y0, x1, y1 } = word.bbox;
                return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
             }
          }
        }
      }
    }
    
    return null;
  } finally {
    // 5. Cleanup
    await worker.terminate();
  }
}
