/**
 * Interface defining the capabilities of a mobile device driver.
 * Drivers for specific platforms (Android/iOS) should implement this.
 */
export interface DeviceDriver {
  /**
   * Captures a screenshot of the current device screen.
   * @returns A Promise resolving to a Buffer containing the image data.
   */
  getScreenshot(): Promise<Buffer>;

  /**
   * Performs a tap action at the specified coordinates.
   * @param x The x-coordinate.
   * @param y The y-coordinate.
   */
  tap(x: number, y: number): Promise<void>;

  /**
   * Performs a swipe action from (x1, y1) to (x2, y2).
   * @param x1 Starting x-coordinate.
   * @param y1 Starting y-coordinate.
   * @param x2 Ending x-coordinate.
   * @param y2 Ending y-coordinate.
   * @param durationMs Optional duration of the swipe in milliseconds.
   */
  swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs?: number
  ): Promise<void>;

  /**
   * Inputs text into the currently focused element.
   * @param text The text to input.
   */
  inputText(text: string): Promise<void>;

  /**
   * Navigates to the home screen.
   */
  home(): Promise<void>;
  /**
   * Launches an application by its package name (Android) or bundle ID (iOS).
   * @param appId The package name or bundle ID of the app to launch.
   */
  launchApp(appId: string): Promise<void>;

  /**
   * Checks if an application is currently running.
   * @param appId The package name or bundle ID of the app.
   */
  isAppRunning(appId: string): Promise<boolean>;

  /**
   * Fetches recent logs from the device, strictly filtered by a specific tag.
   * @param tag - The log tag to search for (default: "[SNAP_BRIDGE]")
   * @returns Array of log lines or parsed JSON objects
   */
  getAppLogs(tag?: string): Promise<string[]>;

  /**
   * Installs an application from a local file path.
   * @param path The local path to the APK (Android) or .app/.ipa (iOS) file.
   */
  installApp(path: string): Promise<void>;

  /**
   * Uninstalls an application by its ID.
   * @param appId The package name (Android) or bundle ID (iOS).
   */
  uninstallApp(appId: string): Promise<void>;

  /**
   * Resets the application state (clears data/cache) without uninstalling.
   * @param appId The package name (Android) or bundle ID (iOS).
   */
  resetApp(appId: string): Promise<void>;
}
