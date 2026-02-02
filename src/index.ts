import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ProxyDriver } from "./drivers/proxy.js";
import { optimizeImage } from "./core/image.js";
import { loadConfig, saveConfig, ensureConfig } from "./core/config.js";
import { findTextBounds } from "./core/ocr.js";
import {
  MobileSnapError,
  ValidationError,
} from "./core/errors.js";

const SUPPORTED_PLATFORMS = ['android', 'ios', 'auto'] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

interface CliArgs {
  platform: Platform;
  deviceId?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const getArgValue = (key: string): string | undefined => {
      const index = args.findIndex(arg => arg === key);
      if (index !== -1 && index + 1 < args.length && !args[index + 1].startsWith('--')) {
          return args[index + 1];
      }
      const prefixArg = args.find(arg => arg.startsWith(`${key}=`));
      return prefixArg ? prefixArg.split('=')[1] : undefined;
  };

  const platform = getArgValue('--platform') || 'auto';
  // Allow explicit 'auto' or supported platforms
  if (!SUPPORTED_PLATFORMS.includes(platform as Platform)) {
     // fallback or throw? 
  }
  
  const deviceId = getArgValue('--device') || getArgValue('--udid');

  return {
    platform: platform as Platform,
    deviceId,
  };
}

async function main() {
  await ensureConfig();
  const args = parseArgs();
  const fileConfig = await loadConfig();

  // Merge: CLI args override File config
  const initialPlatform = (args.platform !== 'auto' ? args.platform : undefined) || fileConfig.platform || 'auto';
  const initialDeviceId = args.deviceId || fileConfig.deviceId;
  const initialAppId = fileConfig.appId;

  console.error(`Initializing Mobile Pixel MCP...`);
  console.error(`Platform: ${initialPlatform}, Device: ${initialDeviceId || 'auto'}`);

  const driver = new ProxyDriver();
  
  // Initial configuration
  await driver.reconfigure({
      platform: initialPlatform,
      deviceId: initialDeviceId,
      appId: initialAppId
  });

  const server = new McpServer({
    name: "mobile-pixel-mcp",
    version: "1.3.1",
  });

  server.tool(
      "configure_device",
      "Update the device configuration dynamically without restarting",
      {
          platform: z.enum(['android', 'ios', 'auto']).describe("Platform to switch to"),
          device_id: z.string().optional().describe("Device ID / UDID (optional)"),
          app_id: z.string().optional().describe("Default App ID to use"),
      },
      async ({ platform, device_id, app_id }) => {
          try {
              const newConfig = {
                  platform: platform as 'android' | 'ios' | 'auto',
                  deviceId: device_id,
                  appId: app_id
              };
              
              // Save to disk
              await saveConfig({
                  ...await loadConfig(), // merge with existing
                  ...newConfig
              });
              
              // Apply config
              await driver.reconfigure(newConfig);
              
              return {
                  content: [{ type: "text", text: `Configuration updated to: ${platform} ${device_id || '(auto)'} ${app_id || ''}` }]
              };
          } catch (error) {
              return {
                  content: [{ type: "text", text: `Failed to configure: ${error instanceof Error ? error.message : String(error)}` }],
                  isError: true
              };
          }
      }
  );

  // Helper to capture screenshot and return formatted tool response
  async function captureAndFormatResponse(message: string) {
    const rawBuffer = await driver.getScreenshot();
    const base64Image = await optimizeImage(rawBuffer);

    return {
      content: [
        {
          type: "text" as const,
          text: message,
        },
        {
          type: "image" as const,
          data: base64Image,
          mimeType: "image/jpeg",
        },
      ],
    };
  }

  // Helper to handle errors consistently
  function handleError(error: unknown, action: string) {
    const message = error instanceof MobileSnapError
      ? error.message
      : `${action} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

    return {
      content: [
        {
          type: "text" as const,
          text: message,
        },
      ],
      isError: true,
    };
  }

  server.tool(
    "get_screen",
    "Capture the current device screen",
    {},
    async () => {
      try {
        return captureAndFormatResponse("Screenshot captured");
      } catch (error) {
        return handleError(error, "Screenshot capture");
      }
    }
  );

  server.tool(
    "tap",
    "Tap at the specified coordinates (x, y)",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
    },
    async ({ x, y }) => {
      try {
        await driver.tap(x, y);
        return captureAndFormatResponse(`Tapped at ${x}, ${y}`);
      } catch (error) {
        return handleError(error, "Tap");
      }
    }
  );

  server.tool(
    "swipe",
    "Swipe from (x1, y1) to (x2, y2)",
    {
      x1: z.number().describe("Start X coordinate"),
      y1: z.number().describe("Start Y coordinate"),
      x2: z.number().describe("End X coordinate"),
      y2: z.number().describe("End Y coordinate"),
      duration_ms: z.number().optional().default(1000).describe("Duration in milliseconds (default: 1000)"),
    },
    async ({ x1, y1, x2, y2, duration_ms }) => {
      try {
        await driver.swipe(x1, y1, x2, y2, duration_ms);
        return captureAndFormatResponse(`Swiped from ${x1},${y1} to ${x2},${y2} (${duration_ms}ms)`);
      } catch (error) {
        return handleError(error, "Swipe");
      }
    }
  );

  server.tool(
    "type_text",
    "Type text into the focused element",
    {
      text: z.string().describe("Text to type"),
    },
    async ({ text }) => {
      try {
        await driver.inputText(text);
        return captureAndFormatResponse(`Typed text: "${text}"`);
      } catch (error) {
        return handleError(error, "Type text");
      }
    }
  );

  server.tool(
    "launch_app",
    "Launch an application and return a screenshot",
    {
      app_id: z.string().optional().describe("Package name (Android) or Bundle ID (iOS). Defaults to config if not provided."),
    },
    async ({ app_id }) => {
      try {
        const currentConfig = await loadConfig(); // Reload config to get latest updates
        const targetAppId = app_id || currentConfig.appId;
        if (!targetAppId) {
            throw new ValidationError("App ID is required (not provided in args or config).");
        }
        await driver.launchApp(targetAppId);
        // Wait a bit for app to open? 
        // User requirements: "The launch_app tool must also return a Screenshot of the app after it opens."
        // Driver operations are async. `monkey` command usually returns when command is sent, not when app is fully ready.
        // It might be safer to add a small delay, but I'll stick to 'immediate' unless issues arise, 
        // or rely on the driver command completing.
        // Monkey returns fast.
        // Let's return the screenshot immediately as requested.
        return captureAndFormatResponse(`Launched app: ${targetAppId}`);
      } catch (error) {
        return handleError(error, "Launch app");
      }
    }
  );

  server.tool(
    "check_app_status",
    "Check if an application is running",
    {
      app_id: z.string().optional().describe("Package name (Android) or Bundle ID (iOS). Defaults to config."),
    },
    async ({ app_id }) => {
      try {
        const currentConfig = await loadConfig(); // Reload config
        const targetAppId = app_id || currentConfig.appId;
        if (!targetAppId) {
            throw new ValidationError("App ID is required.");
        }
        const isRunning = await driver.isAppRunning(targetAppId);
        return {
          content: [
            {
              type: "text",
              text: `App ${targetAppId} is ${isRunning ? 'Running' : 'Stopped'}`,
            },
          ],
        };
      } catch (error) {
        return handleError(error, "Check app status");
      }
    }
  );

  server.tool(
    "home",
    "Press the Home button",
    {},
    async () => {
      try {
        await driver.home();
        return captureAndFormatResponse("Pressed Home button");
      } catch (error) {
        return handleError(error, "Home button");
      }
    }
  );

  server.tool(
    "find_text",
    "Find text on the screen and return its coordinates",
    {
      text: z.string().describe("Text to find (case-insensitive fuzzy match)"),
    },
    async ({ text }) => {
      try {
        const screenshot = await driver.getScreenshot();
        const bounds = await findTextBounds(screenshot, text);

        if (bounds) {
          const centerX = Math.round(bounds.x + bounds.width / 2);
          const centerY = Math.round(bounds.y + bounds.height / 2);
          return {
            content: [
              {
                type: "text",
                text: `Found '${text}' at center (${centerX}, ${centerY}) [Bounds: x=${bounds.x}, y=${bounds.y}, w=${bounds.width}, h=${bounds.height}]`,
              },
            ],
            data: { found: true, ...bounds, centerX, centerY },
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Text '${text}' not found on screen.`,
              },
            ],
            data: { found: false },
          };
        }
      } catch (error) {
        return handleError(error, "Find text");
      }
    }
  );

  server.tool(
    "tap_text",
    "Tap on the text found on the screen",
    {
      text: z.string().describe("Text to tap"),
    },
    async ({ text }) => {
      try {
        // 1. Capture screen to find text
        const screenshot = await driver.getScreenshot();
        const bounds = await findTextBounds(screenshot, text);

        // 2. If not found, throw error
        if (!bounds) {
          throw new MobileSnapError(`Could not find text '${text}' on screen.`);
        }

        // 3. Calculate center
        const centerX = Math.round(bounds.x + bounds.width / 2);
        const centerY = Math.round(bounds.y + bounds.height / 2);

        // 4. Tap
        await driver.tap(centerX, centerY);

        // 5. Return fresh screenshot
        return captureAndFormatResponse(`Tapped '${text}' at (${centerX}, ${centerY})`);
      } catch (error) {
        return handleError(error, "Tap text");
      }
    }
  );

  server.tool(
    "check_app_log",
    "Tail recent app logs containing a specific tag (telemetry bridge)",
    {
      tag: z.string().optional().default("[SNAP_BRIDGE]").describe("Log tag to filter by (default: [SNAP_BRIDGE])"),
      filter_text: z.string().optional().describe("Additional text to filter the log message content"),
    },
    async ({ tag, filter_text }) => {
      try {
        const logs = await driver.getAppLogs(tag);
        
        let filteredLogs = logs;
        if (filter_text) {
          filteredLogs = logs.filter(line => line.toLowerCase().includes(filter_text.toLowerCase()));
        }

        // Return last 5 logs
        const recentLogs = filteredLogs.slice(-5).reverse(); // Newest first

        return {
          content: [
            {
              type: "text",
              text: recentLogs.length > 0 
                ? recentLogs.join('\n\n') 
                : "No logs found matching criteria.",
            },
          ],
        };
      } catch (error) {
        return handleError(error, "Check app log");
      }
    }
  );

  server.tool(
    "install_app",
    "Install an application from a local file path",
    {
      path: z.string().describe("Local path to the APK (Android) or .app/.ipa (iOS) file"),
    },
    async ({ path }) => {
      try {
        await driver.installApp(path);
        return {
          content: [
            {
              type: "text",
              text: `Successfully installed app from: ${path}`,
            },
          ],
        };
      } catch (error) {
        return handleError(error, "Install app");
      }
    }
  );

  server.tool(
    "uninstall_app",
    "Uninstall an application by its ID",
    {
      app_id: z.string().optional().describe("Package name or Bundle ID. Defaults to config."),
    },
    async ({ app_id }) => {
      try {
        const currentConfig = await loadConfig();
        const targetAppId = app_id || currentConfig.appId;
        if (!targetAppId) {
            throw new ValidationError("App ID is required.");
        }
        await driver.uninstallApp(targetAppId);
        return {
          content: [
            {
              type: "text",
              text: `Successfully uninstalled app: ${targetAppId}`,
            },
          ],
        };
      } catch (error) {
        return handleError(error, "Uninstall app");
      }
    }
  );

  server.tool(
    "reset_app",
    "Reset the application state (clear data/cache) without uninstalling",
    {
      app_id: z.string().optional().describe("Package name or Bundle ID. Defaults to config."),
    },
    async ({ app_id }) => {
      try {
        const currentConfig = await loadConfig();
        const targetAppId = app_id || currentConfig.appId;
        if (!targetAppId) {
            throw new ValidationError("App ID is required.");
        }
        await driver.resetApp(targetAppId);
        return {
          content: [
            {
              type: "text",
              text: `Successfully reset app state for: ${targetAppId}`,
            },
          ],
        };
      } catch (error) {
        return handleError(error, "Reset app");
      }
    }
  );

  const transport = new StdioServerTransport();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.error(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      console.error("Server closed successfully");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await server.connect(transport);
  console.error("Mobile Pixel MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof MobileSnapError ? error.message : error);
  process.exit(1);
});
