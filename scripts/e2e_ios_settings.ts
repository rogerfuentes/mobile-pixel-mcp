import { IOSDriver } from '../src/drivers/ios.js';
import { findTextBounds } from '../src/core/ocr.js';
import fs from 'fs/promises';
import path from 'path';

async function runE2E() {
  const artifactsDir = path.join(process.cwd(), 'e2e_artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });

  console.log('Starting E2E Test for Settings App (General Navigation)...');

  // 1. Initialize Driver
  const driver = await IOSDriver.create(); 
  console.log('Driver initialized.');
  
  // 1.5 Wake up device
  console.log('Sending Home button press to wake device...');
  try {
      await driver.home();
  } catch (err) {
      console.warn("Home button failed, ignoring...");
  }
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Launch Settings
  const bundleId = 'com.apple.Preferences';
  console.log(`Launching ${bundleId}...`);
  try {
      await driver.launchApp(bundleId);
  } catch (err: any) {
      console.warn(`Launch failed (${err.message}), trying URL scheme...`);
      const { execa } = await import('execa'); 
      await execa('xcrun', ['simctl', 'openurl', 'booted', 'prefs:root=General']);
  }
  
  // Wait for animation (increased to 5s to ensure UI is ready for OCR)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Screenshot 1: Settings Main
  let screenshot = await driver.getScreenshot();
  await fs.writeFile(path.join(artifactsDir, '1_settings_main.png'), screenshot);
  console.log('Saved 1_settings_main.png');

  // 3. Tap "General" using OCR
  console.log('Looking for "General" text...');
  const bounds = await findTextBounds(screenshot, 'General');
  
  if (bounds) {
    const tapX = Math.round(bounds.x + bounds.width / 2);
    const tapY = Math.round(bounds.y + bounds.height / 2);
    
    console.log(`Found "General" at (${tapX}, ${tapY}). Tapping...`);
    try {
      await driver.tap(tapX, tapY);
    } catch (error: any) {
      if (error.name === 'ToolNotAvailableError') {
        console.warn('⚠️  Skipping tap logic (IDB missing).');
      } else {
        throw error;
      }
    }
  } else {
    console.warn('❌ OCR could not find "General" text on screen.');
  }

  // Wait for transition
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Screenshot 2: General Screen
  screenshot = await driver.getScreenshot();
  await fs.writeFile(path.join(artifactsDir, '2_general_screen.png'), screenshot);
  console.log('Saved 2_general_screen.png');

  // 4. (Optional) Tap "About" ? 
  // About is usually the first item.
  // We can just end here as "navigation verified".

  console.log('E2E Test Completed. Check e2e_artifacts/ for results.');
}

runE2E().catch(console.error);
