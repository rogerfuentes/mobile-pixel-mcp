import { AndroidDriver } from '../src/drivers/android.js';
import { execa } from 'execa';

async function testLogs() {
  console.log('1. Initializing Android Driver...');
  let driver;
  try {
      driver = await AndroidDriver.create(); 
  } catch (e) {
      console.error('❌ Failed to initialize Android Driver. Is an emulator running?');
      console.error(e);
      process.exit(1);
  }
  
  // 2. Define a unique test message and tag
  const TAG = 'SNAP_BRIDGE'; // Logcat tags usually don't have brackets in the command
  const UNIQUE_ID = Date.now().toString();
  const MESSAGE = `Test Log Entry ${UNIQUE_ID}`;
  
  // 3. Inject log using `log` command on device
  console.log(`2. Injecting log: -t "${TAG}" -m "${MESSAGE}"...`);
  
  try {
      // adb shell log -t <TAG> <MESSAGE>
      await execa('adb', ['shell', 'log', '-t', TAG, MESSAGE]);
  } catch (e) {
      console.error("Failed to inject log:", e);
      return;
  }

  // 4. Wait a moment
  console.log('3. Waiting 1s...');
  await new Promise(r => setTimeout(r, 1000));

  // 5. Fetch logs
  console.log('4. Fetching logs...');
  const logs = await driver.getAppLogs(TAG);
  
  console.log(`--- Retrieved ${logs.length} Logs ---`);
  if (logs.length > 0) {
      console.log('Sample:');
      logs.forEach(l => console.log(` - ${l.trim()}`));
  }

  // 6. Verify
  const found = logs.some(line => line.includes(MESSAGE));
  if (found) {
    console.log('✅ SUCCESS: Found injected test log!');
  } else {
    // Fallback: Check if we can see *any* logs (search for ActivityManager)
     console.warn('⚠️  Did not find injected log. Checking for system logs (ActivityManager)...');
     const sysLogs = await driver.getAppLogs('ActivityManager');
     if (sysLogs.length > 0) {
         console.log(`✅ PARTIAL SUCCESS: System logs retrieved (${sysLogs.length} lines), but injection failed.`);
     } else {
         console.error('❌ FAILURE: Could not retrieve any logs.');
     }
  }
}

testLogs().catch(console.error);
