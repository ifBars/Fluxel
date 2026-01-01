# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fluxel is a Tauri v2 desktop IDE application with a React + TypeScript frontend. It's a code editor with visual editing capabilities, featuring a VSCode-like workbench interface with resizable panels, Monaco editor integration, LSP support, plugin system, command palette, multi-terminal UI, and debugging capabilities.

## Technology Stack

**Frontend:**
- React 19 with TypeScript
- Tailwind CSS v4 (using @theme directive in CSS)
- Zustand for state management
- Monaco Editor for code editing
- React Three Fiber + Drei for 3D rendering
- Framer Motion for animations
- React Resizable Panels for layout
- Git for version control

**Backend:**
- Tauri v2 (Rust)
- Window decorations disabled with custom titlebar
- Transparent window enabled

**Build Tools:**
- Vite with React plugin
- Bun as package manager (configured in tauri.conf.json)

## Development Commands

```bash
# Install dependencies
bun install

# Start development server (runs Vite + Tauri)
bun run tauri dev

# Build frontend only
bun run build

# Build desktop application
bun run tauri build

# Type check
tsc
```

## Architecture

### State Management

The app uses Zustand stores located in `src/stores/`:

**Core Stores:**
- `useWorkbenchStore.ts` - Workbench state (sidebar visibility, activity bar, editor mode)
- `useSettingsStore.ts` - User preferences (theme, font size, minimap visibility, all editor settings)
- `useEditorStore.ts` - Editor state (open tabs, active file, file content, cursor position)

**Feature Stores:**
- `useCommandStore.ts` - Command palette with 50+ commands and fuzzy search
- `useTerminalStore.ts` - Multi-terminal management (instances, history, layouts)
- `useDebugStore.ts` - Debug session state (breakpoints, call stack, variables, watch expressions)
- `usePluginStore.ts` - Plugin lifecycle and state management
- `useDiagnosticsStore.ts` - LSP diagnostics aggregation

### Component Structure

```
src/
├── App.tsx                     # Root component with auth routing
├── components/
│   ├── auth/                  # Authentication UI
│   │   ├── AuthPage.tsx       # Main auth screen
│   │   └── AuthShader.tsx     # Three.js shader background
│   ├── editor/                # Editor components
│   │   ├── EditorPage.tsx     # Editor layout container
│   │   ├── EditorGroup.tsx    # Editor mode switcher (code/visual/split)
│   │   ├── CodeEditor.tsx     # Monaco editor wrapper (1000+ lines)
│   │   └── VisualEditor.tsx   # Visual/preview editor placeholder
│   ├── workbench/             # Workbench UI
│   │   ├── Workbench.tsx      # Main workbench layout with panels
│   │   ├── ActivityBar.tsx    # Left-side activity icons
│   │   ├── SideBar.tsx        # Resizable sidebar
│   │   ├── CommandPalette.tsx # Command palette (Ctrl+Shift+P)
│   │   ├── TerminalTabs.tsx   # Multi-terminal tab bar
│   │   ├── BuildPanel.tsx     # Terminal view with history
│   │   ├── DebugPanel.tsx     # Debug UI (variables, watch, call stack)
│   │   └── SettingsDialog.tsx # Settings modal
│   └── ui/                    # Reusable UI components
│       ├── button.tsx         # CVA-styled button
│       ├── input.tsx          # Styled input
│       └── titlebar.tsx       # Custom window titlebar
├── stores/                    # Zustand state management
├── hooks/                     # React hooks
│   ├── usePlugins.ts          # Plugin system integration
│   ├── useCommands.ts         # Command registration
│   └── useKeyboardShortcuts.ts # Global keyboard shortcuts
├── lib/
│   ├── plugins/               # Plugin system
│   │   ├── PluginHost.ts      # Central plugin manager (singleton)
│   │   ├── PluginLoader.ts    # Plugin discovery and loading
│   │   ├── PluginContext.ts   # API surface for plugins
│   │   └── types.ts           # Plugin type definitions
│   ├── languages/             # Language support
│   │   ├── base/
│   │   │   ├── BaseLSPClient.ts   # Generic LSP client (1200+ lines)
│   │   │   └── fileUris.ts        # URI conversion utilities
│   │   ├── csharp/
│   │   │   ├── CSharpLSPClient.ts # C# LSP integration
│   │   │   ├── MonacoProviders.ts # Monaco LSP features (1200+ lines)
│   │   │   ├── Config.ts          # C# language configuration
│   │   │   └── Monarch.ts         # C# syntax tokenizer
│   │   └── typescript/
│   │       ├── TypeLoader.ts      # Type definition loader (1200+ lines)
│   │       ├── MonacoTSConfig.ts  # TypeScript compiler config
│   │       ├── SourceManager.ts   # Source file registration
│   │       └── LazyTypeResolver.ts # On-demand type loading
│   ├── ollama/
│   │   └── inlineCompletionProvider.ts # Ollama AI autocomplete
│   └── utils.ts               # Utility functions (cn, etc.)
├── plugins/
│   ├── core/                  # Bundled core plugins
│   │   └── index.ts           # Core plugin registry
│   └── s1api/                 # S1API plugin for MelonLoader mod development
│       └── index.ts           # S1API IntelliSense, syntax, hover
├── styles/
│   └── index.css             # Tailwind v4 config with @theme
└── vite.config.ts            # Vite configuration with Monaco chunk optimization
```

### Tauri Integration

- Custom titlebar implementation in `src/components/ui/titlebar.tsx` with window controls
- Window configuration in `src-tauri/tauri.conf.json` sets `decorations: false` and `transparent: true`
- Drag region enabled via `data-tauri-drag-region` attribute (see styles/index.css)

**Tauri Commands:**
- `src-tauri/src/lib.rs` - Main entry point with command registration
- `src-tauri/src/commands/terminal.rs` - Terminal process execution
- `src-tauri/src/languages/lsp_manager.rs` - Generic LSP server process manager
- `src-tauri/src/languages/csharp/lsp.rs` - C# language server commands
- `src-tauri/src/services/plugin_loader.rs` - Community plugin discovery

### Styling System

- Using Tailwind CSS v4 with `@theme` directive in `src/styles/index.css`
- Custom color palette using OKLCH color space
- Theme switching via `[data-theme="dark"]` attribute
- CVA (class-variance-authority) for component variants
- Path alias `@/*` maps to `./src/*`

## Monaco Editor Integration

### Lifecycle & Initialization

**Location:** `src/components/editor/CodeEditor.tsx` (lines 98-108, 666-706)

**Initialization Flow:**
1. Worker configuration via `configureMonacoWorkers()` (lines 26-65)
   - Custom worker factory routes language workers locally (prevents CDN fallback in Tauri)
   - Workers: JSON, CSS, HTML, TypeScript/JavaScript, and base editor worker
   - Uses Vite's `?worker` import syntax for bundling
   - Caches configuration with `__fluxelConfigured` flag

2. React hook integration
   - Uses `useMonaco()` hook from `@monaco-editor/react`
   - Stores editor instance via `useState<IStandaloneCodeEditor>`
   - Manages diff editor separately via `useRef<IStandaloneDiffEditor>`
   - Tracks LSP document versions and open documents

3. Mount lifecycle (`handleEditorMount()`)
   - Overrides `openCodeEditor` for "Go to Definition" cross-file navigation
   - Integrates with editor store for file opening with cursor positioning
   - Profiled using `FrontendProfiler` for performance tracking

### Themes

**Custom Themes:** `fluxel-dark` and `fluxel-light` (lines 305-386)
- Base: `vs-dark` and `vs` respectively
- Orange accent color (#f97316) for cursor and selection
- C# syntax highlighting with specific token coloring
- Themes re-registered on monaco instance change

### Editor Configuration

**Settings Synced from `useSettingsStore`** (lines 77-95, 912-986):
- **Font:** fontSize, fontFamily, lineHeight, fontLigatures, fontWeight, letterSpacing
- **Cursor:** cursorStyle, cursorBlinking, cursorWidth, cursorSmoothCaretAnimation
- **Display:** lineNumbers, renderLineHighlight, bracketPairColorization, folding, glyphMargin
- **Behavior:** wordWrap, smoothScrolling, scrollBeyondLastLine, stickyScroll, autoClosing
- **Minimap:** showMinimap, minimapSide, minimapScale, minimapMaxColumn, minimapShowSlider
- **Autocomplete:** Comprehensive suggest configuration (keywords, snippets, classes, functions, etc.)

### Language Support

**TypeScript/JavaScript:**
- Configuration: `src/lib/languages/typescript/MonacoTSConfig.ts`
- Compiler options: Target ES2020, Module ESNext, JSX ReactJSX
- Full diagnostics enabled (semantic + syntax + suggestions)
- Eager model sync for cross-file IntelliSense
- Type definition loading: `src/lib/languages/typescript/TypeLoader.ts`
  - Batched loading to prevent worker crashes (50ms delays)
  - Memory management (max file size: 2.5MB, total: 50MB, 200 files/package)
  - Loads @types packages, package-bundled types, default libs
  - Lazy type resolution on import changes

**C#:**
- Language configuration: `src/lib/languages/csharp/Config.ts`
- Monarch tokenizer: `src/lib/languages/csharp/Monarch.ts` (30+ keywords, complex state machine)
- Auto-closing pairs, folding markers (#region/#endregion)
- Generic type parameter handling

### Custom Commands & Actions

**Built-in Commands** (lines 532-569):
- Edit: undo, redo, cut, copy, paste, selectAll
- Navigation: find, replace, gotoLine
- Formatting: formatDocument
- Code structure: fold, unfold

**Pending Action System:**
- Listens to `useEditorStore` for pending actions from menu
- Executes on editor instance and clears

**Cursor Tracking** (lines 708-758):
- Listens to position and selection change events
- Updates store for status bar display

### Autocomplete

**Built-in Monaco Autocomplete** (lines 961-984):
- Comprehensive suggest configuration with all features enabled
- Controlled by `autocompleteEnabled` setting

**Ollama Inline Completion Provider** (`src/lib/ollama/inlineCompletionProvider.ts`):
- GitHub Copilot-style ghost text suggestions
- Context extraction: 75 lines before/after cursor
- FIM (Fill-in-Middle) model support (Qwen, StarCoder, DeepSeek)
- Smart caching for "typing through" suggestions
- Debouncing (300ms default)
- Completion cleaning (removes code fences, FIM tokens)
- Safety checks (prevents echoing suffix, 8 line max, 3 char min prefix)

### Diff Editor Mode

**Diff View** (lines 870-901):
- Uses Monaco's `DiffEditor` component
- Original: `diffBaseContent` vs Modified: `activeTab.content`
- Read-only mode with same theme and settings

## Language Server Protocol (LSP) Integration

### Architecture

**Three-Layer System:**
Frontend (TypeScript) ↔ Tauri IPC ↔ Backend (Rust)

### Core Components

**Base LSP Client** (`src/lib/languages/base/BaseLSPClient.ts` - 1200+ lines):
- Generic LSP client with JSON-RPC 2.0 messaging
- Bidirectional communication via Tauri `listen()` and `invoke()`
- Request/response correlation with `pendingRequests` Map
- Notification system with multiple handler support
- Document state tracking (open/close notifications)
- Profiling integration

**Key Methods:**
```typescript
start(workspaceRoot)              // Initialize LSP client
stop()                            // Graceful shutdown
sendRequest(method, params)       // Send JSON-RPC request
sendNotification(method, params)  // Send one-way notification
onNotification/onRequest          // Register handlers
initialize(workspaceRoot)         // LSP initialization protocol
```

### C# Language Support

**C# LSP Client** (`src/lib/languages/csharp/CSharpLSPClient.ts`):
- Extends BaseLSPClient with C#-specific functionality
- Auto-detects and installs csharp-ls if missing
- Solution/project file discovery (.sln, .csproj)
- Enhanced error handling with user-friendly messages

**Monaco Providers** (`src/lib/languages/csharp/MonacoProviders.ts` - 1200+ lines):

**15 LSP Features Registered:**
1. **Completion Provider** - IntelliSense with triggers: `.`, ` `, `(`, `<`
2. **Hover Provider** - Type information on hover
3. **Definition Provider** - Go-to-Definition
4. **Type Definition Provider** - Go-to-Type
5. **Implementation Provider** - Navigate to implementations
6. **References Provider** - Find all references
7. **Signature Help** - Parameter hints with triggers: `(`, `,`, `<`
8. **Document Symbols** - Outline/breadcrumb navigation
9. **Formatting Providers** - Document and range formatting
10. **Rename Provider** - Refactoring with prepareRename
11. **Document Highlight** - Highlight occurrences
12. **Code Actions** - Quick fixes and refactorings
13. **Semantic Tokens** - LSP-based syntax highlighting
14. **Diagnostics Handler** - Error/warning squiggles
15. **Workspace Symbols** - Cross-file symbol search

**URI Mapping:**
- LSP URIs: `file:///C:/Path/file.cs`
- Monaco URIs: `file:///c%3A/Path/file.cs`
- Automatic conversion via `monacoUriToLspUri()` and `lspUriToMonacoUri()`

### Backend Rust Implementation

**LSP Manager** (`src-tauri/src/languages/lsp_manager.rs`):
- Generic process manager for any LSP server
- Standard LSP wire format: `Content-Length: N\r\n\r\n{JSON}`
- Async stdout/stderr handling with tokio
- Automatic message emission to frontend via `window.emit()`

**C# Language Server** (`src-tauri/src/languages/csharp/lsp.rs`):
```rust
start_csharp_ls(workspace_root)   // Start csharp-ls process
stop_csharp_ls()                  // Stop gracefully
send_lsp_message(message)         // Send to stdin
```

**Auto-setup:**
- Checks if csharp-ls is installed
- Auto-installs via `dotnet tool install --global csharp-ls`
- Searches for solution/project files
- Manages PATH with dotnet tools directory

### LSP Message Flow

```
Frontend                          Backend
  |                                 |
  +-- invoke('start_csharp_ls') --> LSPManager::start()
  |                                 |
  |                              Spawns csharp-ls
  |                                 |
  |<-- listen('lsp-message') <----- window.emit('lsp-message')
  |                                 |
  +-- invoke('send_lsp_message') -> stdin pipe
  |                                 |
  +-- invoke('stop_csharp_ls') ---> LSPManager::stop()
```

### Document Lifecycle

**C# Files** (lines 449-521 in MonacoProviders.ts):
1. `textDocument/didOpen` - Sent when file opened
2. `textDocument/didChange` - Sent on content changes
3. `textDocument/didSave` - Sent on file save
4. `textDocument/didClose` - Sent on tab close

### Diagnostics

**Store:** `src/stores/diagnostics/useDiagnosticsStore.ts`
- Aggregates LSP + build diagnostics
- Sources: csharp-ls, typescript, build
- Filtering by severity, source, search query
- Navigation between diagnostics

### File URI Utilities

**Location:** `src/lib/languages/base/fileUris.ts`
- `fsPathToLspUri()`: C:/path → file:///C:/path
- `fsPathToMonacoUri()`: C:/path → file:///c%3A/path
- `fileUriToFsPath()`: file:/// → C:/path (with decoding)
- `monacoUriToLspUri()` and `lspUriToMonacoUri()`: Bidirectional conversion

## Plugin System

### Architecture

**Singleton Pattern:** PluginHost manages all plugins centrally

**File Structure:**
- `src/lib/plugins/types.ts` - Core type definitions
- `src/lib/plugins/PluginHost.ts` - Central plugin manager
- `src/lib/plugins/PluginLoader.ts` - Plugin discovery and loading
- `src/lib/plugins/PluginContext.ts` - API surface for plugins
- `src/stores/plugins/usePluginStore.ts` - Zustand state management
- `src/hooks/usePlugins.ts` - React integration
- `src/plugins/core/index.ts` - Core plugins registry
- `src-tauri/src/services/plugin_loader.rs` - Filesystem operations

### Plugin Types

**Core Plugins:**
- Bundled at build time in `/src/plugins/`
- Always available, no installation required
- Example: S1API plugin for MelonLoader mod development

**Community Plugins:**
- Located in `~/.fluxel/plugins/` (user home directory)
- Discovered at runtime via Tauri backend
- Must contain `plugin.json` or `package.json` manifest
- **Note:** Dynamic importing not fully implemented yet

### Plugin Lifecycle

**States:** `inactive` → `activating` → `active` → `deactivating` → `error`

**Initialization Flow:**
```
EditorPage.tsx mounts
    ↓
usePlugins({ autoInit: true, loadCommunity: true })
    ↓
PluginHost.initialize(monaco)
    ↓
registerCorePlugins() - S1APIPlugin
    ↓
PluginLoader.loadAllPlugins()
    ↓
PluginHost.detectProjects() - runs all detectors
    ↓
Plugins activate based on events (onLanguage:, onProject:, onStartup, *)
```

### Activation Events

```typescript
type ActivationEvent =
    | `onLanguage:${string}`      // "onLanguage:csharp"
    | `onProject:${string}`       // "onProject:s1api"
    | `onCommand:${string}`       // "onCommand:debug"
    | `onStartup`                 // Application startup
    | `*`                         // Always active
```

### Plugin API (PluginContext)

**Available to plugins:**
```typescript
interface PluginContext {
    readonly monaco: MonacoInstance;
    readonly pluginId: string;
    readonly subscriptions: Disposable[];   // Auto-cleanup

    // Workspace
    getWorkspaceRoot(): string | null;

    // Language Features
    registerLanguageFeatures(config): Disposable;
    registerCompletionProvider(selector, provider): Disposable;
    registerHoverProvider(selector, provider): Disposable;
    registerSyntaxHighlighting(languageId, rules): Disposable;

    // Project Detection
    registerProjectDetector(detector): Disposable;

    // Logging
    log(message, level?): void;
}
```

### Plugin Manifest

```typescript
interface FluxelPlugin {
    id: string;                    // "fluxel.s1api"
    name: string;                  // "S1API Support"
    version: string;               // "1.0.0"
    description?: string;
    author?: string;
    repository?: string;
    activationEvents: ActivationEvent[];
    dependencies?: string[];
    isCore?: boolean;

    activate(context: PluginContext): Promise<void>;
    deactivate?(): Promise<void>;
}
```

### S1API Plugin Example

**Location:** `src/plugins/s1api/index.ts`

**Features:**
- Project detection (scans .csproj for S1API/MelonLoader references)
- Syntax highlighting (PhoneApp, Saveable, UIFactory keywords)
- IntelliSense (40+ completions for S1API classes/methods)
- Hover documentation (25+ entries with links to official docs)

### Event System

```typescript
type PluginEventType =
    | 'plugin:registered'
    | 'plugin:activated'
    | 'plugin:deactivated'
    | 'plugin:error'
    | 'project:detected';
```

Plugin store subscribes to all events for UI updates.

## Command Palette

**Location:** `src/components/workbench/CommandPalette.tsx`

**Features:**
- Activation: `Ctrl+Shift+P`
- Fuzzy search algorithm (exact > starts-with > contains > character-matching)
- 50+ default commands in 8 categories (file, edit, view, go, refactor, debug, terminal, help)
- Keyboard navigation (arrows, Home/End, PageUp/Down)
- Recent commands caching (max 10, persisted)
- Command availability conditions (`when` function)
- Color-coded categories

**Command Registration:** `src/hooks/useCommands.ts`
```typescript
interface Command {
    id: string;
    label: string;
    category: CommandCategory;
    shortcut?: string;
    description?: string;
    when?: () => boolean;
    execute: () => void;
}
```

## Multi-Terminal UI

**Store:** `src/stores/terminal/useTerminalStore.ts`

**Components:**
- `TerminalTabs.tsx` - Tab bar with rename, color picker, context menu
- `BuildPanel.tsx` - Terminal view with history and auto-scroll

**Features:**
- 3 layout modes: single, split-horizontal, split-vertical
- Command history with arrow key navigation
- Ctrl+C to kill, Ctrl+L to clear
- Color indicators (6 colors) for tabs
- Entry types: command, output, error, info (colored display)

**Backend:** `src-tauri/src/commands/terminal.rs`
```rust
execute_shell_command(command, args[], cwd) → PID
kill_shell_process(pid) → Kill process
```

**Process Handling:**
- Windows: `cmd /C` with CREATE_NO_WINDOW flag
- Unix: `sh -c` via system shell
- Spawns 3 threads: stdout, stderr, exit waiter
- Emits events: `terminal://output`, `terminal://stderr`, `terminal://exit`

## Debug Features

**Store:** `src/stores/debug/useDebugStore.ts`

**Session States:** stopped, running, paused, stepping

**Features:**
- **Breakpoints:** Toggleable, conditional, hit counts, logpoints (persisted)
- **Call Stack:** Stack frames with file/line navigation
- **Variables:** Nested scopes with expandable tree
- **Watch Expressions:** Add/remove watched values (persisted)
- **Toolbar:** Start/pause/stop, step over/into/out controls
- **4 Tab Views:** Variables, Watch, Call Stack, Breakpoints

**Debug Panel:** `src/components/workbench/DebugPanel.tsx` (lazy-loaded, F5 to toggle)

## Keyboard Shortcuts

**Hook:** `src/hooks/useKeyboardShortcuts.ts`

**Global Shortcuts:**
- `Ctrl+B` - Toggle sidebar
- `Ctrl+Shift+P` - Command palette
- `F5` - Start/continue debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into
- `Shift+F11` - Step out
- Plus standard editor shortcuts (save, undo, redo, etc.)

Smart logic: Skips input fields, uses Ctrl/Cmd appropriately, prevents defaults

## Key Implementation Details

### Panel Resizing

The workbench uses `react-resizable-panels` with:
- Sidebar: defaultSize=20%, minSize=15%, maxSize=30%, collapsible
- Editor split mode: 50/50 split with minSize=20% each
- Custom styled resize handles with hover/active states

### Editor Modes

Three modes available via `useWorkbenchStore.editorMode`:
1. `code` - Monaco editor only
2. `visual` - Visual editor only (placeholder)
3. `split` - Side-by-side code and visual editors

### Window Controls

Custom titlebar implementation handles:
- Window minimize, maximize, close
- Drag region for window movement
- Non-draggable buttons (via CSS app-region)

### Authentication Flow

Currently using simple boolean state in App.tsx:
1. `isAuthenticated` defaults to `false`
2. `AuthPage` renders with Three.js shader background
3. On login, sets `isAuthenticated: true`
4. Renders `EditorPage` with workbench

## Important Notes

### General
- The Rust library name is `fluxel_lib` in Cargo.toml
- Vite dev server runs on port 1420 (configured in vite.config.ts and tauri.conf.json)
- HMR uses port 1421
- Bun is the configured package manager (don't use npm/yarn commands)
- TypeScript strict mode enabled with noUnusedLocals and noUnusedParameters
- Use your sub-agents to help you with larger tasks for scalability and maintainability

### Monaco Editor
- Custom themes must be defined after monaco instance loads (useEffect)
- Workers configured locally to prevent CDN fallback in Tauri
- Monaco bundled in separate `monaco` chunk for optimization (vite.config.ts lines 49-50)

### LSP Integration
- URI conversion critical for LSP ↔ Monaco coordination
- Document lifecycle management prevents duplicate notifications
- BaseLSPClient is generic and can be extended for other languages

### Plugin System
- Plugins use PluginContext API for all IDE interactions
- Subscriptions automatically cleaned up on deactivation
- Project detection runs on workspace open
- Community plugin dynamic importing not fully implemented yet

### Performance
- Profiling integration throughout via FrontendProfiler
- Batched operations to prevent worker overload
- Memory budgets for type loading
- Debouncing for reactive operations

## Dependencies

**Key Packages:**
- `@monaco-editor/react`: ^4.7.0 - Monaco wrapper
- `monaco-languageclient`: ^10.4.0 - LSP client
- `vscode-languageclient`: ^9.0.1 - VSCode LSP
- `vscode-jsonrpc`: ^8.2.1 - JSON-RPC protocol
- `react-resizable-panels`: Panel layout
- `zustand`: State management
- `@tauri-apps/api`: Tauri frontend API
