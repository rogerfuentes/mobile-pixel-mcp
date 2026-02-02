# Mobile Pixel MCP

A lightweight, visual-first Model Context Protocol (MCP) server for mobile device automation. Enables AI models to control and interact with mobile devices through screenshots and coordinate-based interactions.

## Quick Start

Add this to your MCP client configuration (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "mobile-pixel": {
      "command": "npx",
      "args": [
        "-y",
        "@kelios/mobile-pixel-mcp@latest"
      ]
    }
  }
}
```

You can optionally pass arguments to specify a platform or device:
```json
"args": ["-y", "@kelios/mobile-pixel-mcp@latest", "--platform", "ios"]
```

## Prerequisites

Start the server *after* ensuring your environment is ready:

### Android
- [Android Debug Bridge (ADB)](https://developer.android.com/tools/adb) installed and in PATH
- USB debugging enabled on device, or emulator running
- Device connected and authorized (`adb devices` shows your device)

### iOS
- [IDB (iOS Development Bridge)](https://fbidb.io/) installed and in PATH
- Xcode and Xcode Command Line Tools (`xcrun simctl` support)
- Simulator running or physical device connected

## Features

- **Visual-First:** Uses screenshots + coordinates (OCR/Computer Vision ready)
- **Automatic OCR:** `find_text` and `tap_text` tools included
- **Telemetry Bridge:** Read app logs via MCP
- **Smart Launch:** Context-aware app launching (resumes if running, cold start if not)
- Cross-platform support (Android & iOS)

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_screen` | Capture current device screen | None |
| `tap` | Tap at coordinates | `x`, `y` |
| `swipe` | Swipe gesture | `x1`, `y1`, `x2`, `y2`, `duration_ms` |
| `type_text` | Input text into focused element | `text` |
| `home` | Press Home button | None |
| `launch_app` | Launch/Resume an app | `app_id` |
| `check_app_status` | Check if app is running | `app_id` |
| `find_text` | Find text coordinates (OCR) | `text` |
| `tap_text` | Find text and tap center (OCR) | `text` |
| `check_app_log` | Tail recent app logs | `tag`, `filter_text` |

## Configuration

You can configure defaults using a `mobile-pixel.config.json` file in the working directory where the server is running.

```json
{
  "platform": "android",
  "deviceId": "emulator-5554",
  "appId": "com.example.app",
  "mainActivity": ".MainActivity"
}
```

## Local Development & Installation

If you want to run from source or contribute:

1.  **Clone**: `git clone <repo>`
2.  **Install**: `npm install`
3.  **Build**: `npm run build`
4.  **Run**:
    ```bash
    # Android
    npm start
    # iOS
    npm start -- --platform=ios
    ```
5.  **Test**: `npm test`

## Troubleshooting

### "ADB/IDB is not available"
Ensure the respective tools (`adb` for Android, `idb`/`xcrun` for iOS) are installed and in your system PATH.

## License

Apache-2.0
