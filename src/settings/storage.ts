/**
 * Settings Storage - KV-based user settings persistence
 *
 * This module provides comprehensive user settings management using Cloudflare
 * KV storage. It supports schema validation, default settings creation, partial
 * updates, and natural language parsing for settings modifications.
 *
 * Features:
 * - Zod schema validation for type safety
 * - Atomic read/write operations
 * - Default settings initialization
 * - Natural language parsing ("switch to dark theme")
 * - Per-user settings isolation
 *
 * @module settings/storage
 */

import { z } from 'zod';
import type { Env } from '../types';

/**
 * Zod schema for user settings validation
 *
 * Defines the complete settings structure with type validation and defaults.
 * All settings are scoped to individual users via userId.
 *
 * @property userId - Unique user identifier
 * @property language - Preferred code execution language (python or javascript)
 * @property chartLibrary - Chart rendering library for data visualization
 * @property theme - UI theme preference (dark or light)
 * @property githubToken - Personal access token for GitHub operations
 * @property githubUsername - GitHub username for repository operations
 * @property defaultRepo - Default repository for config saves
 * @property terminalPreviewEnabled - Whether to generate terminal preview URLs
 * @property autoSave - Automatically save configs to GitHub
 * @property createdAt - Unix timestamp of settings creation
 * @property updatedAt - Unix timestamp of last settings update
 */
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

/** TypeScript type inferred from UserSettingsSchema */
export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * Retrieve user settings from KV storage
 *
 * Fetches settings for a specific user and validates them against the schema.
 * Returns null if no settings exist for the user.
 *
 * @param userId - Unique identifier for the user
 * @param env - Cloudflare Worker environment with SETTINGS_KV binding
 * @returns Promise resolving to UserSettings or null if not found
 *
 * @example
 * ```typescript
 * const settings = await getUserSettings('user123', env);
 * if (settings) {
 *   console.log(settings.theme); // 'dark' or 'light'
 * }
 * ```
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
 * Save user settings to KV storage
 *
 * Persists settings to KV and automatically updates the updatedAt timestamp.
 * Settings are stored under the key pattern: `settings:{userId}`
 *
 * @param settings - Complete UserSettings object to save
 * @param env - Cloudflare Worker environment with SETTINGS_KV binding
 * @returns Promise that resolves when save is complete
 *
 * @example
 * ```typescript
 * const settings: UserSettings = {
 *   userId: 'user123',
 *   language: 'python',
 *   theme: 'dark',
 *   // ... other fields
 * };
 * await saveUserSettings(settings, env);
 * ```
 */
export async function saveUserSettings(settings: UserSettings, env: Env): Promise<void> {
  const key = `settings:${settings.userId}`;
  // Automatically update the modification timestamp
  settings.updatedAt = Date.now();

  await env.SETTINGS_KV.put(key, JSON.stringify(settings));
}

/**
 * Create default settings for a new user
 *
 * Initializes a new user with default settings values and persists them
 * to KV storage. This is typically called when a user first accesses the
 * system.
 *
 * @param userId - Unique identifier for the new user
 * @param env - Cloudflare Worker environment with SETTINGS_KV binding
 * @returns Promise resolving to the created UserSettings
 *
 * @example
 * ```typescript
 * const newUserSettings = await createDefaultSettings('user123', env);
 * // Returns settings with: language='python', theme='dark', etc.
 * ```
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
 * Update specific settings fields for a user
 *
 * Performs a partial update of user settings, merging the provided updates
 * with existing settings. If no settings exist for the user, creates default
 * settings first. The updatedAt timestamp is automatically updated.
 *
 * @param userId - Unique identifier for the user
 * @param updates - Partial settings object with fields to update
 * @param env - Cloudflare Worker environment with SETTINGS_KV binding
 * @returns Promise resolving to complete updated UserSettings
 *
 * @example
 * ```typescript
 * // Update only theme
 * const updated = await updateUserSettings('user123', { theme: 'light' }, env);
 *
 * // Update multiple fields
 * const updated = await updateUserSettings('user123', {
 *   language: 'javascript',
 *   chartLibrary: 'visx',
 *   autoSave: true
 * }, env);
 * ```
 */
export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'userId' | 'createdAt'>>,
  env: Env
): Promise<UserSettings> {
  // Fetch existing settings or create defaults for new users
  let settings = await getUserSettings(userId, env);

  if (!settings) {
    settings = await createDefaultSettings(userId, env);
  }

  // Merge updates with existing settings and update timestamp
  const updated = { ...settings, ...updates, updatedAt: Date.now() };
  await saveUserSettings(updated, env);

  return updated;
}

/**
 * Parse and apply settings updates from natural language
 *
 * Extracts settings changes from a natural language prompt and applies them.
 * This enables conversational settings management without requiring structured
 * API calls.
 *
 * Supported patterns:
 * - Language: "switch to python", "use javascript"
 * - Theme: "switch to dark mode", "enable light theme"
 * - Chart library: "use recharts", "switch to visx"
 * - Boolean settings: "enable autosave", "disable terminal preview"
 *
 * @param userId - Unique identifier for the user
 * @param prompt - Natural language description of desired changes
 * @param env - Cloudflare Worker environment with SETTINGS_KV binding
 * @returns Promise resolving to updated UserSettings
 *
 * @example
 * ```typescript
 * // Natural language examples
 * await parseSettingsUpdate('user123', 'switch to dark theme', env);
 * await parseSettingsUpdate('user123', 'use python and enable autosave', env);
 * await parseSettingsUpdate('user123', 'change chart library to visx', env);
 * ```
 */
export async function parseSettingsUpdate(
  userId: string,
  prompt: string,
  env: Env
): Promise<UserSettings> {
  const lower = prompt.toLowerCase();
  const updates: Partial<UserSettings> = {};

  // Extract language preference
  if (lower.includes('python')) updates.language = 'python';
  if (lower.includes('javascript') || lower.includes('js')) updates.language = 'javascript';

  // Extract chart library preference
  if (lower.includes('recharts')) updates.chartLibrary = 'recharts';
  if (lower.includes('chartjs') || lower.includes('chart.js')) updates.chartLibrary = 'chartjs';
  if (lower.includes('visx')) updates.chartLibrary = 'visx';

  // Extract theme preference
  if (lower.includes('dark')) updates.theme = 'dark';
  if (lower.includes('light')) updates.theme = 'light';

  // Extract boolean setting changes
  if (lower.includes('enable terminal')) updates.terminalPreviewEnabled = true;
  if (lower.includes('disable terminal')) updates.terminalPreviewEnabled = false;
  if (lower.includes('enable autosave') || lower.includes('enable auto save')) updates.autoSave = true;
  if (lower.includes('disable autosave') || lower.includes('disable auto save')) updates.autoSave = false;

  // Apply extracted updates
  return updateUserSettings(userId, updates, env);
}
