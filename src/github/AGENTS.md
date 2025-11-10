# GitHub Integration - AGENTS.md

## Purpose
Provides GitHub API integration for saving sandbox configurations and code snippets as organized folders in repositories.

## Key Functions

### createGitHubFolder()
Creates a folder with multiple files in a GitHub repository using the Git Trees API.

**Process:**
1. Get current commit SHA
2. Create blobs for each file
3. Create new tree with all blobs
4. Create commit pointing to new tree
5. Update branch reference

### saveSandboxConfig()
High-level function that saves a complete sandbox configuration:
- Main code file (`.py` or `.js`)
- README.md with metadata
- config.json with settings

**Example:**
```typescript
await saveSandboxConfig(
  'user123',
  'data-analysis',
  'import pandas as pd\\n...',
  'python',
  githubToken,
  'username',
  'sandbox-configs'
);
```

**Creates:**
```
repo/
└── configs/
    └── data-analysis/
        ├── main.py
        ├── README.md
        └── config.json
```

## API Schema

```typescript
interface CreateFolderRequest {
  owner: string;          // GitHub username/org
  repo: string;           // Repository name
  folderName: string;     // Folder to create
  files: Array<{
    path: string;         // Relative path
    content: string;      // File content
  }>;
  commitMessage?: string; // Default: "Create config folder"
  branch?: string;        // Default: "main"
}
```

## Authentication

Uses personal access tokens stored in user settings:
```typescript
const settings = await getUserSettings(userId, env);
if (!settings?.githubToken) {
  throw new Error('GitHub token not configured');
}
```

**Required Token Scopes:**
- `repo` (for private repos)
- `public_repo` (for public repos only)

## Dashboard Integration

```typescript
// Save button in dashboard
async function saveToGitHub() {
  const response = await fetch('/sandbox/configs/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user123',
      configName: 'my-analysis',
      code: editorContent,
      language: 'python',
      owner: 'username',
      repo: 'sandbox-configs',
    }),
  });

  const result = await response.json();
  console.log('Saved to:', result.url);
  // https://github.com/username/sandbox-configs/tree/main/configs/my-analysis
}
```

## Error Handling

All functions return structured responses:
```typescript
interface CreateFolderResponse {
  success: boolean;
  url?: string;           // GitHub folder URL
  error?: string;         // Error message
  filesCreated: string[]; // List of created file paths
}
```

## Maintenance Guidelines

1. **Token Management**: Never expose tokens in logs or responses
2. **Rate Limiting**: Implement retry logic for GitHub API limits
3. **Conflicts**: Handle merge conflicts gracefully
4. **Validation**: Validate repo access before attempting writes
5. **Cleanup**: Consider implementing delete/update operations

## Dependencies
- @octokit/rest (GitHub API client)
- User settings (for token storage)
- Zod (schema validation)

## Future Enhancements
- Support for updating existing folders
- Branch creation for new configs
- Pull request automation
- Conflict resolution UI
- Multi-file upload from sandbox filesystem
