import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IOSDriver } from './ios.js';
import { execa } from 'execa';
import { DeviceConnectionError } from '../core/errors.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('IOSDriver', () => {
  const mockExeca = execa as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should auto-detect a single booted device', async () => {
      // Mock checkIdbAvailability
      mockExeca.mockResolvedValueOnce({ stdout: 'idb 1.0.0' });
      // Mock detectDevice
      mockExeca.mockResolvedValueOnce({ 
        // JSON output for 2 devices, one booted
        stdout: JSON.stringify({ udid: 'booted-uuid', state: 'Booted', name: 'iPhone 14' }) + '\n' +
                JSON.stringify({ udid: 'shutdown-uuid', state: 'Shutdown', name: 'iPhone 13' })
      });

      const driver = await IOSDriver.create();
      expect(driver).toBeInstanceOf(IOSDriver);
      expect(mockExeca).toHaveBeenCalledWith('idb', ['list-targets', '--json']);
    });

    it('should throw if no booted devices found', async () => {
      // Mock idb list-targets (availability check)
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' });
      // Mock idb list-targets --json (detectDevice)
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ udid: 'shutdown-uuid', state: 'Shutdown' })
      });
      // Mock xcrun simctl list devices (detectDeviceXcrun fallback)
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ devices: { 'runtime': [{ state: 'Shutdown', udid: 'shutdown-uuid' }] } })
      });

      await expect(IOSDriver.create()).rejects.toThrow(DeviceConnectionError);
    });
  });

  describe('methods', () => {
    let driver: IOSDriver;

    beforeEach(async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' });
      mockExeca.mockResolvedValueOnce({ 
        stdout: JSON.stringify({ udid: 'test-udid', state: 'Booted' }) 
      });
      driver = await IOSDriver.create();
      vi.clearAllMocks();
    });

    it('getScreenshot should use correct idb args', async () => {
        mockExeca.mockResolvedValueOnce({ stdout: Buffer.alloc(10) });
        await driver.getScreenshot();
        // IOSDriver: ['screenshot', '--udid', 'test-udid', '-']
        expect(mockExeca).toHaveBeenCalledWith(
            'idb',
            ['screenshot', '--udid', 'test-udid', '-'],
            { encoding: 'buffer', stripFinalNewline: false }
        );
    });

    it('launchApp should use xcrun simctl launch command', async () => {
        mockExeca.mockResolvedValueOnce({});
        await driver.launchApp('com.example.app');
        // IOSDriver: xcrun simctl launch <udid> <appId>
        expect(mockExeca).toHaveBeenCalledWith(
            'xcrun',
            ['simctl', 'launch', 'test-udid', 'com.example.app']
        );
    });

    it('isAppRunning should return true if found in ps aux', async () => {
        mockExeca.mockResolvedValueOnce({ stdout: 'user 1234 0.0 0.0 ... com.example.app\n' });
        const result = await driver.isAppRunning('com.example.app');
        expect(result).toBe(true);
        expect(mockExeca).toHaveBeenCalledWith(
            'xcrun',
            ['simctl', 'spawn', 'test-udid', 'ps', 'aux']
        );
    });

    it('isAppRunning should return false if not found', async () => {
         mockExeca.mockResolvedValueOnce({ stdout: 'user 9999 ... other.app\n' });
         const result = await driver.isAppRunning('com.example.app');
         expect(result).toBe(false);
    });


    it('tap should use ui tap', async () => {
        mockExeca.mockResolvedValueOnce({});
        await driver.tap(100, 200);
        expect(mockExeca).toHaveBeenCalledWith(
            'idb',
            ['ui', '--udid', 'test-udid', 'tap', '100', '200']
        );
    });
  });
});
