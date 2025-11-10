# core-ai-proxy Dashboard

Shadcn-based admin dashboard for managing settings, configs, and sandbox execution.

## Setup

This dashboard should be scaffolded using [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter).

```bash
npx create-next-app@latest dashboard --example https://github.com/Kiranism/next-shadcn-dashboard-starter
cd dashboard
npm install
```

## Features

### Settings Page (`/dashboard/settings`)
- Language preference toggle (Python/JavaScript)
- Chart library selection (Recharts, Chart.js, VisX)
- Theme switcher (Dark/Light)
- GitHub integration (token, username, default repo)
- Terminal preview toggle
- Auto-save toggle

### Configs Page (`/dashboard/configs`)
- List all saved configurations
- Create new config
- Edit existing configs
- Save to GitHub button
- Preview sandbox terminal link

### Sandbox Page (`/dashboard/sandbox`)
- Code editor with syntax highlighting
- Execute button with ToolRouter integration
- Real-time output display
- Terminal preview iframe
- Save as config button

## API Integration

The dashboard connects to the core-ai-proxy Worker endpoints:

```typescript
// Settings API
GET /sandbox/settings/:userId
PUT /sandbox/settings/:userId
POST /sandbox/settings/:userId/parse

// Sandbox API
POST /sandbox/execute

// GitHub API
POST /sandbox/configs/save
```

## Components

### SettingsForm
```tsx
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

export function SettingsForm({ userId }: { userId: string }) {
  const [settings, setSettings] = useState(null)

  // Fetch settings on mount
  useEffect(() => {
    fetch(`/api/sandbox/settings/${userId}`)
      .then(r => r.json())
      .then(setSettings)
  }, [userId])

  // Update handlers...
}
```

### CodeEditor
```tsx
import Editor from "@monaco-editor/react"

export function CodeEditor({ code, language, onChange }) {
  return (
    <Editor
      height="400px"
      language={language}
      value={code}
      onChange={onChange}
      theme="vs-dark"
    />
  )
}
```

### TerminalPreview
```tsx
export function TerminalPreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="w-full h-96 border rounded"
      title="Terminal Preview"
    />
  )
}
```

## Deployment

The dashboard can be deployed separately as a Next.js app or integrated into the Worker using:
- Cloudflare Pages
- Vercel
- Or served from the Worker's ASSETS binding

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://core-ai-proxy.workers.dev
NEXT_PUBLIC_USER_ID=default-user
```
