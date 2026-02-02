import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidDriver } from './android.js';
import { execa } from 'execa';
import { DeviceConnectionError } from '../core/errors.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock config
vi.mock('../core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}));

import { loadConfig } from '../core/config.js';

describe('AndroidDriver', () => {
  const mockExeca = execa as unknown as ReturnType<typeof vi.fn>;
  const mockLoadConfig = loadConfig as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue({});
  });

  describe('create', () => {
    it('should auto-detect a single device', async () => {
      // Mock checkAdbAvailability
      mockExeca.mockResolvedValueOnce({ stdout: 'Android Debug Bridge version 1.0.41' });
      // Mock detectDevice (via create)
      mockExeca.mockResolvedValueOnce({ 
        stdout: 'List of devices attached\n12345678\tdevice\n' 
      });

      const driver = await AndroidDriver.create();
      expect(driver).toBeInstanceOf(AndroidDriver);
      expect(mockExeca).toHaveBeenCalledWith('adb', ['devices']);
    });

    it('should throw if no devices found', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' }); // adb version
      mockExeca.mockResolvedValueOnce({ stdout: 'List of devices attached\n' }); // adb devices (empty)

      await expect(AndroidDriver.create()).rejects.toThrow(DeviceConnectionError);
    });

    it('should throw if multiple devices found without deviceId', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' });
      mockExeca.mockResolvedValueOnce({ 
        stdout: 'List of devices attached\n123\tdevice\n456\tdevice\n' 
      });

      await expect(AndroidDriver.create()).rejects.toThrow(/Multiple devices found/);
    });

    it('should use provided deviceId', async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' });
      // validateDevice
      mockExeca.mockResolvedValueOnce({ 
        stdout: 'List of devices attached\n123\tdevice\n' 
      });

      const driver = await AndroidDriver.create('123');
      expect(driver).toBeInstanceOf(AndroidDriver);
    });
  });

  describe('methods', () => {
    let driver: AndroidDriver;

    beforeEach(async () => {
      mockExeca.mockResolvedValueOnce({ stdout: 'ver' });
      mockExeca.mockResolvedValueOnce({ stdout: 'List of devices attached\n123\tdevice\n' });
      driver = await AndroidDriver.create('123');
      vi.clearAllMocks(); // Clear create calls
    });

    it('getScreenshot should use correct adb args', async () => {
        mockExeca.mockResolvedValueOnce({ stdout: Buffer.alloc(10) });
        await driver.getScreenshot();
        expect(mockExeca).toHaveBeenCalledWith(
            'adb',
            ['-s', '123', 'exec-out', 'screencap', '-p'],
            expect.objectContaining({ encoding: 'buffer' })
        );
    });

    it('tap should use input tap', async () => {
        mockExeca.mockResolvedValueOnce({});
        await driver.tap(100, 200);
        expect(mockExeca).toHaveBeenCalledWith(
            'adb',
            ['-s', '123', 'shell', 'input', 'tap', '100', '200']
        );
    });

    // New tests for App State and Launch
    it('isAppRunning should return true if pidof finds process', async () => {
        mockExeca.mockResolvedValueOnce({ stdout: '12345\n' });
        const result = await driver.isAppRunning('com.example');
        expect(result).toBe(true);
        expect(mockExeca).toHaveBeenCalledWith('adb', expect.arrayContaining(['shell', 'pidof', 'com.example']), expect.anything());
    });

    it('isAppRunning should return false if pidof fails', async () => {
        mockExeca.mockRejectedValueOnce(new Error('exit code 1'));
        const result = await driver.isAppRunning('com.example');
        expect(result).toBe(false);
    });

    it('launchApp should use monkey if app not running', async () => {
        mockExeca.mockRejectedValueOnce(new Error('not running')); // isAppRunning check
        mockExeca.mockResolvedValueOnce({}); // monkey command
        
        await driver.launchApp('com.example.app');
        
        expect(mockExeca).toHaveBeenLastCalledWith(
            'adb',
            expect.arrayContaining(['shell', 'monkey', '-p', 'com.example.app'])
        );
    });

    it('launchApp should use am start if running and mainActivity configured', async () => {
        // Mock running
        mockExeca.mockResolvedValueOnce({ stdout: '123' }); 
        // Mock config
        mockLoadConfig.mockResolvedValueOnce({ mainActivity: '.MainActivity' });
        // Mock am start
        mockExeca.mockResolvedValueOnce({});

        await driver.launchApp('com.example.app');

        expect(mockExeca).toHaveBeenLastCalledWith(
            'adb',
            expect.arrayContaining(['shell', 'am', 'start', '-n', 'com.example.app/.MainActivity'])
        );
    });
  });
});
