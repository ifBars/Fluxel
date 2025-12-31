# Fluxel Design System

A comprehensive style guide for building a modern, themeable, human-first AI IDE.

---

## 1. Design Philosophy

## Vision
- Build a fast, lightweight IDE that launches instantly and stays responsive during long sessions.
- Ship a small binary by using Tauri and trimming every dependency that does not serve core editing speed.
- Favor a tight, custom feature set inspired by VSCode’s best ideas without inheriting its ecosystem bloat.
- Deliver a modern, minimal interface with the craft of Google’s best UIs; Antigravity IDE is a north star for feel.

## Product Pillars
- **Performance first**: optimize cold start, file search, editor interactions, and rendering before adding new surface area.
- **Lean footprint**: small install size, low memory usage, and predictable resource profiles.
- **Curated features**: built-in workflows we can polish deeply (navigation, search, git-aware editing, file ops) instead of a plugin bazaar.
- **Clarity in UI**: minimal chrome, strong hierarchy, focused color use, and purposeful motion; defaults should feel premium without configuration.
- **Keyboard-native**: every core action mapped and discoverable; mouse flows remain clean but secondary.

## Approach
- **Stack**: Tauri shell for size and native feel; React + Vite + Tailwind for UI; Monaco for editing; Zustand for state; Framer Motion for controlled motion.
- **Inspiration, not imitation**: borrow proven VSCode patterns (command palette, tabs, panels) but design interaction models and visuals for a smaller, faster tool.
- **Custom-first**: build features in-house where they unlock speed or coherence; integrations only when they do not dilute simplicity.
- **Quality bar**: measure success by latency, polish, and task completion speed rather than breadth of extensions.

## UX Principles
- **Modern minimalism**: restrained palette, generous spacing, crisp typography, and subtle depth; avoid cluttered toolbars.
- **Progressive disclosure**: keep the canvas focused while revealing advanced controls contextually.
- **Motion with intent**: small, meaningful transitions to reinforce hierarchy (panel resize, modal open/close), never for ornament.
- **Assistive defaults**: smart file icons, sensible theme, and sharp affordances that reduce setup time.

## Scope and Non-Goals
- Build a focused IDE for daily editing, navigation, and light project workflows.
- Do not replicate the full VSCode marketplace or its extension APIs.
- Avoid feature sprawl that compromises speed, simplicity, or build size.

## Early Targets
- Sub-1s cold start on typical projects; near-instant file switch and search.
- Clear, themeable layout with minimal chrome and excellent contrast.
- Polished primitives: file explorer, tabs, split panes, command palette, and git-aware status cues.
- Smooth, reliable builds for macOS, Windows, and Linux with minimal bundle size.

### Visual Reference
![Lemon UI Reference 1 (Dashboard)](C:/Users/ghost/.gemini/antigravity/brain/ecd3fa58-24b7-4539-a1c4-891310b906a8/uploaded_image_1765228875928.png)
![Lemon UI Reference 2 (Login)](C:/Users/ghost/.gemini/antigravity/brain/ecd3fa58-24b7-4539-a1c4-891310b906a8/uploaded_image_1765228972550.png)

---

## 2. Theming Architecture

### CSS Variable-Based Themes
All colors, radii, and spacing are defined as CSS custom properties. This enables:
- **Light/Dark modes** out of the box.
- **Future custom themes** by users (JSON → CSS variable injection).

### File Structure
```
src/
├── styles/
│   ├── index.css          # Tailwind v4 import, base theme variables
│   ├── themes/
│   │   ├── light.css      # Light theme overrides
│   │   └── dark.css       # Dark theme overrides
│   └── components.css     # Component-specific utility layers (optional)
├── lib/
│   └── utils.ts           # cn() helper (clsx + tailwind-merge)
└── components/
    └── ui/                # Reusable primitives
```

### Theme Switching
- Use a `data-theme="light|dark"` attribute on `<html>`.
- Tailwind v4's `@theme` and `@custom-variant` can define theme-specific styles.
- React context (`ThemeProvider`) manages state and persistence (localStorage).

---

## 3. Color Palette — Racing Orange

Using **OKLCH** for wider gamut. **Primary = Racing Orange (~50 hue)**.

| Token               | Light Mode                | Dark Mode                 |
|---------------------|---------------------------|---------------------------|
| `--background`      | `oklch(99% 0 0)`          | `oklch(18% 0.01 0)`       |
| `--foreground`      | `oklch(15% 0 0)`          | `oklch(95% 0 0)`          |
| `--card`            | `oklch(100% 0 0)`         | `oklch(22% 0.01 0)`       |
| `--card-foreground` | `oklch(15% 0 0)`          | `oklch(95% 0 0)`          |
| `--primary`         | `oklch(62% 0.22 50)`      | `oklch(68% 0.22 50)`      |
| `--primary-foreground`| `oklch(100% 0 0)`       | `oklch(100% 0 0)`         |
| `--muted`           | `oklch(96% 0.005 0)`      | `oklch(25% 0.01 0)`       |
| `--muted-foreground`| `oklch(45% 0.01 0)`       | `oklch(65% 0.01 0)`       |
| `--border`          | `oklch(92% 0.005 0)`      | `oklch(30% 0.01 0)`       |
| `--ring`            | `oklch(62% 0.22 50)`      | `oklch(68% 0.22 50)`      |
| `--accent`          | `oklch(55% 0.18 50)`      | `oklch(60% 0.2 50)`       |

> **Hue 50** = Racing Orange. Light theme uses pure white backgrounds; dark uses warm grays.

---

## 4. Typography

| Token         | Value                          |
|---------------|--------------------------------|
| `--font-sans` | `'Inter', system-ui, sans-serif` |
| `--font-mono` | `'JetBrains Mono', monospace`  |

### Scale (Tailwind defaults, customized)
- `text-xs`: 0.75rem
- `text-sm`: 0.875rem
- `text-base`: 1rem
- `text-lg`: 1.125rem
- `text-xl`–`text-4xl`: Headings

---

## 5. Spacing, Radius & Depth

| Token        | Value     |
|--------------|----------|
| `--radius`   | `0.75rem` |
| `--radius-sm`| `0.5rem`  |
| `--radius-lg`| `1rem`    |

### Shadows (Depth)
Use layered shadows for a floating, tactile feel.

| Token           | Value                                      |
|-----------------|-------------------------------------------|
| `--shadow-sm`   | `0 1px 2px oklch(0% 0 0 / 0.05)`           |
| `--shadow`      | `0 4px 12px oklch(0% 0 0 / 0.08)`          |
| `--shadow-lg`   | `0 12px 32px oklch(0% 0 0 / 0.12)`         |
| `--shadow-card` | `0 2px 8px oklch(0% 0 0 / 0.06), 0 0 1px oklch(0% 0 0 / 0.1)` |

> Apply `shadow-card` to `Card`, list items, and floating panels for subtle depth.

---

## 6. Core Components

All components use **CVA (Class Variance Authority)** for variant management.

### `Button`
Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`.
Sizes: `sm`, `default`, `lg`, `icon`.

### `Input`
Standard text input with focus ring using `--ring`.

### `Card`
Container with `--card` background, `--border`, and `--radius`.

### `Badge`
Small status indicators.

### `Tooltip` / `Popover`
For contextual information.

### `Dialog` / `Sheet`
Modal and slide-over panels.

---

## 7. Layout Components

### `SplitPane`
Resizable panels (for editor/preview/terminal layout).

### `Sidebar`
Collapsible navigation.

### `TopBar`
Window controls (Tauri), breadcrumbs, actions.

---

## 8. Animation Guidelines

Use `framer-motion` for:
- Page transitions (fade, slide).
- Component enter/exit (scale, opacity).
- Micro-interactions (button press, hover states).

Keep animations **subtle** and **fast** (<300ms).

---

## 9. Accessibility

- All interactive elements must have `focus-visible` styles.
- Color contrast ratios meet WCAG AA.
- Keyboard navigation for all UI.

---

## 10. Future: User Themes

- Themes stored as JSON: `{ "background": "...", "primary": "..." }`.
- UI for theme editor (color pickers, preview).
- Export/import themes.
