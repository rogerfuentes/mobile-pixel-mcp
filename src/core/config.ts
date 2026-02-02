import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const CONFIG_FILE_NAME = 'mobile-pixel.config.json';

export interface MobileSnapConfig {
  platform?: 'android' | 'ios' | 'auto';
  deviceId?: string;
  appId?: string;
  mainActivity?: string;
}

export async function loadConfig(): Promise<MobileSnapConfig> {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME);
  try {
    const fileContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    return config as MobileSnapConfig;
  } catch {
    return { platform: 'auto' };
  }
}

export async function saveConfig(config: MobileSnapConfig): Promise<void> {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME);
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function ensureConfig(): Promise<void> {
  const configPath = join(process.cwd(), CONFIG_FILE_NAME);
  if (!existsSync(configPath)) {
    await saveConfig({ platform: 'auto' });
  }
}
