/**
 * GitHub Integration - Repository folder and configuration management
 *
 * This module provides GitHub API integration for creating folders with multiple
 * files atomically. It uses the Git Trees API to ensure all files are committed
 * together, preventing partial updates and race conditions.
 *
 * Key features:
 * - Atomic multi-file creation using Git Trees API
 * - Personal access token authentication
 * - Automated README and config.json generation
 * - Support for custom branches and commit messages
 * - Sandbox configuration persistence
 *
 * @module github/integration
 */

import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import type { Env } from '../types';

/**
 * Zod schema for folder creation requests
 *
 * Validates all parameters required for creating a folder with files
 * in a GitHub repository.
 *
 * @property owner - GitHub username or organization name
 * @property repo - Repository name (without owner prefix)
 * @property folderName - Name of the folder to create
 * @property files - Array of files with relative paths and content
 * @property commitMessage - Optional commit message (default: "Create config folder")
 * @property branch - Optional branch name (default: "main")
 */
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

/** TypeScript type inferred from CreateFolderSchema */
export type CreateFolderRequest = z.infer<typeof CreateFolderSchema>;

/**
 * Response object from folder creation operation
 *
 * @interface CreateFolderResponse
 * @property success - Whether the folder was successfully created
 * @property url - GitHub URL to the created folder
 * @property error - Error message if operation failed
 * @property filesCreated - Array of paths for all created files
 */
export interface CreateFolderResponse {
  success: boolean;
  url?: string;
  error?: string;
  filesCreated: string[];
}

/**
 * Create a folder with multiple files in a GitHub repository atomically
 *
 * This function uses the Git Trees API to create multiple files in a single
 * commit, ensuring atomicity. The process involves:
 * 1. Get current commit SHA
 * 2. Create blobs for each file
 * 3. Create a new tree with all blobs
 * 4. Create a new commit
 * 5. Update the branch reference
 *
 * All operations are atomic - either all files are created or none are.
 *
 * @param request - Folder creation request validated against CreateFolderSchema
 * @param token - GitHub personal access token with repo scope
 * @returns Promise resolving to CreateFolderResponse with folder URL
 *
 * @example
 * ```typescript
 * const result = await createGitHubFolder({
 *   owner: 'username',
 *   repo: 'my-repo',
 *   folderName: 'configs/my-config',
 *   files: [
 *     { path: 'main.py', content: 'print("hello")' },
 *     { path: 'README.md', content: '# My Config' }
 *   ],
 *   commitMessage: 'Add new config',
 *   branch: 'main'
 * }, 'ghp_token...');
 *
 * console.log(result.url);
 * // https://github.com/username/my-repo/tree/main/configs/my-config
 * ```
 */
export async function createGitHubFolder(
  request: CreateFolderRequest,
  token: string
): Promise<CreateFolderResponse> {
  const octokit = new Octokit({ auth: token });

  try {
    // Step 1: Get the current commit SHA for the target branch
    const { data: ref } = await octokit.git.getRef({
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
    });

    const currentCommitSha = ref.object.sha;

    // Step 2: Get the tree SHA from the current commit
    const { data: commit } = await octokit.git.getCommit({
      owner: request.owner,
      repo: request.repo,
      commit_sha: currentCommitSha,
    });

    // Step 3: Create blobs for each file in parallel
    // Each file content is base64 encoded before upload
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
          mode: '100644' as const, // Regular file mode
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // Step 4: Create new tree containing all blobs
    // base_tree ensures we don't lose existing files
    const { data: newTree } = await octokit.git.createTree({
      owner: request.owner,
      repo: request.repo,
      base_tree: commit.tree.sha,
      tree: blobs,
    });

    // Step 5: Create new commit pointing to the new tree
    const { data: newCommit } = await octokit.git.createCommit({
      owner: request.owner,
      repo: request.repo,
      message: request.commitMessage,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Step 6: Update branch reference to point to new commit
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
 * Save a sandbox configuration as a GitHub folder
 *
 * This convenience function wraps createGitHubFolder to persist sandbox
 * configurations with automatically generated supporting files. It creates:
 * - main.{ext}: The actual code file
 * - README.md: Documentation with metadata
 * - config.json: Structured configuration metadata
 *
 * All files are created under `configs/{configName}/` directory.
 *
 * @param userId - Identifier of the user creating the configuration
 * @param configName - Name for the configuration (used as folder name)
 * @param code - Source code content to save
 * @param language - Programming language (determines file extension)
 * @param token - GitHub personal access token with repo scope
 * @param owner - GitHub username or organization
 * @param repo - Repository name for saving the config
 * @returns Promise resolving to CreateFolderResponse with folder URL
 *
 * @example
 * ```typescript
 * const result = await saveSandboxConfig(
 *   'user123',
 *   'data-analysis',
 *   'import pandas as pd\ndf = pd.read_csv("data.csv")',
 *   'python',
 *   'ghp_token...',
 *   'username',
 *   'my-configs'
 * );
 *
 * console.log(result.url);
 * // https://github.com/username/my-configs/tree/main/configs/data-analysis
 * // Contains: main.py, README.md, config.json
 * ```
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
  // Determine file extension based on language
  const extension = language === 'python' ? 'py' : 'js';

  // Prepare all files for the configuration
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

  // Create the folder with all files atomically
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
