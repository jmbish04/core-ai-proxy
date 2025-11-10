// src/sandbox.ts
// Sandbox API routes

import { Hono } from 'hono';
import type { Env } from './types';
import { routeToTool } from './sandbox/ToolRouter';
import { getUserSettings, updateUserSettings, parseSettingsUpdate } from './settings/storage';
import { saveSandboxConfig } from './github/integration';
import { z } from 'zod';

export function createSandboxRouter() {
  const app = new Hono<{ Bindings: Env }>();

  // Execute code/command via ToolRouter
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

  // Get user settings
  app.get('/settings/:userId', async (c) => {
    const userId = c.req.param('userId');

    const settings = await getUserSettings(userId, c.env);

    if (!settings) {
      return c.json({ error: 'Settings not found' }, 404);
    }

    return c.json(settings);
  });

  // Update user settings
  app.put('/settings/:userId', async (c) => {
    const userId = c.req.param('userId');
    const updates = await c.req.json();

    const settings = await updateUserSettings(userId, updates, c.env);

    return c.json(settings);
  });

  // Update settings via natural language
  app.post('/settings/:userId/parse', async (c) => {
    const userId = c.req.param('userId');
    const { prompt } = await c.req.json();

    if (!prompt) {
      return c.json({ error: 'Missing prompt' }, 400);
    }

    const settings = await parseSettingsUpdate(userId, prompt, c.env);

    return c.json(settings);
  });

  // Save config to GitHub
  app.post('/configs/save', async (c) => {
    try {
      const { userId, configName, code, language, owner, repo } = await c.req.json();

      // Get user's GitHub token from settings
      const settings = await getUserSettings(userId, c.env);

      if (!settings?.githubToken) {
        return c.json({ error: 'GitHub token not configured' }, 400);
      }

      const result = await saveSandboxConfig(
        userId,
        configName,
        code,
        language,
        settings.githubToken,
        owner || settings.githubUsername || userId,
        repo || settings.defaultRepo || 'sandbox-configs'
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
