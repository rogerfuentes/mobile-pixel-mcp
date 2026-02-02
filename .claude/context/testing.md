# Testing Guidelines for Mobile Snap MCP

This document defines testing standards and best practices for the Mobile Snap MCP project.

## Testing Philosophy

### Core Principles

1. **Test Features, Not Functions** - Organize tests around business features and user-visible outcomes rather than individual functions.

2. **In-Memory Testing Pattern** - Test MCP servers directly in-memory without subprocess overhead. This eliminates network dependencies and race conditions.

3. **Deterministic Tests** - Avoid relying on external services or randomness. Mock external dependencies (ADB, IDB) for reliable, repeatable tests.

4. **Test the Contract** - Validate both technical correctness (tools return valid responses) and behavioral aspects (can AI models use tools effectively).

## Test Framework

We use **Vitest** for testing:
- Native ESM and TypeScript support (no extra configuration)
- Jest-compatible API for easy adoption
- Fast execution with watch mode
- Built-in mocking and assertions

### File Structure

```
src/
├── core/
│   ├── image.ts
│   └── image.test.ts        # Co-located unit tests
├── drivers/
│   ├── android.ts
│   └── android.test.ts
└── __tests__/               # Integration tests
    └── mcp-server.test.ts
```

## Test Categories

### 1. Unit Tests

Test individual functions in isolation with mocked dependencies.

**What to Test:**
- Image optimization (resize, compress, base64 encoding)
- Text escaping for ADB
- Error type construction
- Argument parsing

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { optimizeImage } from './image.js';

describe('optimizeImage', () => {
  it('should return base64 encoded string', async () => {
    const testBuffer = await createTestImage(100, 100);
    const result = await optimizeImage(testBuffer);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Validate it's valid base64
    expect(() => Buffer.from(result, 'base64')).not.toThrow();
  });

  it('should resize images larger than 1024px', async () => {
    const largeBuffer = await createTestImage(2000, 2000);
    const result = await optimizeImage(largeBuffer);
    const decoded = Buffer.from(result, 'base64');
    const metadata = await sharp(decoded).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1024);
    expect(metadata.height).toBeLessThanOrEqual(1024);
  });
});
```

### 2. Driver Tests (with Mocks)

Test driver methods with mocked `execa` calls.

**What to Test:**
- Correct command construction
- Error handling and error type mapping
- Device ID/UDID argument injection
- Response parsing

**Example:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidDriver } from './android.js';
import { execa } from 'execa';
import { DeviceActionError, ToolNotAvailableError } from '../core/errors.js';

vi.mock('execa');

describe('AndroidDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should throw ToolNotAvailableError when ADB is not installed', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('command not found'));

      await expect(AndroidDriver.create()).rejects.toThrow(ToolNotAvailableError);
    });

    it('should create driver when ADB is available', async () => {
      vi.mocked(execa).mockResolvedValueOnce({ stdout: 'Android Debug Bridge' });

      const driver = await AndroidDriver.create();
      expect(driver).toBeInstanceOf(AndroidDriver);
    });
  });

  describe('tap', () => {
    it('should call adb with correct coordinates', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'version' }) // ADB check
        .mockResolvedValueOnce({});                    // tap command

      const driver = await AndroidDriver.create();
      await driver.tap(100, 200);

      expect(execa).toHaveBeenCalledWith(
        'adb',
        ['shell', 'input', 'tap', '100', '200']
      );
    });

    it('should include device ID when specified', async () => {
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'version' })
        .mockResolvedValueOnce({ stdout: 'device123\tdevice' })
        .mockResolvedValueOnce({});

      const driver = await AndroidDriver.create('device123');
      await driver.tap(100, 200);

      expect(execa).toHaveBeenCalledWith(
        'adb',
        ['-s', 'device123', 'shell', 'input', 'tap', '100', '200']
      );
    });
  });
});
```

### 3. MCP Integration Tests

Test the complete MCP tool lifecycle including parameter validation, execution, and response formatting.

**What to Test:**
- Tool discovery (`listTools()` returns expected tools)
- Parameter validation (missing/invalid params)
- Response structure (text + image content)
- Error handling (returns proper error responses, not exceptions)

**Example:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP Server Integration', () => {
  let server: McpServer;

  beforeEach(async () => {
    // Mock driver for testing
    vi.mock('./drivers/android.js', () => ({
      AndroidDriver: {
        create: vi.fn().mockResolvedValue({
          getScreenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
          tap: vi.fn().mockResolvedValue(undefined),
          swipe: vi.fn().mockResolvedValue(undefined),
          inputText: vi.fn().mockResolvedValue(undefined),
          home: vi.fn().mockResolvedValue(undefined),
        }),
      },
    }));
  });

  it('should expose all required tools', async () => {
    const tools = await server.listTools();
    const toolNames = tools.map(t => t.name);

    expect(toolNames).toContain('get_screen');
    expect(toolNames).toContain('tap');
    expect(toolNames).toContain('swipe');
    expect(toolNames).toContain('type_text');
    expect(toolNames).toContain('home');
  });

  it('should return image content for screenshot', async () => {
    const result = await server.callTool('get_screen', {});

    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('text');
    expect(result.content[1].type).toBe('image');
    expect(result.content[1].mimeType).toBe('image/jpeg');
  });
});
```

## Mocking Strategy

### When to Mock

| Dependency | Mock? | Reason |
|------------|-------|--------|
| `execa` (ADB/IDB calls) | Yes | External process, non-deterministic |
| `sharp` | Partial | Use real Sharp but with synthetic images |
| File system | Yes | Avoid test pollution |
| MCP transport | Yes | Test in-memory, not stdio |

### How to Mock with Vitest

```typescript
import { vi } from 'vitest';
import { execa } from 'execa';

// At top of test file
vi.mock('execa');

// In test setup
vi.mocked(execa).mockResolvedValue({
  stdout: Buffer.from('fake-screenshot'),
  stderr: '',
  exitCode: 0,
});
```

## Error Testing

### Test All Error Scenarios

1. **Tool not available** - ADB/IDB not in PATH
2. **Device not connected** - No devices returned
3. **Action failed** - Shell command returns error
4. **Invalid parameters** - Zod validation failures

### Error Message Quality

Validate that error messages are specific and actionable:

```typescript
it('should provide actionable error message', async () => {
  vi.mocked(execa).mockRejectedValueOnce(new Error('device not found'));

  await expect(driver.tap(100, 200)).rejects.toThrow(
    /Failed to tap.*Ensure device is connected/
  );
});
```

## Test Data

### Creating Test Images

```typescript
import sharp from 'sharp';

async function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}
```

### Fixtures

Store reusable test data in `src/__fixtures__/`:
- Sample screenshots for image processing tests
- Mock command outputs for driver tests

## Coverage Requirements

| Metric | Minimum |
|--------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

Configure in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode (recommended during development)
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific file
npx vitest src/core/image.test.ts
```

## CI Integration

Tests should run on every pull request. Example GitHub Actions workflow:

```yaml
- name: Run tests
  run: npm test

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Best Practices Checklist

- [ ] Tests are deterministic (no flaky tests)
- [ ] Each test has a single assertion focus
- [ ] Test names describe the expected behavior
- [ ] Mocks are reset between tests (`beforeEach`)
- [ ] Error paths are tested, not just happy paths
- [ ] No hardcoded timeouts (use Vitest's built-in handling)
- [ ] Tests run in isolation (no shared state)

## References

- [Vitest Documentation](https://vitest.dev/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices)
- [MCP Testing Guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
