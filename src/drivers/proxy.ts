import { DeviceDriver } from '../core/driver.js';
import { MobileSnapConfig } from '../core/config.js';
import { AndroidDriver } from './android.js';
import { IOSDriver } from './ios.js';
import { DeviceConnectionError } from '../core/errors.js';
import { execa } from 'execa';

export class ProxyDriver implements DeviceDriver {
  private currentDriver: DeviceDriver | null = null;
  private currentConfig: MobileSnapConfig = {};

  constructor() {}

  async reconfigure(config: MobileSnapConfig): Promise<void> {
    this.currentConfig = config;
    this.currentDriver = null; // Reset current driver

    let platform = config.platform;
    const deviceId = config.deviceId;

    if (!platform || platform === 'auto') {
      platform = await this.detectPlatform();
    }

    console.error(`[ProxyDriver] Configuring for platform: ${platform}, deviceId: ${deviceId || 'auto'}`);

    try {
      if (platform === 'android') {
        this.currentDriver = await AndroidDriver.create(deviceId);
      } else if (platform === 'ios') {
        this.currentDriver = await IOSDriver.create(deviceId);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error('[ProxyDriver] Failed to initialize driver:', error);
      // We don't throw here to allowing the server to keep running, 
      // but subsequent calls will fail.
    }
  }

  private async detectPlatform(): Promise<'android' | 'ios'> {
    // 1. Check Android devices
    try {
      const { stdout: adbOut } = await execa('adb', ['devices']);
      if (adbOut.includes('\tdevice')) {
        return 'android';
      }
    } catch {}

    // 2. Check iOS devices (booted)
    try {
      const { stdout: iosOut } = await execa('xcrun', ['simctl', 'list', 'devices', 'booted']);
      // Should check if it's not empty and contains "Booted"
      if (iosOut.includes('Booted')) {
        return 'ios';
      }
    } catch {}

    // Default or fail?
    // Let's default to android if nothing found, likely to fail later but better than crash
    return 'android';
  }

  private ensureDriver(): DeviceDriver {
    if (!this.currentDriver) {
      throw new DeviceConnectionError(
        'No active device driver. Please configure the server using configure_device tool or .mobile-mcp.json',
        'auto'
      );
    }
    return this.currentDriver;
  }

  async getScreenshot(): Promise<Buffer> {
    return this.ensureDriver().getScreenshot();
  }

  async tap(x: number, y: number): Promise<void> {
    return this.ensureDriver().tap(x, y);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, durationMs?: number): Promise<void> {
    return this.ensureDriver().swipe(x1, y1, x2, y2, durationMs);
  }

  async inputText(text: string): Promise<void> {
    return this.ensureDriver().inputText(text);
  }

  async home(): Promise<void> {
    return this.ensureDriver().home();
  }

  async launchApp(appId: string): Promise<void> {
    return this.ensureDriver().launchApp(appId);
  }

  async isAppRunning(appId: string): Promise<boolean> {
    return this.ensureDriver().isAppRunning(appId);
  }

  async getAppLogs(tag?: string): Promise<string[]> {
    return this.ensureDriver().getAppLogs(tag);
  }

  async installApp(path: string): Promise<void> {
    return this.ensureDriver().installApp(path);
  }

  async uninstallApp(appId: string): Promise<void> {
    return this.ensureDriver().uninstallApp(appId);
  }

  async resetApp(appId: string): Promise<void> {
    return this.ensureDriver().resetApp(appId);
  }
}
