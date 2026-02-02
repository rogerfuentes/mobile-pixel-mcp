import { execa } from 'execa';
import { DeviceDriver } from '../core/driver.js';
import {
  DeviceConnectionError,
  DeviceActionError,
  ToolNotAvailableError,
} from '../core/errors.js';

export class IOSDriver implements DeviceDriver {
  private hasIdb = false;

  private density = 1;

  private constructor(private readonly udid?: string) {}

  /**
   * Creates an IOSDriver instance.
   * Checks for IDB availability but allows partial functionality via xcrun if missing.
   * @param udid Optional device UDID for multi-device scenarios (idb --udid <udid>)
   */
  static async create(udid?: string): Promise<IOSDriver> {
    const driver = new IOSDriver();
    let detectedUdid = udid;
    
    // Check IDB (Soft check)
    try {
      await driver.checkIdbAvailability();
      driver.hasIdb = true;
      
      // If we have IDB, try to get info to populate density
      if (!detectedUdid) {
          detectedUdid = await driver.detectDevice();
      }
      
      if (detectedUdid) {
         try {
             // Fetch density
             // Use execa directly as driver.udid isn't set yet (it's null on temp instance)
             const { stdout } = await execa('idb', ['describe', '--udid', detectedUdid, '--json']);
             const info = JSON.parse(stdout);
             if (info.screen_dimensions && info.screen_dimensions.density) {
                 driver.density = info.screen_dimensions.density;
                 console.log(`Detected iOS screen density: ${driver.density}`);
             }
         } catch {
             console.warn('Could not detect screen density. Defaulting to 1 (pixels).');
         }
      }

    } catch {
      console.warn('IDB not available. Tap/Swipe/Input tools will be disabled. Screenshot/Launch will use xcrun.');
      driver.hasIdb = false;
    }

    // Reuse detection logic if not yet detected (fallback path)
    if (!detectedUdid && !driver.hasIdb) {
         detectedUdid = await driver.detectDeviceXcrun();
         console.error(`Auto-detected iOS device (xcrun): ${detectedUdid}`);
    }

    const finalDriver = new IOSDriver(detectedUdid);
    finalDriver.hasIdb = driver.hasIdb;
    finalDriver.density = driver.density;
    return finalDriver;
  }

  private async checkIdbAvailability(): Promise<void> {
    try {
      // idb --version is not reliably supported across versions.
      // listing targets is a safe "ping" to check if the tool is executable.
      await execa('idb', ['list-targets']);
    } catch {
      throw new ToolNotAvailableError('idb', 'ios');
    }
  }

  // Refactor: Split detection
  private async detectDevice(): Promise<string> {
     // ... (Existing IDB implementation)
     const { stdout } = await execa('idb', ['list-targets', '--json']);
      const targets = stdout
        .trim()
        .split('\n')
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(t => t && t.udid);

      const booted = targets.filter((t: { state: string }) => t.state === 'Booted');
      if (booted.length === 1) return booted[0].udid;
      if (booted.length > 1) throw new DeviceConnectionError(`Multiple booted devices found.`, 'ios');
      if (booted.length === 0) throw new DeviceConnectionError('No booted iOS devices found.', 'ios');
      return booted[0].udid;
  }

  private async detectDeviceXcrun(): Promise<string> {
      // xcrun simctl list devices --json
      const { stdout } = await execa('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
      const data = JSON.parse(stdout);
      // Data structure: { devices: { "com.apple.coresimulator.simruntime.ios-17-0": [ ... ] } }
      const devices = Object.values(data.devices).flat() as { state: string; udid: string }[];
      const booted = devices.filter((d: { state: string }) => d.state === 'Booted');
      
      if (booted.length === 1) return booted[0].udid;
      if (booted.length > 1) throw new DeviceConnectionError(`Multiple booted devices found (xcrun).`, 'ios');
      if (booted.length === 0) throw new DeviceConnectionError('No booted iOS devices found (xcrun).', 'ios');
      return booted[0].udid;
  }

  private async validateDevice(udid: string): Promise<void> {
    try {
      const { stdout } = await execa('idb', ['list-targets']);
      if (!stdout.includes(udid)) {
        throw new DeviceConnectionError(`Device ${udid} not found via IDB.`, 'ios', udid);
      }
    } catch (error) {
      if (error instanceof DeviceConnectionError) throw error;
      throw new DeviceConnectionError('Failed to list iOS devices', 'ios', udid);
    }
  }

  private getIdbArgs(args: string[]): string[] {
    // idb syntax: idb <command> [--udid <udid>] [args...]
    // The --udid flag must come AFTER the subcommand
    if (this.udid && args.length > 0) {
      const [command, ...rest] = args;
      return [command, '--udid', this.udid, ...rest];
    }
    return args;
  }

  async getScreenshot(): Promise<Buffer> {
    try {
      if (this.hasIdb) {
          const { stdout } = await execa(
            'idb',
            this.getIdbArgs(['screenshot', '-']),
            { encoding: 'buffer', stripFinalNewline: false }
          );
          return Buffer.from(stdout);
      } else {
          // Fallback to xcrun
          const target = this.udid || 'booted';
          const { stdout } = await execa(
              'xcrun',
              ['simctl', 'io', target, 'screenshot', '-'],
              { encoding: 'buffer', stripFinalNewline: false }
          );
          return Buffer.from(stdout);
      }
    } catch (error) {
      throw new DeviceActionError(
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`,
        'screenshot',
        error instanceof Error ? error : undefined
      );
    }
  }



  async tap(x: number, y: number): Promise<void> {
    if (!this.hasIdb) throw new ToolNotAvailableError('idb', 'ios');
    try {
      const pointX = Math.round(x / this.density);
      const pointY = Math.round(y / this.density);
      
      await execa(
        'idb',
        this.getIdbArgs(['ui', 'tap', pointX.toString(), pointY.toString()])
      );
    } catch (error) {
       throw new DeviceActionError('Failed to tap', 'tap', error instanceof Error ? error : undefined);
    }
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, durationMs = 1000): Promise<void> {
    if (!this.hasIdb) throw new ToolNotAvailableError('idb', 'ios');
    try {
      const durationSeconds = durationMs / 1000;
      const pX1 = Math.round(x1 / this.density);
      const pY1 = Math.round(y1 / this.density);
      const pX2 = Math.round(x2 / this.density);
      const pY2 = Math.round(y2 / this.density);
      
      await execa(
        'idb',
        this.getIdbArgs([
          'ui', 'swipe', 
          pX1.toString(), pY1.toString(), pX2.toString(), pY2.toString(), 
          '--duration', durationSeconds.toString()
        ])
      );
    } catch (error) {
       throw new DeviceActionError('Failed to swipe', 'swipe', error instanceof Error ? error : undefined);
    }
  }
  
  async inputText(text: string): Promise<void> {
    if (!this.hasIdb) throw new ToolNotAvailableError('idb', 'ios');
    try {
      await execa('idb', this.getIdbArgs(['ui', 'text', text]));
    } catch (error) {
       throw new DeviceActionError('Failed to input text', 'input', error instanceof Error ? error : undefined);
    }
  }

  async home(): Promise<void> {
    // Try xcrun first as it is reliable for home
    try {
        const target = this.udid || 'booted';
        await execa('xcrun', ['simctl', 'ui', target, 'button', 'home']);
        return;
    } catch {}

    if (this.hasIdb) {
        try {
          await execa('idb', this.getIdbArgs(['ui', 'button', 'HOME']));
          return;
        } catch (error) {
          throw new DeviceActionError('Failed to press home button', 'home', error instanceof Error ? error : undefined);
        }
    }
    throw new ToolNotAvailableError('idb', 'ios');
  }

  async isAppRunning(appId: string): Promise<boolean> {
     try {
        const target = this.udid || 'booted';
        // ps aux shows host processes? Simulator processes are visible on host.
        // Better: simctl spawn booted ps aux
        const { stdout } = await execa('xcrun', ['simctl', 'spawn', target, 'ps', 'aux']);
        return stdout.includes(appId);
    } catch {
        return false;
    }
  }

  async launchApp(appId: string): Promise<void> {
     try {
       const target = this.udid || 'booted';
       await execa('xcrun', ['simctl', 'launch', target, appId]);
     } catch (error) {
        throw new DeviceActionError(`Failed to launch app ${appId}`, 'launch_app', error instanceof Error ? error : undefined);
     }
  }

  async getAppLogs(tag = '[SNAP_BRIDGE]'): Promise<string[]> {
    try {
      const target = this.udid || 'booted';
      // Use log show with predicate. 
      const predicate = `message contains "${tag}"`;
      
      const { stdout } = await execa(
        'xcrun',
        ['simctl', 'spawn', target, 'log', 'show', '--last', '5m', '--predicate', predicate, '--style', 'compact']
      );

      return stdout.split('\n').filter(line => line.trim().length > 0);
    } catch {
       return [];
    }
  }

  async installApp(path: string): Promise<void> {
    try {
      if (this.hasIdb) {
          await execa('idb', this.getIdbArgs(['install', path]));
      } else {
        const target = this.udid || 'booted';
        await execa('xcrun', ['simctl', 'install', target, path]);
      }
    } catch (error) {
       throw new DeviceActionError(
        `Failed to install app from ${path}`,
        'install_app' as any,
        error instanceof Error ? error : undefined
      );
    }
  }

  async uninstallApp(appId: string): Promise<void> {
    try {
      if (this.hasIdb) {
         await execa('idb', this.getIdbArgs(['uninstall', appId]));
      } else {
         const target = this.udid || 'booted';
         await execa('xcrun', ['simctl', 'uninstall', target, appId]);
      }
    } catch (error) {
      throw new DeviceActionError(
        `Failed to uninstall app ${appId}`,
        'uninstall_app' as any,
        error instanceof Error ? error : undefined
      );
    }
  }

  async resetApp(appId: string): Promise<void> {
    try {
       const target = this.udid || 'booted';
       // Terminate first
       try { await execa('xcrun', ['simctl', 'terminate', target, appId]); } catch {}

       // Get Data Container
       const { stdout: containerPath } = await execa('xcrun', ['simctl', 'get_app_container', target, appId, 'data']);
       if (!containerPath || containerPath.trim() === '') {
           throw new Error(`Could not find data container for ${appId}`);
       }
       
       // Clear content using rm -rf
       await execa('rm', ['-rf', ...[`${containerPath.trim()}/*`]], { shell: true });
       
    } catch (error) {
      throw new DeviceActionError(
        `Failed to reset app ${appId}`,
        'reset_app' as any,
        error instanceof Error ? error : undefined
      );
    }
  }
}
