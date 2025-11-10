// src/sandbox/tools/PreviewServiceTool.ts
// Expose services via sandbox preview

import { z } from 'zod';
import type { Env } from '../../types';

export const TOOL_NAME = 'preview-service';
export const TOOL_DESCRIPTION = 'Expose a service (e.g., web server) via sandbox preview';

export const TOOL_SCHEMA = z.object({
  port: z.number().int().min(1).max(65535).describe('Port to expose'),
  command: z.string().describe('Command to start the service'),
  autoRestart: z.boolean().optional().default(false),
});

export interface PreviewServiceResult {
  success: boolean;
  previewUrl?: string;
  sandboxSessionId: string;
  error?: string;
}

export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env,
  userId?: string
): Promise<PreviewServiceResult> {
  const sandboxSessionId = crypto.randomUUID();

  try {
    // In real implementation:
    // const sandbox = await createSandbox(env.SANDBOX_API_KEY);
    // await sandbox.spawn(params.command);
    // const previewUrl = await sandbox.expose(params.port);

    const previewUrl = `https://preview-${sandboxSessionId}.containers.yourdomain.com`;

    return {
      success: true,
      previewUrl,
      sandboxSessionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to expose service',
      sandboxSessionId,
    };
  }
}
