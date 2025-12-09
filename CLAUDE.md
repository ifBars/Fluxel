# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fluxel is a Tauri v2 desktop application with a React + TypeScript frontend. It's a code editor with visual editing capabilities, featuring a VSCode-like workbench interface with resizable panels, Monaco editor integration, and 3D visual previews using Three.js and React Three Fiber.

## Technology Stack

**Frontend:**
- React 19 with TypeScript
- Tailwind CSS v4 (using @theme directive in CSS)
- Zustand for state management
- Monaco Editor for code editing
- React Three Fiber + Drei for 3D rendering
- Framer Motion for animations
- React Resizable Panels for layout

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

- `useWorkbenchStore.ts` - Manages workbench state including sidebar visibility, active activity bar item, and editor mode (code/visual/split)
- `useSettingsStore.ts` - Manages user preferences like theme, font size, and minimap visibility

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
│   │   ├── CodeEditor.tsx     # Monaco editor wrapper
│   │   └── VisualEditor.tsx   # Visual/preview editor placeholder
│   ├── workbench/             # Workbench UI
│   │   ├── Workbench.tsx      # Main workbench layout with panels
│   │   ├── ActivityBar.tsx    # Left-side activity icons
│   │   ├── SideBar.tsx        # Resizable sidebar
│   │   └── SettingsDialog.tsx # Settings modal
│   └── ui/                    # Reusable UI components
│       ├── button.tsx         # CVA-styled button
│       ├── input.tsx          # Styled input
│       └── titlebar.tsx       # Custom window titlebar
├── stores/                    # Zustand state management
├── styles/
│   └── index.css             # Tailwind v4 config with @theme
└── lib/
    └── utils.ts              # Utility functions (cn, etc.)
```

### Tauri Integration

- Custom titlebar implementation in `src/components/ui/titlebar.tsx` with window controls
- Window configuration in `src-tauri/tauri.conf.json` sets `decorations: false` and `transparent: true`
- Drag region enabled via `data-tauri-drag-region` attribute (see styles/index.css)
- Rust backend in `src-tauri/src/lib.rs` with sample `greet` command

### Styling System

- Using Tailwind CSS v4 with `@theme` directive in `src/styles/index.css`
- Custom color palette using OKLCH color space
- Theme switching via `[data-theme="dark"]` attribute
- CVA (class-variance-authority) for component variants
- Path alias `@/*` maps to `./src/*`

### Monaco Editor

Custom themes defined in `CodeEditor.tsx`:
- `fluxel-dark` and `fluxel-light` with orange accent color (#f97316)
- Settings synced from Zustand store (theme, fontSize, showMinimap)

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

Currently using simple boolean state in App.tsx. Auth flow:
1. `isAuthenticated` defaults to `false`
2. `AuthPage` renders with Three.js shader background
3. On login, sets `isAuthenticated: true`
4. Renders `EditorPage` which contains the workbench

## Important Notes

- The Rust library name is `first_tauri_app_lib` in Cargo.toml (legacy name, works fine)
- Vite dev server runs on port 1420 (configured in vite.config.ts and tauri.conf.json)
- HMR uses port 1421
- Bun is the configured package manager (don't use npm/yarn commands)
- TypeScript strict mode enabled with noUnusedLocals and noUnusedParameters
- Monaco editor custom themes must be defined after monaco instance loads (useEffect)
- Use your sub-agents to help you with larger tasks, don't try to do everything yourself, so we can ensure scalability and maintainability.