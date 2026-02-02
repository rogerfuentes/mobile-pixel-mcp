/**
 * Custom error types for Mobile Pixel MCP.
 * Provides structured error handling for device operations.
 */

/**
 * Base error class for all Mobile Pixel errors.
 */
export class MobileSnapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MobileSnapError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when a device connection cannot be established or is lost.
 */
export class DeviceConnectionError extends MobileSnapError {
  constructor(
    message: string,
    public readonly platform: 'android' | 'ios' | 'auto',
    public readonly deviceId?: string
  ) {
    super(message);
    this.name = 'DeviceConnectionError';
  }
}

/**
 * Thrown when a required tool (ADB, IDB) is not available.
 */
export class ToolNotAvailableError extends MobileSnapError {
  constructor(
    public readonly tool: 'adb' | 'idb',
    public readonly platform: 'android' | 'ios'
  ) {
    super(
      `${tool.toUpperCase()} is not available. ` +
        `Please ensure ${platform === 'android' ? 'Android Platform Tools are' : 'IDB is'} installed and in your PATH.`
    );
    this.name = 'ToolNotAvailableError';
  }
}

/**
 * Thrown when an action fails on the device.
 */
export class DeviceActionError extends MobileSnapError {
  constructor(
    message: string,
    public readonly action: 'tap' | 'swipe' | 'input' | 'screenshot' | 'home' | 'launch_app',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DeviceActionError';
  }
}

/**
 * Thrown when input validation fails.
 */
export class ValidationError extends MobileSnapError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
