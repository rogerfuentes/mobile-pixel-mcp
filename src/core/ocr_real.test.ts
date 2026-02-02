import { describe, it, expect } from 'vitest';
import { findTextBounds } from './ocr.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('OCR Real World Integration', () => {
    it('should find "General" text in settings screenshot', async () => {
        const imagePath = join(__dirname, '__fixtures__', 'settings.png');
        const imageBuffer = await readFile(imagePath);
        
        console.log(`Testing OCR on: ${imagePath} (${imageBuffer.length} bytes)`);

        const bounds = await findTextBounds(imageBuffer, 'General');
        
        console.log('Found bounds:', bounds);

        expect(bounds).not.toBeNull();
        if (bounds) {
            // "AXLabel": "General", "frame": {"y":380.33, "x":16, "width":370, "height":52}
            // Allow some fuzziness in pixels (OCR might find just the word "General" which is smaller than the full cell width)
            expect(bounds.x).toBeGreaterThan(0); 
            expect(bounds.y).toBeGreaterThan(0);
            expect(bounds.width).toBeGreaterThan(0);
            expect(bounds.height).toBeGreaterThan(0);
        }
    });

    it('should find "Search" text', async () => {
        const imagePath = join(__dirname, '__fixtures__', 'settings.png');
        const imageBuffer = await readFile(imagePath);
        
        const bounds = await findTextBounds(imageBuffer, 'Search');
        console.log('Search bounds:', bounds);
        expect(bounds).not.toBeNull();
    });
});
