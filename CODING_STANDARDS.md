# Coding Standards

This document outlines the coding standards and best practices for the Fluxel project. Following these guidelines ensures consistency, maintainability, and quality across the codebase.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript / React Standards](#typescript--react-standards)
- [Rust Standards](#rust-standards)
- [Styling Standards](#styling-standards)
- [State Management](#state-management)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Comments and Documentation](#comments-and-documentation)

## General Principles

### Code Quality

- **Write self-documenting code**: Prefer clear variable and function names over excessive comments
- **Keep it simple**: Avoid over-engineering; implement what's needed, not what might be needed
- **Single Responsibility**: Each function, component, or module should have one clear purpose
- **DRY (Don't Repeat Yourself)**: Extract common logic into reusable utilities or components
- **Type Safety First**: Leverage TypeScript's type system fully; avoid `any` types

### Performance

- **Lazy Loading**: Use React lazy imports for large components (see `EditorPage.tsx`)
- **Memoization**: Use `useMemo` and `useCallback` appropriately to prevent unnecessary re-renders
- **Bundle Size**: Keep dependencies minimal; prefer lighter alternatives when possible

## TypeScript / React Standards

### Component Structure

Use functional components with TypeScript interfaces for props:

```tsx
interface ActivityBarProps {
    onSettingsClick: () => void;
    sidebarPanelRef: RefObject<ImperativePanelHandle | null>;
}

export default function ActivityBar({ onSettingsClick, sidebarPanelRef }: ActivityBarProps) {
    // Component logic
}
```

### Component Organization

Order component elements consistently:

1. Imports
2. Type definitions
3. Main component function
4. Sub-components (if small and not reusable)
5. Exports

### TypeScript Configuration

- **Strict Mode**: Always enabled (`strict: true`)
- **No Unused Variables**: Enforced via `noUnusedLocals` and `noUnusedParameters`
- **Path Aliases**: Use `@/*` for imports from `src/`

```tsx
// Good
import { useWorkbenchStore } from '@/stores';
import Button from '@/components/ui/button';

// Avoid
import { useWorkbenchStore } from '../../stores';
```

### Hooks Usage

- Place hooks at the top of the component, before any conditional logic
- Use custom hooks to encapsulate complex logic
- Prefer Zustand stores over prop drilling for global state

```tsx
export default function MyComponent() {
    const { activeActivity, setActiveActivity } = useWorkbenchStore();
    const [localState, setLocalState] = useState(false);

    useEffect(() => {
        // Effect logic
    }, [dependency]);

    // Rest of component
}
```

### Event Handlers

- Prefix event handlers with `handle`: `handleClick`, `handleSubmit`, `handleChange`
- Define handlers inside the component unless they need to be extracted for reuse

```tsx
const handleActivityClick = (activity: ActivityItem) => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;

    // Handler logic
};
```

### Props Destructuring

Always destructure props in the component signature for clarity:

```tsx
// Good
function Button({ className, variant, size, ...props }: ButtonProps) {
    // ...
}

// Avoid
function Button(props: ButtonProps) {
    const { className, variant, size } = props;
    // ...
}
```

### Conditional Rendering

Use logical operators and ternaries appropriately:

```tsx
// Short conditions
{isAvailable && <Component />}

// Binary choice
{isActive ? <ActiveIcon /> : <InactiveIcon />}

// Complex conditions - extract to variable
const shouldRenderPanel = isProfilerAvailable && isEnabled;
{shouldRenderPanel && <ProfilerPanel />}
```

## Rust Standards

### Module Organization

- Organize related functionality into modules
- Use `mod.rs` for module exports
- Keep command handlers in `src-tauri/src/commands/`
- Keep services in `src-tauri/src/services/`

```rust
// src-tauri/src/lib.rs
mod commands;
mod services;
mod languages;

use commands::{LaunchState, ProjectConfigCache};
use services::ProcessManager;
```

### Tauri Commands

- Use descriptive command names with module prefixes: `workspace::list_directory_entries`
- Return `Result<T, String>` for error handling
- Manage state properly with Tauri's state management

```rust
#[tauri::command]
pub fn my_command(
    state: State<MyState>,
    param: String
) -> Result<MyResponse, String> {
    // Command logic
    Ok(response)
}
```

### Error Handling

- Provide meaningful error messages
- Use `Result` types appropriately
- Log errors for debugging

```rust
// Good
.map_err(|e| format!("Failed to read file: {}", e))?

// Avoid
.unwrap()
```

### Feature Flags

Use feature flags for optional functionality:

```rust
#[cfg(feature = "profiling")]
mod profiling;

#[cfg(feature = "profiling")]
{
    let profiler = profiling::init();
    app.manage(profiler);
}
```

## Styling Standards

### Tailwind CSS v4

- Use the `@theme` directive in `src/styles/index.css`
- Prefer Tailwind utility classes over custom CSS
- Use CSS variables for dynamic theming

```tsx
// Good - using Tailwind utilities
<div className="flex flex-col items-center bg-muted/40 border-r border-border">

// Good - using CSS variables for dynamic values
<div style={{
    width: 'var(--activity-bar-width, 3rem)',
    padding: 'var(--density-padding-md, 0.75rem)'
}}>
```

### Class Variance Authority (CVA)

Use CVA for component variants:

```tsx
const buttonVariants = cva(
    "base classes here",
    {
        variants: {
            variant: {
                default: "default classes",
                destructive: "destructive classes",
            },
            size: {
                default: "h-11 px-6 py-2",
                sm: "h-9 px-3",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);
```

### Tailwind Merge

Always use the `cn()` utility from `@/lib/utils` to merge classes:

```tsx
import { cn } from "@/lib/utils";

<button className={cn(buttonVariants({ variant, size }), className)} />
```

### Framer Motion

- Use `motion` components for animations
- Apply subtle animations: `whileTap={{ scale: 0.98 }}`
- Keep animations performant (prefer transforms over layout changes)

## State Management

### Zustand Stores

- Place stores in `src/stores/`
- Use TypeScript interfaces for state
- Provide individual setter functions, not a generic `setState`
- Use persistence middleware for user preferences

```tsx
export interface SettingsState {
    theme: Theme;
    fontSize: number;
    setTheme: (theme: Theme) => void;
    setFontSize: (size: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'dark',
            fontSize: 14,
            setTheme: (theme) => set({ theme }),
            setFontSize: (fontSize) => set({ fontSize }),
        }),
        { name: 'fluxel-settings' }
    )
);
```

### Store Usage in Components

```tsx
// Good - destructure only what you need
const { theme, setTheme } = useSettingsStore();

// Avoid - getting entire store
const store = useSettingsStore();
```

## File Organization

### Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication UI
│   ├── editor/         # Editor components
│   ├── workbench/      # Workbench UI
│   └── ui/             # Reusable UI components
├── stores/             # Zustand state management
│   ├── workbench/      # Workbench-related stores
│   └── index.ts        # Store exports
├── lib/                # Utilities and helpers
│   ├── icons/          # Icon system
│   ├── languages/      # Language configurations
│   └── utils.ts        # General utilities
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

### File Naming

- **Components**: PascalCase - `ActivityBar.tsx`, `CodeEditor.tsx`
- **Utilities**: camelCase - `utils.ts`, `nodeResolver.ts`
- **Stores**: camelCase with prefix - `useWorkbenchStore.ts`, `useSettingsStore.ts`
- **Types**: camelCase - `icons.d.ts`, `editor.d.ts`

## Naming Conventions

### Variables and Functions

- Use camelCase: `isActive`, `handleClick`, `setActiveActivity`
- Boolean variables should be prefixed: `is`, `has`, `should`, `can`
- Event handlers should be prefixed: `handle`, `on`

```tsx
// Good
const isAuthenticated = true;
const hasPermission = checkPermission();
const handleSubmit = () => { /* ... */ };

// Avoid
const authenticated = true;
const permission = checkPermission();
const submit = () => { /* ... */ };
```

### Types and Interfaces

- Use PascalCase for types and interfaces
- Prefer `interface` for object shapes, `type` for unions/primitives
- Suffix props interfaces with `Props`

```tsx
// Good
interface ButtonProps {
    variant?: 'default' | 'outline';
    onClick?: () => void;
}

type Theme = 'light' | 'dark';
type AccentColor = 'orange' | 'blue' | 'green';

// Avoid
type buttonProps = {
    variant?: 'default' | 'outline';
}
```

### Constants

Use SCREAMING_SNAKE_CASE for true constants:

```tsx
const MAX_FILE_SIZE = 1024 * 1024 * 10; // 10MB
const DEFAULT_THEME = 'dark';
```

### CSS Variables

Use kebab-case with double-dash prefix for custom properties:

```css
--activity-bar-width
--density-padding-md
--status-bar-height
```

## Comments and Documentation

### When to Comment

- **Do**: Explain why, not what
- **Do**: Document complex algorithms or business logic
- **Do**: Add JSDoc for public APIs and utilities
- **Don't**: State the obvious
- **Don't**: Comment bad code—refactor it instead

```tsx
// Good
// Collapse sidebar if clicking the already-active item
if (activeActivity === activity && !isCollapsed) {
    panel.collapse();
}

// Avoid
// Set the state to true
setState(true);
```

### JSDoc for Public APIs

```tsx
/**
 * Resolves a Node.js module path within the project
 * @param moduleName - The module to resolve (e.g., 'react', '@types/node')
 * @param projectRoot - Absolute path to project root
 * @returns The resolved module path or null if not found
 */
export function resolveNodeModule(
    moduleName: string,
    projectRoot: string
): string | null {
    // Implementation
}
```

### TODOs and FIXMEs

Use standardized comment tags:

```tsx
// TODO: Add keyboard navigation support
// FIXME: Handle edge case when panel is already collapsed
// NOTE: This workaround is needed for Monaco editor theme loading
```

## Additional Guidelines

### Imports

Order imports logically:

1. External packages
2. Internal absolute imports (using `@/`)
3. Relative imports
4. Type imports (if separated)

```tsx
// External
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Internal absolute
import { useWorkbenchStore } from '@/stores';
import Button from '@/components/ui/button';

// Relative
import { calculateSize } from './utils';
```

### Async/Await

- Prefer `async/await` over promise chains
- Always handle errors in async functions

```tsx
// Good
try {
    const data = await fetchData();
    processData(data);
} catch (error) {
    console.error('Failed to fetch data:', error);
}

// Avoid
fetchData()
    .then(data => processData(data))
    .catch(error => console.error(error));
```

### Package Management

- **Always use Bun** for package management
- Never use npm, yarn, or pnpm
- Update dependencies regularly but test thoroughly

```bash
# Good
bun add package-name
bun remove package-name
bun install

# Never
npm install package-name
```

---

Following these standards ensures a consistent, maintainable, and high-quality codebase. When in doubt, look at existing code in the project for reference.
