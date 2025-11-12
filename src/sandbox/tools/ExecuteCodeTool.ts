/**
 * ExecuteCodeTool - Execute Python or JavaScript code with persistent context
 *
 * This tool provides code execution capabilities in Python and JavaScript with
 * support for persistent interpreter contexts. This allows for incremental code
 * execution where variables, imports, and state persist across multiple executions.
 *
 * Use cases:
 * - Data analysis with incremental results
 * - Interactive REPL-like experiences
 * - Multi-step computations that build on previous results
 *
 * @module sandbox/tools/ExecuteCodeTool
 */

import { z } from 'zod';
import type { Env } from '../../types';

/** Tool identifier for routing purposes */
export const TOOL_NAME = 'execute-code';

/** Human-readable description of tool functionality */
export const TOOL_DESCRIPTION = 'Execute Python or JavaScript code in a sandboxed environment';

/**
 * Zod schema defining the parameters for code execution
 *
 * @property code - Source code to execute
 * @property language - Programming language (python or javascript)
 * @property context - Optional context ID for persistent interpreter session
 * @property packages - Optional array of packages to install before execution
 */
export const TOOL_SCHEMA = z.object({
  code: z.string().describe('Code to execute'),
  language: z.enum(['python', 'javascript']).describe('Programming language'),
  context: z.string().optional().describe('Context ID for persistent interpreter'),
  packages: z.array(z.string()).optional().describe('Required packages'),
});

/**
 * Result object returned from code execution
 *
 * @interface CodeResult
 * @property output - Standard output from code execution
 * @property error - Error message if execution failed
 * @property contextId - Context identifier for persistent interpreter session
 * @property executionTime - Duration of execution in milliseconds
 * @property sandboxSessionId - Unique identifier for the sandbox session
 * @property terminalPreviewUrl - Optional URL to view execution in browser
 */
export interface CodeResult {
  output: string;
  error?: string;
  contextId?: string;
  executionTime: number;
  sandboxSessionId: string;
  terminalPreviewUrl?: string;
}

/**
 * Execute Python or JavaScript code in a sandboxed environment
 *
 * This function executes code in an isolated sandbox with optional persistent
 * context. When a context ID is provided, the interpreter state persists across
 * multiple executions, allowing for incremental code execution.
 *
 * @param params - Code execution parameters validated against TOOL_SCHEMA
 * @param env - Cloudflare Worker environment bindings
 * @param userId - Optional user identifier for terminal preview URL generation
 * @returns Promise resolving to CodeResult with execution output
 *
 * @example
 * ```typescript
 * // First execution - create context
 * const result1 = await execute({
 *   code: 'x = 42',
 *   language: 'python'
 * }, env, 'user123');
 *
 * // Second execution - reuse context
 * const result2 = await execute({
 *   code: 'print(x)',  // x is still available
 *   language: 'python',
 *   context: result1.contextId
 * }, env, 'user123');
 * // Output: "42"
 * ```
 */
export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env,
  userId?: string
): Promise<CodeResult> {
  const startTime = Date.now();
  // Reuse existing context ID or generate new one for session
  const sandboxSessionId = params.context || crypto.randomUUID();

  try {
    // TODO: Replace with actual Cloudflare Sandbox SDK implementation
    // Production implementation would follow this pattern:
    //
    // import { createSandbox } from '@cloudflare/sandbox-sdk';
    // const sandbox = await createSandbox(env.SANDBOX_API_KEY);
    //
    // // Retrieve existing context or create new one
    // const context = params.context
    //   ? await sandbox.getCodeContext(params.context)
    //   : await sandbox.createCodeContext(params.language);
    //
    // // Install packages if specified
    // if (params.packages?.length) {
    //   await context.installPackages(params.packages);
    // }
    //
    // // Execute code and capture output
    // const result = await context.runCode(params.code);

    // Simulated execution result for development and testing
    const result: CodeResult = {
      output: `Code executed successfully in ${params.language}`,
      contextId: sandboxSessionId,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
      // Generate terminal preview URL if userId is provided
      terminalPreviewUrl: userId
        ? `https://containers.yourdomain.com/terminal/${userId}/${sandboxSessionId}`
        : undefined,
    };

    return result;
  } catch (error) {
    // Return error details while maintaining result structure
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Execution failed',
      executionTime: Date.now() - startTime,
      sandboxSessionId,
    };
  }
}
