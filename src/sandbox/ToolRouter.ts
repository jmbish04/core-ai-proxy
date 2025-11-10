// src/sandbox/ToolRouter.ts
// LLM-based intent classification and tool routing

import { z } from 'zod';
import type { Env } from '../types';
import { generateText } from '../utils/ai';

import * as RunCommandTool from './tools/RunCommandTool';
import * as ExecuteCodeTool from './tools/ExecuteCodeTool';
import * as FileOpsTool from './tools/FileOpsTool';
import * as PreviewServiceTool from './tools/PreviewServiceTool';

const TOOLS = [
  { name: RunCommandTool.TOOL_NAME, description: RunCommandTool.TOOL_DESCRIPTION, handler: RunCommandTool.execute },
  { name: ExecuteCodeTool.TOOL_NAME, description: ExecuteCodeTool.TOOL_DESCRIPTION, handler: ExecuteCodeTool.execute },
  { name: FileOpsTool.TOOL_NAME, description: FileOpsTool.TOOL_DESCRIPTION, handler: FileOpsTool.execute },
  { name: PreviewServiceTool.TOOL_NAME, description: PreviewServiceTool.TOOL_DESCRIPTION, handler: PreviewServiceTool.execute },
];

export interface ToolRouterRequest {
  prompt: string;
  userId?: string;
}

export interface ToolRouterResponse {
  tool: string;
  params: unknown;
  result: unknown;
  confidence: number;
}

/**
 * Classify user intent and route to appropriate sandbox tool
 */
export async function routeToTool(
  request: ToolRouterRequest,
  env: Env
): Promise<ToolRouterResponse> {
  // Use LLM to classify intent
  const classificationPrompt = `You are a tool routing assistant. Given a user prompt, determine which tool to use and extract parameters.

Available tools:
${TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

User prompt: "${request.prompt}"

Respond with JSON only:
{
  "tool": "tool-name",
  "params": {...},
  "confidence": 0.95,
  "reasoning": "why this tool"
}`;

  const classification = await generateText(
    env.AI,
    '@cf/meta/llama-3-8b-instruct',
    classificationPrompt,
    { max_tokens: 500, temperature: 0.3 }
  );

  // Parse classification
  let toolChoice: { tool: string; params: unknown; confidence: number };
  try {
    const jsonMatch = classification.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      toolChoice = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON in response');
    }
  } catch {
    // Fallback: try to match keywords
    toolChoice = fallbackClassification(request.prompt);
  }

  // Execute the selected tool
  const tool = TOOLS.find(t => t.name === toolChoice.tool);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolChoice.tool}`);
  }

  const result = await tool.handler(toolChoice.params as never, env, request.userId);

  return {
    tool: toolChoice.tool,
    params: toolChoice.params,
    result,
    confidence: toolChoice.confidence,
  };
}

/**
 * Fallback classification using keyword matching
 */
function fallbackClassification(prompt: string): { tool: string; params: unknown; confidence: number } {
  const lower = prompt.toLowerCase();

  if (lower.includes('run') || lower.includes('execute command') || lower.includes('shell')) {
    return {
      tool: 'run-command',
      params: { command: prompt.split(' ').slice(1).join(' ') },
      confidence: 0.6,
    };
  }

  if (lower.includes('code') || lower.includes('python') || lower.includes('script')) {
    const language = lower.includes('python') ? 'python' : 'javascript';
    return {
      tool: 'execute-code',
      params: { code: prompt, language },
      confidence: 0.6,
    };
  }

  if (lower.includes('file') || lower.includes('read') || lower.includes('write')) {
    return {
      tool: 'file-ops',
      params: { operation: 'list', path: '/' },
      confidence: 0.5,
    };
  }

  // Default to execute-code
  return {
    tool: 'execute-code',
    params: { code: prompt, language: 'python' },
    confidence: 0.3,
  };
}
