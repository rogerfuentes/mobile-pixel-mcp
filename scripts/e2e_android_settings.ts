import { AndroidDriver } from '../src/drivers/android.js';
import { findTextBounds } from '../src/core/ocr.js';
import fs from 'fs/promises';
import path from 'path';

async function runE2E() {
  const artifactsDir = path.join(process.cwd(), 'e2e_artifacts_android');
  await fs.mkdir(artifactsDir, { recursive: true });

  console.log('Starting E2E Test for Android Settings App ("Apps" Navigation)...');

  // 1. Initialize Driver
  // Assumes an emulator is running or device connected
  const driver = await AndroidDriver.create(); 
  console.log('Driver initialized.');
  
  // 1.5 Wake up / Home
  console.log('Going Home...');
  await driver.home();
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. Launch Settings
  const packageId = 'com.android.settings';
  console.log(`Launching ${packageId}...`);
  try {
      await driver.launchApp(packageId);
  } catch (err: any) {
      console.error(`Launch failed: ${err.message}`);
      process.exit(1);
  }
  
  // Wait for app launch animation
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Screenshot 1: Settings Main
  let screenshot = await driver.getScreenshot();
  await fs.writeFile(path.join(artifactsDir, '1_android_settings_main.png'), screenshot);
  console.log('Saved 1_android_settings_main.png');

  // 3. Tap "Apps" using OCR
  console.log('Looking for "Apps" text...');
  const bounds = await findTextBounds(screenshot, 'Apps');
  
  if (bounds) {
    const tapX = Math.round(bounds.x + bounds.width / 2);
    const tapY = Math.round(bounds.y + bounds.height / 2);
    
    console.log(`Found "Apps" at (${tapX}, ${tapY}). Tapping...`);
    try {
      await driver.tap(tapX, tapY);
    } catch (error: any) {
        console.error("Tap failed:", error);
    }
  } else {
    console.warn('❌ OCR could not find "Apps" text on screen.');
    // Check if maybe "App & notifications" or similar (Android versions vary)
    // trying fallback
    console.log('Trying fallback search "App"...'); 
    const fallbackBounds = await findTextBounds(screenshot, 'App');
    if (fallbackBounds) {
        const tapX = Math.round(fallbackBounds.x + fallbackBounds.width / 2);
        const tapY = Math.round(fallbackBounds.y + fallbackBounds.height / 2);
        console.log(`Found "App" (fallback) at (${tapX}, ${tapY}). Tapping...`);
        await driver.tap(tapX, tapY);
    }
  }

  // Wait for transition
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Screenshot 2: Apps Screen
  screenshot = await driver.getScreenshot();
  await fs.writeFile(path.join(artifactsDir, '2_android_apps_screen.png'), screenshot);
  console.log('Saved 2_android_apps_screen.png');

  console.log('E2E Test Completed. Check e2e_artifacts_android/ for results.');
}

runE2E().catch(console.error);
