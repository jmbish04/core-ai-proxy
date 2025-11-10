# Frontend Assets - AGENTS.md

## Purpose
Static HTML, CSS, and JavaScript files served via the ASSETS binding. Provides a "cinematic" user interface for monitoring, testing, and interacting with the core-ai-proxy.

## Architecture

### Global Assets
- **styles.css**: Shared glass/gradient aesthetic stylesheet
- **client.js**: Shared JavaScript for API calls and WebSocket connections

### Pages

#### index.html (Landing Page)
**Purpose**: Hero page with "Vibe Engineer" aesthetic

**Features**:
- Project overview and description
- Quick links to other pages
- Live system status indicator
- Animated gradients and glass-morphism effects

#### health.html (Health Dashboard)
**Purpose**: Real-time health monitoring and test execution

**Features**:
- Displays current system health from `GET /api/health`
- Lists all test definitions from `GET /api/tests/defs`
- Button to trigger test run via `POST /api/tests/run`
- Real-time test results display
- Historical test run visualization

**JavaScript Integration**:
```javascript
// From client.js
async function fetchHealth() {
  const response = await fetch('/api/health');
  const data = await response.json();
  updateHealthUI(data);
}

async function runTests() {
  const response = await fetch('/api/tests/run', { method: 'POST' });
  const session = await response.json();
  pollTestResults(session.id);
}
```

#### downloads.html (Client Code)
**Purpose**: Provide code snippets for various programming languages

**Features**:
- Python client example (using openai SDK)
- JavaScript/Node.js examples
- cURL examples
- Configuration instructions
- Copy-to-clipboard functionality

#### agents-preview.html (AGENTS.md Preview)
**Purpose**: Render syntax-highlighted AGENTS.md dry-run previews

**Features**:
- Accepts `?id={generation_id}` query parameter
- Fetches AGENTS.md content from database
- Renders markdown with syntax highlighting
- Shows source files used in generation
- Download button for final markdown

**JavaScript Integration**:
```javascript
const params = new URLSearchParams(window.location.search);
const generationId = params.get('id');
const response = await fetch(`/api/agents/preview/${generationId}`);
const { agents_md, sources } = await response.json();
renderMarkdown(agents_md);
```

## Styling Guidelines

### Color Palette
- Primary: Deep purples/blues (#6366f1, #8b5cf6)
- Accent: Cyan/teal (#06b6d4)
- Background: Dark gradients (rgba(15, 23, 42, 0.95))
- Glass: Semi-transparent overlays with backdrop-filter

### Effects
- **Glass Morphism**: `backdrop-filter: blur(10px)` with border
- **Gradients**: Animated background gradients
- **Shadows**: Subtle glow effects on interactive elements
- **Transitions**: Smooth 200-300ms transitions

### Typography
- Headers: Bold, gradient text
- Body: Inter or system font stack
- Code: Monospace (JetBrains Mono or Fira Code)

## Maintenance Guidelines

1. **Asset Updates**: All pages must load styles.css and client.js
2. **API Changes**: Update client.js when API endpoints change
3. **Responsive Design**: Test on mobile and desktop viewports
4. **Accessibility**: Ensure proper ARIA labels and keyboard navigation
5. **Performance**: Minimize inline styles, use shared CSS classes

## Dependencies
- Fetch API (for backend communication)
- WebSocket API (for real-time updates in health.html)
- Markdown renderer (for agents-preview.html)
- Syntax highlighter (Prism.js or Highlight.js for code blocks)

## ASSETS Binding

Files in this directory are served via Cloudflare Workers ASSETS binding:
- Automatic compression (Brotli/Gzip)
- Edge caching
- Content-Type detection
- No need for explicit routing in worker code
