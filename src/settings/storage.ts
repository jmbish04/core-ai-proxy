// src/settings/storage.ts
// KV-based user settings storage

import { z } from 'zod';
import type { Env } from '../types';

export const UserSettingsSchema = z.object({
  userId: z.string(),
  language: z.enum(['python', 'javascript']).default('python'),
  chartLibrary: z.enum(['recharts', 'chartjs', 'visx']).default('recharts'),
  theme: z.enum(['dark', 'light']).default('dark'),
  githubToken: z.string().optional(),
  githubUsername: z.string().optional(),
  defaultRepo: z.string().optional(),
  terminalPreviewEnabled: z.boolean().default(true),
  autoSave: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * Get user settings from KV
 */
export async function getUserSettings(userId: string, env: Env): Promise<UserSettings | null> {
  const key = `settings:${userId}`;
  const data = await env.SETTINGS_KV.get(key, 'json');

  if (!data) {
    return null;
  }

  return UserSettingsSchema.parse(data);
}

/**
 * Save user settings to KV
 */
export async function saveUserSettings(settings: UserSettings, env: Env): Promise<void> {
  const key = `settings:${settings.userId}`;
  settings.updatedAt = Date.now();

  await env.SETTINGS_KV.put(key, JSON.stringify(settings));
}

/**
 * Create default settings for a new user
 */
export async function createDefaultSettings(userId: string, env: Env): Promise<UserSettings> {
  const settings: UserSettings = {
    userId,
    language: 'python',
    chartLibrary: 'recharts',
    theme: 'dark',
    terminalPreviewEnabled: true,
    autoSave: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveUserSettings(settings, env);
  return settings;
}

/**
 * Update specific settings fields
 */
export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'userId' | 'createdAt'>>,
  env: Env
): Promise<UserSettings> {
  let settings = await getUserSettings(userId, env);

  if (!settings) {
    settings = await createDefaultSettings(userId, env);
  }

  const updated = { ...settings, ...updates, updatedAt: Date.now() };
  await saveUserSettings(updated, env);

  return updated;
}

/**
 * Parse natural language settings updates
 */
export async function parseSettingsUpdate(
  userId: string,
  prompt: string,
  env: Env
): Promise<UserSettings> {
  const lower = prompt.toLowerCase();
  const updates: Partial<UserSettings> = {};

  // Language updates
  if (lower.includes('python')) updates.language = 'python';
  if (lower.includes('javascript') || lower.includes('js')) updates.language = 'javascript';

  // Chart library updates
  if (lower.includes('recharts')) updates.chartLibrary = 'recharts';
  if (lower.includes('chartjs') || lower.includes('chart.js')) updates.chartLibrary = 'chartjs';
  if (lower.includes('visx')) updates.chartLibrary = 'visx';

  // Theme updates
  if (lower.includes('dark')) updates.theme = 'dark';
  if (lower.includes('light')) updates.theme = 'light';

  // Boolean settings
  if (lower.includes('enable terminal')) updates.terminalPreviewEnabled = true;
  if (lower.includes('disable terminal')) updates.terminalPreviewEnabled = false;
  if (lower.includes('enable autosave') || lower.includes('enable auto save')) updates.autoSave = true;
  if (lower.includes('disable autosave') || lower.includes('disable auto save')) updates.autoSave = false;

  return updateUserSettings(userId, updates, env);
}
