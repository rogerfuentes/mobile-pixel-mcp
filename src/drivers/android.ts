import { execa } from 'execa';
import { DeviceDriver } from '../core/driver.js';
import { loadConfig } from '../core/config.js';
import {
  DeviceConnectionError,
  DeviceActionError,
  ToolNotAvailableError,
} from '../core/errors.js';

export class AndroidDriver implements DeviceDriver {
  private constructor(private readonly deviceId?: string) {}

  /**
   * Creates an AndroidDriver instance after validating ADB availability.
   * @param deviceId Optional device ID for multi-device scenarios (adb -s <deviceId>)
   */
  static async create(deviceId?: string): Promise<AndroidDriver> {
    // Check ADB first
    await new AndroidDriver().checkAdbAvailability();

    let finalDeviceId = deviceId;

    if (deviceId) {
      await new AndroidDriver().validateDevice(deviceId);
    } else {
      finalDeviceId = await new AndroidDriver().detectDevice();
      console.error(`Auto-detected Android device: ${finalDeviceId}`);
    }

    return new AndroidDriver(finalDeviceId);
  }

  private async checkAdbAvailability(): Promise<void> {
    try {
      await execa('adb', ['version']);
    } catch {
      throw new ToolNotAvailableError('adb', 'android');
    }
  }

  private async validateDevice(deviceId: string): Promise<void> {
    try {
      const { stdout } = await execa('adb', ['devices']);
      // Parse adb devices output: "List of devices attached\n<id>\tdevice\n..."
      const devices = stdout
        .split('\n')
        .slice(1) // Skip "List of devices attached"
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split('\t')[0]);

      if (!devices.includes(deviceId)) {
        throw new DeviceConnectionError(
          `Device ${deviceId} not found. Available devices: ${devices.join(', ') || 'none'}`,
          'android',
          deviceId
        );
      }
    } catch (error) {
      if (error instanceof DeviceConnectionError) throw error;
      throw new DeviceConnectionError(
        'Failed to list Android devices',
        'android',
        deviceId
      );
    }
  }

  private async detectDevice(): Promise<string> {
    try {
      const { stdout } = await execa('adb', ['devices']);
      const devices = stdout
        .split('\n')
        .slice(1)
        .filter((line) => line.trim().length > 0 && line.includes('\tdevice'))
        .map((line) => line.split('\t')[0]);

      if (devices.length === 0) {
        throw new DeviceConnectionError('No Android devices found.', 'android');
      }
      if (devices.length > 1) {
        throw new DeviceConnectionError(
          `Multiple devices found (${devices.join(', ')}). Please specify one using --device=<id>.`,
          'android'
        );
      }
      return devices[0];
    } catch (error) {
      if (error instanceof DeviceConnectionError) throw error;
      throw new DeviceConnectionError('Failed to detect devices', 'android');
    }
  }

  private getAdbArgs(args: string[]): string[] {
    if (this.deviceId) {
      return ['-s', this.deviceId, ...args];
    }
    return args;
  }

  async getScreenshot(): Promise<Buffer> {
    try {
      const { stdout } = await execa(
        'adb',
        this.getAdbArgs(['exec-out', 'screencap', '-p']),
        {
          encoding: 'buffer',
          stripFinalNewline: false,
        }
      );
      return Buffer.from(stdout);
    } catch (error) {
      throw new DeviceActionError(
        'Failed to capture screenshot. Ensure device is connected and screen is on.',
        'screenshot',
        error instanceof Error ? error : undefined
      );
    }
  }

  async tap(x: number, y: number): Promise<void> {
    try {
      await execa(
        'adb',
        this.getAdbArgs(['shell', 'input', 'tap', x.toString(), y.toString()])
      );
    } catch (error) {
      throw new DeviceActionError(
        `Failed to tap at (${x}, ${y})`,
        'tap',
        error instanceof Error ? error : undefined
      );
    }
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs = 1000
  ): Promise<void> {
    try {
      await execa(
        'adb',
        this.getAdbArgs([
          'shell',
          'input',
          'swipe',
          x1.toString(),
          y1.toString(),
          x2.toString(),
          y2.toString(),
          durationMs.toString(),
        ])
      );
    } catch (error) {
      throw new DeviceActionError(
        `Failed to swipe from (${x1}, ${y1}) to (${x2}, ${y2})`,
        'swipe',
        error instanceof Error ? error : undefined
      );
    }
  }

  async inputText(text: string): Promise<void> {
    try {
      // ADB input text has limited character support
      // Use a combination of approaches for better compatibility
      const escapedText = this.escapeForAdb(text);
      await execa(
        'adb',
        this.getAdbArgs(['shell', 'input', 'text', escapedText])
      );
    } catch (error) {
      throw new DeviceActionError(
        `Failed to input text`,
        'input',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Escapes text for safe passage through ADB shell input.
   * ADB's input text command has significant limitations with special characters.
   */
  private escapeForAdb(text: string): string {
    // Replace spaces with %s (ADB convention)
    // Escape shell-sensitive characters
    return text
      .replace(/\s/g, '%s')
      .replace(/(['"\\`$!&|;<>(){}[\]*?#~])/g, '\\$1');
  }

  async home(): Promise<void> {
    try {
      await execa(
        'adb',
        this.getAdbArgs(['shell', 'input', 'keyevent', 'KEYCODE_HOME'])
      );
    } catch (error) {
      throw new DeviceActionError(
        'Failed to press home button',
        'home',
        error instanceof Error ? error : undefined
      );
    }
  }

  async isAppRunning(appId: string): Promise<boolean> {
    try {
      // Use pidof to check if process exists
      const { stdout } = await execa(
        'adb',
        this.getAdbArgs(['shell', 'pidof', appId]),
        { reject: false } // Don't throw if pidof fails (returns 1 if not found)
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async launchApp(appId: string): Promise<void> {
    try {
      const isRunning = await this.isAppRunning(appId);
      if (isRunning) {
        // Just bring to front if possible?
        // monkey with -c android.intent.category.LAUNCHER usually brings to front.
        // But let's check config for mainActivity first.
        const config = await loadConfig();
        if (config.mainActivity) {
            // am start -n <pkg>/<activity>
            // This is faster and cleaner for bringing to front/launching.
            // Construct component string safely
            const component = config.mainActivity.includes('/')
             ? config.mainActivity
             : `${appId}/${config.mainActivity}`;
             
            await execa('adb', this.getAdbArgs(['shell', 'am', 'start', '-n', component]));
            return;
        }
      }

      // Fallback or Cold Launch: Use monkey tool (reliable for generic launch)
      await execa(
        'adb',
        this.getAdbArgs([
          'shell',
          'monkey',
          '-p',
          appId,
          '-c',
          'android.intent.category.LAUNCHER',
          '1',
        ])
      );
    } catch (error) {
      throw new DeviceActionError(
        `Failed to launch app ${appId}`,
        'launch_app',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getAppLogs(tag = '[SNAP_BRIDGE]'): Promise<string[]> {
    try {
      // Use adb shell logcat -d (dump) combined with grep on the device side for performance.
      // -d: Dump the log and then exit (don't block).
      // -v raw: clean output without metadata headers if we want just the message, 
      // but usually -v time or -v threadtime is better for debugging. 
      // The requirement says "return array of log lines or parsed JSON objects".
      // Let's stick to raw lines for flexibility, or maybe minimal metadata.
      // Grep for the tag.
      
      const { stdout } = await execa(
        'adb',
        this.getAdbArgs(['shell', 'logcat', '-d', '|', 'grep', tag])
      );

      // Split by newline and filter empty lines
      return stdout.split('\n').filter(line => line.trim().length > 0);
    } catch {
      // Grep returns exit code 1 if no matches found, which execa treats as error.
      // We should check if it's just "no matches" or a real error.
      // Typically we can just return empty array if grep fails.
      return [];
    }
  }

  async installApp(path: string): Promise<void> {
    try {
      await execa(
        'adb',
        this.getAdbArgs(['install', '-r', path]) // -r to reinstall if existing
      );
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
      await execa(
        'adb',
        this.getAdbArgs(['uninstall', appId])
      );
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
      await execa(
        'adb',
        this.getAdbArgs(['shell', 'pm', 'clear', appId])
      );
    } catch (error) {
      throw new DeviceActionError(
        `Failed to reset app ${appId}`,
        'reset_app' as any,
        error instanceof Error ? error : undefined
      );
    }
  }
}
