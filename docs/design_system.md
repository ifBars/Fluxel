# Fluxel Design System

A comprehensive style guide for building a modern, themeable, human-first AI IDE.

---

## 1. Design Philosophy

**Fluxel** aims to blend the precision of **Cursor** with the approachable, "vibe-coding" aesthetic of **Lovable**. The result should feel:

- **Human-in-the-loop**: Fluxel empowers users to manually edit component options (typography, layout, etc.), treating AI as a collaborator rather than a replacement. This saves tokens and ensures precision.
- **Lightweight**: Fluxel should be easy to use and understand, with minimal complexity, and should be fast to load and run, with fluent UI/UX that doesn't freeze or leave the user out of the loop.
- **Visual Uniqueness**: NO default Shadcn/Tailwind styles. Every component must be custom-styled to ensure a unique identity.
- **Minimalist with depth**: Generous whitespace, but elements have presence via shadows and layering.

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
