// src/github/integration.ts
// GitHub API integration for folder/config creation

import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import type { Env } from '../types';

export const CreateFolderSchema = z.object({
  owner: z.string().describe('GitHub username or org'),
  repo: z.string().describe('Repository name'),
  folderName: z.string().describe('Folder name'),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ).describe('Files to create in the folder'),
  commitMessage: z.string().optional().default('Create config folder'),
  branch: z.string().optional().default('main'),
});

export type CreateFolderRequest = z.infer<typeof CreateFolderSchema>;

export interface CreateFolderResponse {
  success: boolean;
  url?: string;
  error?: string;
  filesCreated: string[];
}

/**
 * Create a folder with files in a GitHub repository
 */
export async function createGitHubFolder(
  request: CreateFolderRequest,
  token: string
): Promise<CreateFolderResponse> {
  const octokit = new Octokit({ auth: token });

  try {
    // Get the current commit SHA
    const { data: ref } = await octokit.git.getRef({
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
    });

    const currentCommitSha = ref.object.sha;

    // Get the tree SHA
    const { data: commit } = await octokit.git.getCommit({
      owner: request.owner,
      repo: request.repo,
      commit_sha: currentCommitSha,
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      request.files.map(async (file) => {
        const { data: blob } = await octokit.git.createBlob({
          owner: request.owner,
          repo: request.repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });

        return {
          path: `${request.folderName}/${file.path}`,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner: request.owner,
      repo: request.repo,
      base_tree: commit.tree.sha,
      tree: blobs,
    });

    // Create new commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner: request.owner,
      repo: request.repo,
      message: request.commitMessage,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Update reference
    await octokit.git.updateRef({
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
      sha: newCommit.sha,
    });

    const folderUrl = `https://github.com/${request.owner}/${request.repo}/tree/${request.branch}/${request.folderName}`;

    return {
      success: true,
      url: folderUrl,
      filesCreated: blobs.map(b => b.path),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      filesCreated: [],
    };
  }
}

/**
 * Save sandbox config as a GitHub folder
 */
export async function saveSandboxConfig(
  userId: string,
  configName: string,
  code: string,
  language: 'python' | 'javascript',
  token: string,
  owner: string,
  repo: string
): Promise<CreateFolderResponse> {
  const extension = language === 'python' ? 'py' : 'js';
  const files = [
    {
      path: `main.${extension}`,
      content: code,
    },
    {
      path: 'README.md',
      content: `# ${configName}\n\nGenerated sandbox configuration\n\nLanguage: ${language}\nCreated: ${new Date().toISOString()}`,
    },
    {
      path: 'config.json',
      content: JSON.stringify({
        name: configName,
        language,
        createdBy: userId,
        timestamp: Date.now(),
      }, null, 2),
    },
  ];

  return createGitHubFolder(
    {
      owner,
      repo,
      folderName: `configs/${configName}`,
      files,
      commitMessage: `Add sandbox config: ${configName}`,
      branch: 'main',
    },
    token
  );
}
