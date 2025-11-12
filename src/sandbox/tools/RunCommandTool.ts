/**
 * RunCommandTool - Execute shell commands in sandboxed environment
 *
 * This tool provides shell command execution capabilities within a Cloudflare
 * Sandbox SDK environment. It supports command arguments, working directory
 * configuration, timeout control, and terminal preview URL generation.
 *
 * @module sandbox/tools/RunCommandTool
 */

import { z } from 'zod';
import type { Env } from '../../types';

/** Tool identifier for routing purposes */
export const TOOL_NAME = 'run-command';

/** Human-readable description of tool functionality */
export const TOOL_DESCRIPTION = 'Execute shell commands in a sandboxed environment';

/**
 * Zod schema defining the parameters for command execution
 *
 * @property command - Shell command to execute (e.g., 'ls', 'npm', 'python')
 * @property args - Optional array of command arguments
 * @property cwd - Optional working directory path
 * @property timeout - Execution timeout in milliseconds (default: 30000)
 */
export const TOOL_SCHEMA = z.object({
  command: z.string().describe('Shell command to execute'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  cwd: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
});

/**
 * Result object returned from command execution
 *
 * @interface CommandResult
 * @property stdout - Standard output from the command
 * @property stderr - Standard error output from the command
 * @property exitCode - Command exit code (0 for success, non-zero for failure)
 * @property executionTime - Duration of execution in milliseconds
 * @property sandboxSessionId - Unique identifier for the sandbox session
 * @property terminalPreviewUrl - Optional URL to view terminal output in browser
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  sandboxSessionId: string;
  terminalPreviewUrl?: string;
}

/**
 * Execute a shell command in a sandboxed environment
 *
 * This function creates an isolated sandbox session and executes the specified
 * command. If a userId is provided, it generates a terminal preview URL for
 * real-time monitoring of the command execution.
 *
 * @param params - Command parameters validated against TOOL_SCHEMA
 * @param env - Cloudflare Worker environment bindings
 * @param userId - Optional user identifier for terminal preview URL generation
 * @returns Promise resolving to CommandResult with execution details
 *
 * @example
 * ```typescript
 * const result = await execute(
 *   { command: 'npm', args: ['install'], cwd: '/project' },
 *   env,
 *   'user123'
 * );
 * console.log(result.stdout); // Installation output
 * ```
 */
export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env,
  userId?: string
): Promise<CommandResult> {
  const startTime = Date.now();
  const sandboxSessionId = crypto.randomUUID();

  try {
    // TODO: Replace with actual Cloudflare Sandbox SDK implementation
    // Production implementation would follow this pattern:
    //
    // import { createSandbox } from '@cloudflare/sandbox-sdk';
    // const sandbox = await createSandbox(env.SANDBOX_API_KEY);
    // const result = await sandbox.exec(params.command, {
    //   args: params.args,
    //   cwd: params.cwd,
    //   timeout: params.timeout
    // });

    // Simulated execution result for development and testing
    const result = {
      stdout: `Executed: ${params.command} ${params.args?.join(' ') || ''}`,
      stderr: '',
      exitCode: 0,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
      // Generate terminal preview URL if userId is provided
      terminalPreviewUrl: userId
        ? `https://containers.yourdomain.com/terminal/${userId}/${sandboxSessionId}`
        : undefined,
    };

    return result;
  } catch (error) {
    // Return error details in stderr while maintaining result structure
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
    };
  }
}
