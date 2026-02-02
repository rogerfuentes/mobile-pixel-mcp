# Mobile Snap MCP - Implementation Walkthrough

I have successfully built and verified the **Mobile Snap MCP** server, adding Configuration, App State Management, **Optical Character Recognition (OCR)** capabilities, and a **Log Bridge**.

## Production Readiness
- **CLI**: Executable via `mobile-pixel`.
- **Config**: `package.json` configured with `bin` and `files`.
- **Build**: TypeScript compiled to `dist/`.
- **verified**: `npm link` tested successfully.

## New Features Implemented

1.  **Log Bridge**:
    - **Concept**: Allows the MCP server to read internal app telemetry via system logs using a specific tag (default: `[SNAP_BRIDGE]`).
    - **Tool**: `check_app_log(tag?, filter_text?)`.
    - **Implementation**:
        - **Android**: `adb shell logcat -d | grep {tag}`.
        - **iOS**: `xcrun simctl spawn ... log show --predicate 'eventMessage contains "{tag}"'`.

2.  **OCR Capabilities**:
    - **`src/core/ocr.ts`**: Implements `findTextBounds` function.
    - **Preprocessing**: Uses `sharp` to convert images to grayscale and threshold (128) for high-contrast OCR.
    - **Engine**: Uses `tesseract.js` (English) to recognize text.
    - **Matching**: Fuzzy case-insensitive matching to find word bounds.
    - **Tools**:
        - `find_text(text)`: Returns coordinates and validity of text on screen.
        - `tap_text(text)`: Finds text and taps its center. Returns a screenshot of the post-tap state.

3.  **Configuration System**:
    - **`mobile-snap.config.json`**: The server now looks for this file in the current directory to load defaults.
    - **Precedence**: CLI arguments override config file values.
    - **Fields**: `platform`, `deviceId`, `appId`, `mainActivity`.

4.  **App State Management**:
    - **`check_app_status` Tool**: New tool to verify if an app is running.
    - **Smart Launch**: `launch_app` now checks if the app is already running.

5.  **Dynamic Configuration (v1.2)**:
    - **Implementation**: `ProxyDriver` wraps platform drivers to allow hot-swapping.
    - **Tool**: `configure_device(platform, device_id, app_id)` updates `mobile-pixel.config.json` and reloads the driver on the fly.

6.  **Lifecycle Management (v1.3)**:
    - **Installation**: `install_app(path)` supports APKs and .app bundles.
    - **Uninstallation**: `uninstall_app(app_id)` removes apps.
    - **Reset State**: `reset_app(app_id)` clears data without uninstalling (using `pm clear` on Android and `rm` on iOS container).
    
7.  **OCR Robustness (v1.3.1)**:
    - Added 7-stage preprocessing pipeline including standard, inverted (dark mode), and high-contrast variants.
    - Implemented **Dynamic Scaling**: Automatically calculates exact scale factors (`TargetWidth / InputWidth`) to ensure pixel-perfect coordinate mapping regardless of screenshot resolution (1x, 2x, 3x).
    - **Heuristic Matching**: Prioritizes "Exact Matches" and "Bottom-Most" matches (Higher Y-value) to correctly identify footer buttons over descriptive text.
    - **IDB Syntax Fixes**: Refactored iOS driver to use explicit `idb ui <cmd> --udid ...` syntax for reliability.
    - Improved phrase matching to scan full lines instead of individual words.

## Core Implementation Details

### 1. Project Structure
- **`src/core/config.ts`**: Handles loading and parsing of the configuration file.
- **`src/core/ocr.ts`**: OCR logic (Tesseract + Sharp).
- **`src/core/driver.ts`**: Extended `DeviceDriver` interface with `isAppRunning` and `getAppLogs`.
- **`src/core/image.ts`**: Image optimization logic (Sharp, JPEG, Resize).

### 2. Drivers
- **Android** (`src/drivers/android.ts`):
  - **Detection**: Auto-detects single device or uses ID.
  - **Status**: `adb shell pidof <pkg>`
  - **Launch**: `am start` (if configured/running) or `monkey` (cold start).
  - **Logs**: `logcat -d` filtered by tag.
- **iOS** (`src/drivers/ios.ts`):
  - **Detection**: Auto-detects single booted simulator.
  - **Status**: `xcrun simctl spawn <udid> ps aux`
  - **Launch**: `xcrun simctl launch <udid> <bundleId>`
  - **Logs**: `xcrun simctl ... log show` filtered by predicate.
  - **Robustness**: Supports operation without `idb`.

### 3. MCP Server (`src/index.ts`)
- **Tools**:
  - `get_screen`, `tap`, `swipe`, `type_text`, `home`.
  - `launch_app(app_id?)`: Uses default `appId` from config if not provided. Returns screenshot.
  - `check_app_status(app_id?)`: Returns text status "Running" or "Stopped".
  - `find_text(text)`: Checks for text presence using OCR.
  - `tap_text(text)`: Taps on text using OCR coordinates.
  - `check_app_log(tag?, filter?)`: Tails app logs.

## Verification

The project is verified with a comprehensive unit test suite and a real-world E2E script.

### Unit Testing Results
```
 ✓ src/core/ocr.test.ts
 ✓ src/drivers/ios.test.ts
 ✓ src/core/errors.test.ts
 ✓ src/drivers/android.test.ts
 ✓ src/core/image.test.ts
```

### E2E Verification
I created a script `scripts/e2e_ios_settings.ts` to verify iOS interaction on a simulator.
- **Flow**: Open Settings -> Tap "General".
- **Result**: Successfully navigated and captured screenshots in `e2e_artifacts/`.

## CI/CD & Deployment

-   **Provider**: GitHub Actions (`.github/workflows/deploy.yml`)
-   **Trigger**: Push to `main` branch.
-   **Automation**:
    1.  **Build & Test**: Runs `npm ci`, `npm run build`, `npm test`.
    2.  **Release**: Automatically creates a GitHub Release (e.g., `v1.0.3`) based on `package.json` version.
    3.  **Publish**: Publishes to NPM using **Trusted Publishing (OIDC)** (no manually managed tokens).
-   **Environment**: Configured as `npm` in GitHub repository settings.
