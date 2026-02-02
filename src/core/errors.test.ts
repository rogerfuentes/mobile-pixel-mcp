import { describe, it, expect } from 'vitest';
import {
  MobileSnapError,
  DeviceConnectionError,
  ToolNotAvailableError,
  DeviceActionError,
  ValidationError,
} from './errors.js';

describe('MobileSnapError', () => {
  it('should create error with correct name', () => {
    const error = new MobileSnapError('test message');

    expect(error.name).toBe('MobileSnapError');
    expect(error.message).toBe('test message');
  });

  it('should be instance of Error', () => {
    const error = new MobileSnapError('test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MobileSnapError);
  });

  it('should have stack trace', () => {
    const error = new MobileSnapError('test');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('MobileSnapError');
  });
});

describe('DeviceConnectionError', () => {
  it('should create error with platform info', () => {
    const error = new DeviceConnectionError('Device not found', 'android');

    expect(error.name).toBe('DeviceConnectionError');
    expect(error.message).toBe('Device not found');
    expect(error.platform).toBe('android');
    expect(error.deviceId).toBeUndefined();
  });

  it('should include device ID when provided', () => {
    const error = new DeviceConnectionError('Device offline', 'ios', 'ABC123');

    expect(error.platform).toBe('ios');
    expect(error.deviceId).toBe('ABC123');
  });

  it('should be instance of MobileSnapError', () => {
    const error = new DeviceConnectionError('test', 'android');

    expect(error).toBeInstanceOf(MobileSnapError);
    expect(error).toBeInstanceOf(DeviceConnectionError);
  });
});

describe('ToolNotAvailableError', () => {
  it('should create error for ADB', () => {
    const error = new ToolNotAvailableError('adb', 'android');

    expect(error.name).toBe('ToolNotAvailableError');
    expect(error.tool).toBe('adb');
    expect(error.platform).toBe('android');
    expect(error.message).toContain('ADB is not available');
    expect(error.message).toContain('Android Platform Tools');
  });

  it('should create error for IDB', () => {
    const error = new ToolNotAvailableError('idb', 'ios');

    expect(error.name).toBe('ToolNotAvailableError');
    expect(error.tool).toBe('idb');
    expect(error.platform).toBe('ios');
    expect(error.message).toContain('IDB is not available');
  });

  it('should be instance of MobileSnapError', () => {
    const error = new ToolNotAvailableError('adb', 'android');

    expect(error).toBeInstanceOf(MobileSnapError);
  });
});

describe('DeviceActionError', () => {
  it('should create error for tap action', () => {
    const error = new DeviceActionError('Failed to tap', 'tap');

    expect(error.name).toBe('DeviceActionError');
    expect(error.message).toBe('Failed to tap');
    expect(error.action).toBe('tap');
    expect(error.cause).toBeUndefined();
  });

  it('should include cause error when provided', () => {
    const causeError = new Error('Shell command failed');
    const error = new DeviceActionError('Screenshot failed', 'screenshot', causeError);

    expect(error.action).toBe('screenshot');
    expect(error.cause).toBe(causeError);
  });

  it('should support all action types', () => {
    const actions: ('tap' | 'swipe' | 'input' | 'screenshot' | 'home')[] = [
      'tap',
      'swipe',
      'input',
      'screenshot',
      'home',
    ];

    for (const action of actions) {
      const error = new DeviceActionError(`${action} failed`, action);
      expect(error.action).toBe(action);
    }
  });
});

describe('ValidationError', () => {
  it('should create validation error', () => {
    const error = new ValidationError('Invalid platform');

    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Invalid platform');
  });

  it('should be instance of MobileSnapError', () => {
    const error = new ValidationError('test');

    expect(error).toBeInstanceOf(MobileSnapError);
  });
});

describe('Error hierarchy', () => {
  it('should allow catching all errors with MobileSnapError', () => {
    const errors = [
      new DeviceConnectionError('test', 'android'),
      new ToolNotAvailableError('adb', 'android'),
      new DeviceActionError('test', 'tap'),
      new ValidationError('test'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(MobileSnapError);
    }
  });
});
