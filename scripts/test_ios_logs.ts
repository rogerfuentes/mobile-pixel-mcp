import { IOSDriver } from '../src/drivers/ios.js';
import { execa } from 'execa';

async function testLogs() {
  console.log('1. Initializing iOS Driver...');
  const driver = await IOSDriver.create(); 
  
  // 2. Define a tag we expect to find in system logs
  // "com.apple" is ubiquitous in iOS system logs (subsystems, xpc, etc)
  const TAG = 'com.apple'; 
  
  console.log(`2. Fetching logs containing "${TAG}" (last 1m)...`);

  // 3. Fetch logs
  const logs = await driver.getAppLogs(TAG);
  
  console.log(`--- Retrieved ${logs.length} Logs ---`);
  if (logs.length > 0) {
      console.log('Sample (first 3):');
      logs.slice(0, 3).forEach(l => console.log(` - ${l.substring(0, 100)}...`));
  } else {
      console.log('(No logs found)');
  }

  // 6. Verify
  if (logs.length > 0) {
    console.log('✅ SUCCESS: Retrieved system logs successfully!');
  } else {
    console.error('❌ FAILURE: Did not find any logs. (Is the simulator booted?)');
  }
}

testLogs().catch(console.error);
