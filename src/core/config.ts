import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface MobileSnapConfig {
  platform?: 'android' | 'ios';
  deviceId?: string;
  appId?: string;
  mainActivity?: string;
}

export async function loadConfig(): Promise<MobileSnapConfig> {
  const configPath = join(process.cwd(), 'mobile-pixel.config.json');
  try {
    const fileContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    return config as MobileSnapConfig;
  } catch {
    // If file doesn't exist or is invalid, return empty config.
    // We could log a warning if it exists but is invalid, 
    // but for simplicity we'll just ignore errors for now.
    return {};
  }
}
