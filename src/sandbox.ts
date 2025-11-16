/**
 * Sandbox API Router - HTTP endpoints for sandbox and settings management
 *
 * This module provides a Hono-based router with RESTful endpoints for:
 * - LLM-routed sandbox tool execution
 * - User settings CRUD operations
 * - Natural language settings updates
 * - GitHub configuration persistence
 *
 * All endpoints return JSON responses and handle errors gracefully.
 *
 * @module sandbox
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { routeToTool } from './sandbox/ToolRouter';
import { getUserSettings, updateUserSettings, parseSettingsUpdate, sanitizeSettings } from './settings/storage';
import { saveSandboxConfig } from './github/integration';
import { z } from 'zod';

/**
 * Create and configure the sandbox API router
 *
 * Initializes a Hono app with all sandbox-related endpoints. The router
 * should be mounted at `/sandbox` in the main worker fetch handler.
 *
 * @returns Configured Hono app with all sandbox endpoints
 *
 * @example
 * ```typescript
 * // In main worker index.ts
 * import { createSandboxRouter } from './sandbox';
 *
 * if (url.pathname.startsWith('/sandbox')) {
 *   const sandboxApp = createSandboxRouter();
 *   return sandboxApp.fetch(request, env, ctx);
 * }
 * ```
 */
export function createSandboxRouter() {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * POST /execute - Execute code or commands via LLM tool routing
   *
   * Accepts natural language prompts and routes them to appropriate sandbox
   * tools using Workers AI for intent classification.
   *
   * Request body:
   * - prompt: Natural language description of desired action
   * - userId: Optional user identifier for personalization
   *
   * Response:
   * - tool: Name of the selected tool
   * - params: Extracted parameters
   * - result: Tool execution output
   * - confidence: LLM confidence score
   */
  app.post('/execute', async (c) => {
    try {
      const { prompt, userId } = await c.req.json();

      if (!prompt) {
        return c.json({ error: 'Missing prompt' }, 400);
      }

      const result = await routeToTool({ prompt, userId }, c.env);

      return c.json(result);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Execution failed' },
        500
      );
    }
  });

  /**
   * GET /settings/:userId - Retrieve user settings
   *
   * Fetches settings from KV storage for the specified user.
   *
   * URL parameters:
   * - userId: Unique user identifier
   *
   * Response:
   * - UserSettings object with all configuration values
   * - 404 if settings not found
   */
  app.get('/settings/:userId', async (c) => {
    const userId = c.req.param('userId');

    const settings = await getUserSettings(userId, c.env);

    if (!settings) {
      return c.json({ error: 'Settings not found' }, 404);
    }

    // SECURITY: Sanitize settings to remove sensitive fields (githubToken)
    return c.json(sanitizeSettings(settings));
  });

  /**
   * PUT /settings/:userId - Update user settings
   *
   * Performs partial update of user settings. Creates default settings
   * if user doesn't exist.
   *
   * URL parameters:
   * - userId: Unique user identifier
   *
   * Request body: Partial UserSettings object with fields to update
   *
   * Response: Complete updated UserSettings object
   */
  app.put('/settings/:userId', async (c) => {
    const userId = c.req.param('userId');
    const updates = await c.req.json();

    const settings = await updateUserSettings(userId, updates, c.env);

    // SECURITY: Sanitize settings to remove sensitive fields (githubToken)
    return c.json(sanitizeSettings(settings));
  });

  /**
   * POST /settings/:userId/parse - Update settings via natural language
   *
   * Parses natural language prompts and applies extracted settings changes.
   * Enables conversational settings management.
   *
   * URL parameters:
   * - userId: Unique user identifier
   *
   * Request body:
   * - prompt: Natural language description (e.g., "switch to dark theme")
   *
   * Response: Complete updated UserSettings object
   */
  app.post('/settings/:userId/parse', async (c) => {
    const userId = c.req.param('userId');
    const { prompt } = await c.req.json();

    if (!prompt) {
      return c.json({ error: 'Missing prompt' }, 400);
    }

    const settings = await parseSettingsUpdate(userId, prompt, c.env);

    // SECURITY: Sanitize settings to remove sensitive fields (githubToken)
    return c.json(sanitizeSettings(settings));
  });

  /**
   * POST /configs/save - Save sandbox configuration to GitHub
   *
   * Persists a sandbox configuration as a GitHub folder with generated
   * support files (README.md, config.json). Uses GitHub token from user
   * settings.
   *
   * Request body:
   * - userId: User identifier (for fetching GitHub token)
   * - configName: Name for the configuration
   * - code: Source code to save
   * - language: Programming language (python or javascript)
   * - owner: Optional GitHub username/org (uses user settings default)
   * - repo: Optional repository name (uses user settings default)
   *
   * Response: CreateFolderResponse with folder URL and created files
   */
  app.post('/configs/save', async (c) => {
    try {
      const { userId, configName, code, language, owner, repo } = await c.req.json();

      // Fetch user settings to get GitHub credentials
      const settings = await getUserSettings(userId, c.env);

      if (!settings?.githubToken) {
        return c.json({ error: 'GitHub token not configured' }, 400);
      }

      // Save configuration with fallbacks for owner and repo
      // Uses user's configured defaults if not explicitly provided
      const result = await saveSandboxConfig(
        userId,
        configName,
        code,
        language,
        settings.githubToken,
        owner || settings.githubUsername || userId, // Fallback chain for owner
        repo || settings.defaultRepo || 'sandbox-configs' // Fallback to default repo name
      );

      return c.json(result);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Save failed' },
        500
      );
    }
  });

  return app;
}
