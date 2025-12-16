# Fluxel Project Overview

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
