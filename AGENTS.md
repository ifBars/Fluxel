# Repository Guidelines

## Project Structure & Module Organization

- `src/`: React + TypeScript frontend (UI in `src/components/`, Zustand stores in `src/stores/`, shared utilities in `src/lib/`, styles in `src/styles/`).
- `src-tauri/`: Tauri v2 Rust backend (commands in `src-tauri/src/*.rs`, config in `src-tauri/tauri.conf.json`).
- `src-tauri/crates/node_resolver/`: Rust workspace crate for Node-style module resolution (tests in `src-tauri/crates/node_resolver/tests/`).
- `public/` and `src/assets/`: static assets.
- `dist/`, `src-tauri/target/`, `node_modules/`: build artifacts; don’t commit.
- `my-digital-space/`: separate Vite project (not required for the Fluxel app).

## Making Changes Guidelines

When making changes requested by the user, do NOT write a summary into a file, as this is excessive token usage that we do not need.

## Build, Test, and Development Commands

This repo is configured to use Bun (see `src-tauri/tauri.conf.json`).

- `bun install`: install JS dependencies.
- `bun run dev`: run Vite dev server (port `1420`).
- `bun run tauri dev`: run the desktop app (Tauri + Vite).
- `bun run build`: type-check (`tsc`) and build the frontend (`vite build`).
- `bun run tauri build`: produce a desktop release build.
- `cd src-tauri && cargo test`: run Rust tests.
- `cd src-tauri && cargo fmt && cargo clippy`: format and lint Rust.

## Coding Style & Naming Conventions

- TypeScript/React: 2-space indentation, double quotes, semicolons; keep imports using `@/…` (alias to `src/`).
- Components use `PascalCase.tsx`; hooks/stores use `useX…` (e.g. `useSettingsStore` in `src/stores/`).
- Rust: run `cargo fmt`; modules/files are `snake_case.rs`. Tauri commands use `#[tauri::command]`.

## Testing Guidelines

- Rust uses the built-in test harness (`#[test]`), with integration tests under `src-tauri/crates/**/tests/`.
- Frontend tests are not currently wired up; if adding tests, include the runner + a `bun run test` script in the same PR.

## Commit & Pull Request Guidelines

- Commit messages are typically imperative; many follow Conventional Commits (e.g. `feat: …`, `fix: …`). Prefer `feat:`/`fix:` when applicable.
- PRs should include: a clear description, linked issue (if any), and screenshots/GIFs for UI changes.
- Before opening a PR, ensure `bun run build` and `cd src-tauri && cargo test` pass.

