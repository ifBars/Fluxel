# Fluxel

A performance-first code editor built with Tauri v2 and React. Born from frustration with VSCode's sluggishness, Fluxel prioritizes speed without sacrificing essential features.

<img width="1920" height="1031" alt="image" src="https://github.com/user-attachments/assets/dc775c76-067d-49c0-8a2c-7eea61446dde" />

## Philosophy

**Speed First** - Optimized for instant startup and responsive editing, even without the bloat of excessive plugins.

**Focused, Not Bloated** - Not trying to be a full IDE like Visual Studio or Rider. Currently targeting C# and TypeScript developers who want a fast, focused editing experience.

**Familiar Interface** - VSCode-inspired workbench (activity bar, sidebar, panels) but with performance as the top priority.

## Features

- **Monaco Editor** - Professional code editing with syntax highlighting and IntelliSense
- **Visual Editing Mode** - Switch between code, visual, and split view
- **Native Performance** - Tauri v2 delivers fast startup and minimal memory footprint
- **Language Support** - C# and TypeScript (in development)

## Tech Stack

**Frontend:** React 19 · TypeScript · Monaco Editor · Tailwind CSS v4 · Zustand
**Backend:** Tauri v2 (Rust)
**Tooling:** Vite · Bun

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run tauri dev

# Build application
bun run tauri build
```

## Note

This is a work in progress, with many features still in development.
