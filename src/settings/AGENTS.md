# Settings Storage - AGENTS.md

## Purpose
KV-based persistent storage for user preferences and configuration. Supports both API-based updates and natural language parsing for settings changes.

## Storage Schema

```typescript
interface UserSettings {
  userId: string;
  language: 'python' | 'javascript';
  chartLibrary: 'recharts' | 'chartjs' | 'visx';
  theme: 'dark' | 'light';
  githubToken?: string;
  githubUsername?: string;
  defaultRepo?: string;
  terminalPreviewEnabled: boolean;
  autoSave: boolean;
  createdAt: number;
  updatedAt: number;
}
```

## Key Functions

### getUserSettings()
Retrieves settings from KV for a specific user.

### saveUserSettings()
Persists settings to KV with automatic timestamp update.

### createDefaultSettings()
Initializes new user with sensible defaults.

### updateUserSettings()
Partial update of settings fields.

### parseSettingsUpdate()
**Natural Language Processing** - allows settings changes via prompts:
- "Switch to Python" → `language: 'python'`
- "Use dark theme" → `theme: 'dark'`
- "Enable terminal preview" → `terminalPreviewEnabled: true`

## Usage Examples

### API-Based Update
```typescript
await updateUserSettings('user123', {
  language: 'python',
  chartLibrary: 'recharts',
}, env);
```

### Natural Language Update
```typescript
const updated = await parseSettingsUpdate(
  'user123',
  'Switch to dark theme and use Recharts',
  env
);
// Result: { theme: 'dark', chartLibrary: 'recharts', ... }
```

### Dashboard Integration
```typescript
// Settings form submission
const response = await fetch(`/sandbox/settings/${userId}`, {
  method: 'PUT',
  body: JSON.stringify(updates),
});
```

## KV Binding

Configured in wrangler.toml:
```toml
[[kv_namespaces]]
binding = "SETTINGS_KV"
id = "..."
```

## Security

- GitHub tokens are stored but never returned in API responses (should be filtered)
- Settings are scoped per userId
- No cross-user access
- Consider adding authentication middleware

## Maintenance Guidelines

1. **Schema Changes**: Update UserSettingsSchema in storage.ts
2. **Migrations**: Implement version field for schema migrations
3. **Validation**: All updates validated via Zod schema
4. **NL Parsing**: Extend parseSettingsUpdate() for new settings
5. **Defaults**: Keep createDefaultSettings() in sync with schema

## Dependencies
- KV namespace binding (SETTINGS_KV)
- Zod for schema validation
