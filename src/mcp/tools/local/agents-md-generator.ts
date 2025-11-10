// src/mcp/tools/local/agents-md-generator.ts
// Generates AGENTS.md documentation for a GitHub repository

import { z } from 'zod';
import type { Env } from '../../../types';
import { generateText } from '../../../utils/ai';
import { initDb } from '../../../db/client';
import * as schema from '../../../db/schema';

export const TOOL_NAME = 'agents-md-generator';
export const TOOL_DESCRIPTION = 'Generates AGENTS.md documentation for a GitHub repository';

export const TOOL_SCHEMA = z.object({
  repo_url: z.string().url(),
  dry_run: z.boolean().optional().default(false),
  pr_url: z.string().url().optional(),
});

interface AgentsMdResult {
  agents_md: string;
  sources: string[];
  dry_run_preview_url?: string;
}

export async function execute(
  params: z.infer<typeof TOOL_SCHEMA>,
  env: Env
): Promise<AgentsMdResult> {
  const { repo_url, dry_run, pr_url } = params;

  // Extract repo owner and name from URL
  const repoMatch = repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!repoMatch) {
    throw new Error('Invalid GitHub repository URL');
  }

  const [, owner, repo] = repoMatch;

  // Simulate reading repository files
  // In a real implementation, this would use the GitHub MCP tool
  const sourceFiles = [
    'README.md',
    'package.json',
    'src/index.ts',
    'src/types.ts',
  ];

  // Generate AGENTS.md using AI
  const prompt = `You are analyzing a GitHub repository: ${owner}/${repo}

Based on the following files, generate a comprehensive AGENTS.md file that documents:
1. The purpose of the repository
2. Key architecture components
3. How AI agents should interact with this codebase
4. Important patterns and conventions

Files analyzed: ${sourceFiles.join(', ')}

Generate the AGENTS.md content in markdown format:`;

  const agentsMdContent = await generateText(
    env.AI,
    '@cf/meta/llama-3-8b-instruct',
    prompt,
    { max_tokens: 2000, temperature: 0.5 }
  );

  // Store generation in database
  const generationId = crypto.randomUUID();
  const { drizzle: db } = initDb(env.DB);

  await db.insert(schema.agent_generations).values({
    id: generationId,
    repo_url,
    pr_url: pr_url || null,
    is_dry_run: dry_run,
    agents_md_content: agentsMdContent,
    sources: sourceFiles,
    created_at: new Date(),
  });

  const result: AgentsMdResult = {
    agents_md: agentsMdContent,
    sources: sourceFiles,
  };

  if (dry_run) {
    result.dry_run_preview_url = `/agents-preview.html?id=${generationId}`;
  }

  return result;
}