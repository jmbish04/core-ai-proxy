// src/sandbox/tools/ExecuteCodeTool.ts
// Execute Python or JavaScript code in sandbox

import { z } from 'zod';
import type { Env } from '../../types';

export const TOOL_NAME = 'execute-code';
export const TOOL_DESCRIPTION = 'Execute Python or JavaScript code in a sandboxed environment';

export const TOOL_SCHEMA = z.object({
  code: z.string().describe('Code to execute'),
  language: z.enum(['python', 'javascript']).describe('Programming language'),
  context: z.string().optional().describe('Context ID for persistent interpreter'),
  packages: z.array(z.string()).optional().describe('Required packages'),
});

export interface CodeResult {
  output: string;
  error?: string;
  contextId?: string;
  executionTime: number;
  sandboxSessionId: string;
  terminalPreviewUrl?: string;
}

export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env,
  userId?: string
): Promise<CodeResult> {
  const startTime = Date.now();
  const sandboxSessionId = params.context || crypto.randomUUID();

  try {
    // In real implementation:
    // const sandbox = await createSandbox(env.SANDBOX_API_KEY);
    // const context = params.context
    //   ? await sandbox.getCodeContext(params.context)
    //   : await sandbox.createCodeContext(params.language);
    // const result = await context.runCode(params.code);

    const result: CodeResult = {
      output: `Code executed successfully in ${params.language}`,
      contextId: sandboxSessionId,
      executionTime: Date.now() - startTime,
      sandboxSessionId,
      terminalPreviewUrl: userId
        ? `https://containers.yourdomain.com/terminal/${userId}/${sandboxSessionId}`
        : undefined,
    };

    return result;
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Execution failed',
      executionTime: Date.now() - startTime,
      sandboxSessionId,
    };
  }
}
