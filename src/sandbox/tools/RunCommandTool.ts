// src/sandbox/tools/RunCommandTool.ts
// Execute shell commands in sandbox

import { z } from 'zod';
import type { Env } from '../../types';

export const TOOL_NAME = 'run-command';
export const TOOL_DESCRIPTION = 'Execute shell commands in a sandboxed environment';

export const TOOL_SCHEMA = z.object({
  command: z.string().describe('Shell command to execute'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  cwd: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
});

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  sandboxSessionId: string;
  terminalPreviewUrl?: string;
}

export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env,
  userId?: string
): Promise<CommandResult> {
  const startTime = Date.now();
  const sandboxSessionId = crypto.randomUUID();

  // In production, this would use Cloudflare Sandbox SDK
  // For now, we'll simulate the response structure

  try {
    // Simulated sandbox execution
    // In real implementation: const sandbox = await createSandbox(env.SANDBOX_API_KEY);
    // const result = await sandbox.exec(params.command, params.args);

    const result = {
      stdout: `Executed: ${params.command} ${params.args?.join(' ') || ''}`,
      stderr: '',
      exitCode: 0,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
      terminalPreviewUrl: userId
        ? `https://containers.yourdomain.com/terminal/${userId}/${sandboxSessionId}`
        : undefined,
    };

    return result;
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
    };
  }
}
