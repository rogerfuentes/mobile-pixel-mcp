Mobile Pixel MCP — Architecture & Rules

## 1. Project Mission & Philosophy

**"Mobile Pixel"** is a lightweight, visual-first Model Context Protocol (MCP) server for mobile automation.

- **Visual-First:** We rely on **Screenshots** + **Coordinates**, not XML View Hierarchies.

- **Speed:** We prefer "dumb and fast" native tools (ADB/IDB) over "smart and heavy" drivers (Appium).

- **The Loop:** Every action (Tap/Swipe) **must** return an immediate visual confirmation (Screenshot) to the LLM.

## 2. Tech Stack & Infrastructure

- **Runtime:** Node.js (Latest LTS)

- **Language:** TypeScript (Strict Mode)

- **Execution:** tsx (no build step for dev)

- **Package Manager:** npm (standard) or pnpm.

- **Core Libraries:**
  - @modelcontextprotocol/sdk: MCP implementation.

  - execa: For robust, async shell command execution.

  - sharp: High-performance C++ image resizing/compression.

  - zod: Schema validation for tool arguments.

## 3. Architecture Layers

The codebase must adhere to strictly separated layers:

### A. Interface Layer (src/index.ts)

- Defines the MCP Tools (get_screen, tap, swipe, etc.).

- Handles the "Snap Loop": Calls the driver action -> Calls image optimizer -> Returns composed result to Claude.

- **Rule:** This layer never calls shell commands directly.

### B. Abstraction Layer (src/core/driver.ts)

- Defines the DeviceDriver interface.

- All methods return Promise<void> or Promise<Buffer>.

- **Rule:** This interface allows us to swap Android for iOS without changing the MCP logic.

### C. Implementation Layer (src/drivers/)

- **Android (src/drivers/android.ts):** Wraps adb.

- **iOS (src/drivers/ios.ts):** Wraps idb (Facebook IDB) or xcrun.

- **Rule:** Use execa here. Handle specific CLI quirks (e.g., ADB scroll inertia) inside these files.

### D. Utility Layer (src/core/)

- **Image (src/core/image.ts):** Handles sharp logic.

- **Errors (src/core/errors.ts):** Custom error types (DeviceConnectionError, DeviceActionError, etc.).

- **Rule:** Always resize images to max 1024px (longest edge) and compress to JPEG quality: 80 before returning base64.

## 4. Coding Standards & Best Practices

### Performance Rules

1. **No Disk I/O for Screenshots:**
   - Android: Use adb exec-out screencap -p to stream bytes directly to stdout. Do not save to /sdcard/.

   - iOS: Use idb screenshot piped to buffer.

2. **Inertia Control:**
   - Native swipes create momentum (fling).

   - **Rule:** All swipe commands must default to a duration of **1000ms** (slow drag) unless specified otherwise, to ensure precision.

3. **Process Management:**
   - Use execa with { encoding: 'buffer' } for binary data.

   - Use execa with { encoding: 'utf8' } for text data.

⠀

### Error Handling

- If a device is disconnected, throw a clear DeviceConnectionError.

- If an action fails (e.g., tap out of bounds), catch the shell error and return a descriptive message to the LLM, but **do not crash the server**.

### Typing

- No any. Define Zod schemas for all Tool Inputs.

- Drivers must strictly implement the DeviceDriver interface.

## 5. The "Snap" Protocol (Tool Behavior)

When defining MCP Tools, follow this return pattern:

- **Read-Only Tools (get_screen):**
  - Return: [ { type: "image", data: "..." } ]

- **Action Tools (tap, swipe, type):**
  - **Step 1:** Execute Action.

  - **Step 2:** Wait (small buffer if needed).

  - **Step 3:** Capture Screenshot.

  - **Step 4:** Return: [ { type: "text", text: "Tapped at..." }, { type: "image", data: "..." } ]

## 6. Testing

For comprehensive testing guidelines, see [.claude/context/testing.md](.claude/context/testing.md).

### Quick Reference

- **Framework:** Vitest (native ESM/TypeScript support)
- **Strategy:** Unit tests for utilities, mocked integration tests for drivers
- **Coverage:** Minimum 80% statements, 75% branches

### Test Commands

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Key Rules

1. **Mock External Dependencies:** Always mock `execa` calls to ADB/IDB
2. **Test Error Paths:** Every error type must have corresponding test cases
3. **Deterministic Tests:** No flaky tests, no external dependencies
4. **In-Memory MCP Testing:** Test MCP tools without subprocess overhead
