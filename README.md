# Mobile Pixel MCP

A lightweight, visual-first Model Context Protocol (MCP) server for mobile device automation. Enables AI models to control and interact with mobile devices through screenshots and coordinate-based interactions.

## Philosophy

- **Visual-First:** Uses screenshots + coordinates, not XML view hierarchies
- **Speed:** Native tools (ADB/IDB) over heavyweight frameworks (Appium)
- **The Loop:** Every action returns immediate visual confirmation
- **Smart Launch:** Context-aware app launching (resumes if running, cold start if not)

## Features

- Screenshot capture with automatic optimization
- Tap at coordinates or **Find & Tap by Text (OCR)**
- Swipe gestures with configurable duration
- Text input
- Home button press
- **App Launch & State Management**: Smart launching and status checking
- **Telemetry Bridge**: Read app logs via MCP
- Cross-platform support (Android & iOS)
- Configuration file support (`mobile-pixel.config.json`)

## Prerequisites

### Android
- [Android Debug Bridge (ADB)](https://developer.android.com/tools/adb) installed and in PATH
- USB debugging enabled on device, or emulator running
- Device connected and authorized (`adb devices` shows your device)

### iOS
- [IDB (iOS Development Bridge)](https://fbidb.io/) installed and in PATH
- Xcode and Xcode Command Line Tools (`xcrun simctl` support)
- Simulator running or physical device connected

### OCR Dependencies
- The server uses `tesseract.js` (WebAssembly) and `sharp`. These are installed automatically via `npm install`. No external system dependencies required.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd mobile-pixel-mcp

# Install dependencies
npm install

# Build (optional, for production)
npm run build
```

## Configuration

You can configure defaults using a `mobile-pixel.config.json` file in the project directory.

**Example `mobile-pixel.config.json`:**
```json
{
  "platform": "android",
  "deviceId": "emulator-5554",
  "appId": "com.example.app",
  "mainActivity": ".MainActivity"
}
```

**Precedence:**
1. CLI Arguments (`--device=...`)
2. Configuration File (`mobile-pixel.config.json`)
3. Defaults (Platform: `android`, Device: Auto-detect)

## Usage

### Running the Server

```bash
# Android (default, auto-detect device)
npm start

# iOS
npm start -- --platform=ios

# Specific Android device (overrides config)
npm start -- --device=emulator-5554

# Specific iOS device
npm start -- --platform=ios --udid=ABC123-DEF456
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "mobile-pixel": {
      "command": "node",
      "args": ["/path/to/mobile-pixel-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_screen` | Capture current device screen | None |
| `tap` | Tap at coordinates | `x`, `y` |
| `swipe` | Swipe gesture | `x1`, `y1`, `x2`, `y2`, `duration_ms` (default: 1000) |
| `type_text` | Input text into focused element | `text` |
| `home` | Press Home button | None |
| `launch_app` | Launch/Resume an app | `app_id` (optional if in config) |
| `check_app_status` | Check if app is running | `app_id` (optional if in config) |
| `find_text` | Find text coordinates (OCR) | `text` |
| `tap_text` | Find text and tap center (OCR) | `text` |
| `check_app_log` | Tail recent app logs | `tag` (default: [SNAP_BRIDGE]), `filter_text` |

All action tools return a text confirmation and a screenshot of the resulting state.

## Architecture

```
src/
├── index.ts              # MCP server & tool definitions
├── core/
│   ├── config.ts         # Configuration loader
│   ├── driver.ts         # DeviceDriver interface
│   ├── image.ts          # Image optimization (Sharp)
│   └── ocr.ts            # OCR Engine (Tesseract.js)
└── drivers/
    ├── android.ts        # Android implementation (ADB + PIDOF)
    └── ios.ts            # iOS implementation (IDB + XCRUN)
```

### App State Management
- **Android**: Uses `pidof` to check status. Uses `am start -n` for fast resume if `mainActivity` is configured, otherwise `monkey` for cold start.
- **iOS**: Uses `xcrun simctl spawn ... ps aux` for status and `xcrun simctl launch` for execution (Simulator optimized).

## Development

```bash
# Run in development mode (with tsx)
npm start

# Build TypeScript
npm run build

# Run tests
npm test
```

## Tech Stack

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript (strict mode)
- **MCP SDK:** @modelcontextprotocol/sdk
- **Shell Execution:** execa
- **Image Processing:** Sharp
- **Validation:** Zod
- **Testing**: Vitest

## Troubleshooting

### "ADB is not available"
Ensure Android Platform Tools are installed and `adb` is in your PATH.

### "IDB is not available"
Ensure IDB is installed (`brew install idb-companion`, `pip install fb-idb`).

### "App ID is required"
If using `launch_app` or `check_app_status` without arguments, ensure `appId` is set in `mobile-pixel.config.json` or pass it explicitly.

## License

ISC
