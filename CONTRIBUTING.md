# Contributing to Fluxel

Thank you for your interest in contributing to Fluxel! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Feature Flags](#feature-flags)
- [Getting Help](#getting-help)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Prioritize the project's best interests
- Show empathy towards other contributors

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Bun**: Package manager (required)
- **Rust**: Latest stable version
- **Node.js**: v18 or higher (for tooling compatibility)
- **Git**: For version control

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Rust

```bash
# Via rustup (recommended)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/fluxel.git
   cd fluxel
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/fluxel.git
   ```

4. **Install dependencies**:
   ```bash
   bun install
   ```

5. **Start development server**:
   ```bash
   bun run tauri dev
   ```

The app will launch with hot-reload enabled. Changes to frontend code will automatically refresh, while Rust changes require a rebuild.

## Development Workflow

### Creating a Feature Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Conventions

- **Features**: `feature/short-description`
- **Bug Fixes**: `fix/short-description`
- **Documentation**: `docs/short-description`
- **Performance**: `perf/short-description`
- **Refactoring**: `refactor/short-description`

Examples:
- `feature/add-terminal-panel`
- `fix/editor-theme-switching`
- `docs/update-readme`
- `perf/optimize-monaco-loading`

### Making Changes

1. **Read the Coding Standards**: Familiarize yourself with [CODING_STANDARDS.md](./CODING_STANDARDS.md)

2. **Keep changes focused**: Each PR should address a single concern

3. **Write clean code**: Follow existing patterns in the codebase

4. **Test your changes**: Ensure the app runs without errors

5. **Type check**: Run TypeScript type checking
   ```bash
   bun x tsc
   ```

### Working with Frontend (React/TypeScript)

- All frontend code lives in `src/`
- Use the `@/*` path alias for imports
- Follow React hooks best practices
- Use Zustand for state management
- Apply Tailwind CSS for styling

### Working with Backend (Rust/Tauri)

- All backend code lives in `src-tauri/src/`
- Commands go in `src-tauri/src/commands/`
- Services go in `src-tauri/src/services/`
- Use proper error handling with `Result<T, String>`
- Test commands via the Tauri IPC interface

### Adding New Commands

1. Create or modify a command module in `src-tauri/src/commands/`
2. Register the command in `src-tauri/src/lib.rs`
3. Add TypeScript bindings if needed
4. Document the command purpose and usage

Example:
```rust
// src-tauri/src/commands/my_feature.rs
#[tauri::command]
pub fn my_new_command(param: String) -> Result<String, String> {
    // Implementation
    Ok(format!("Processed: {}", param))
}

// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::my_feature::my_new_command,
])
```

### Adding New Dependencies

#### Frontend Dependencies

```bash
# Add a runtime dependency
bun add package-name

# Add a dev dependency
bun add -d package-name
```

#### Backend Dependencies

Edit `src-tauri/Cargo.toml`:
```toml
[dependencies]
my-crate = "1.0.0"
```

**Important**: Always justify new dependencies in your PR. Prefer existing solutions when possible to keep the bundle size small.

## Submitting Changes

### Before Submitting

- [ ] Code follows the [Coding Standards](./CODING_STANDARDS.md)
- [ ] TypeScript type checks pass (`bun x tsc`)
- [ ] App runs without errors in dev mode
- [ ] Changes are committed with clear messages
- [ ] Branch is up to date with `main`

### Sync with Upstream

```bash
git checkout main
git pull upstream main
git checkout your-feature-branch
git rebase main
```

### Push Your Changes

```bash
git push origin your-feature-branch
```

### Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the PR template (see below)
5. Submit the PR

## Coding Standards

All contributions must follow the project's coding standards. Please read [CODING_STANDARDS.md](./CODING_STANDARDS.md) before submitting code.

### Key Points

- **TypeScript**: Strict mode, no `any` types
- **React**: Functional components with hooks
- **Naming**: camelCase for variables, PascalCase for components
- **Formatting**: 4 spaces for indentation (TypeScript), 2 spaces (JSON/CSS)
- **Imports**: Use `@/*` path aliases
- **State**: Use Zustand stores, not prop drilling

## Testing

### Manual Testing

Currently, Fluxel primarily relies on manual testing:

1. **Start the dev server**: `bun run tauri dev`
2. **Test your feature**: Thoroughly exercise the functionality
3. **Check edge cases**: Test error states and boundary conditions
4. **Verify UI**: Ensure responsive design and theme compatibility
5. **Test builds**: Occasionally test production builds

### Type Checking

Always run type checking before submitting:

```bash
bun x tsc
```

Fix any type errors. Do not use `@ts-ignore` or `any` to bypass errors without good reason.

### Rust Checking

Verify Rust code compiles without warnings:

```bash
cd src-tauri
cargo check
```

## Project Structure

Understanding the project structure helps you navigate the codebase:

```
fluxel/
├── src/                        # Frontend source code
│   ├── components/            # React components
│   │   ├── auth/             # Authentication UI
│   │   ├── editor/           # Code/visual editor
│   │   ├── workbench/        # Main IDE workbench
│   │   └── ui/               # Reusable UI components
│   ├── stores/               # Zustand state management
│   ├── lib/                  # Utilities and helpers
│   ├── styles/               # Global styles (Tailwind v4)
│   └── types/                # TypeScript type definitions
├── src-tauri/                 # Backend source code (Rust)
│   ├── src/
│   │   ├── commands/         # Tauri command handlers
│   │   ├── services/         # Business logic services
│   │   ├── languages/        # LSP integrations
│   │   └── lib.rs            # Main Tauri setup
│   ├── capabilities/         # Tauri capabilities/permissions
│   └── Cargo.toml            # Rust dependencies
├── public/                    # Static assets
├── CLAUDE.md                  # AI assistant context
├── CODING_STANDARDS.md        # Coding standards (this is important!)
└── CONTRIBUTING.md            # This file
```

## Commit Guidelines

### Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Examples

```
feat(editor): add syntax highlighting for Rust

Implements syntax highlighting for Rust files using Monaco's
built-in Rust language support.

Closes #123
```

```
fix(workbench): resolve sidebar collapse animation glitch

The sidebar animation was stuttering when toggling quickly.
Added debouncing to prevent animation conflicts.
```

```
docs: update installation instructions in README
```

### Commit Best Practices

- Write clear, concise commit messages
- Use present tense ("add feature" not "added feature")
- Keep the subject line under 72 characters
- Reference issues and PRs when applicable
- Make atomic commits (one logical change per commit)

## Pull Request Process

### PR Title

Follow the same format as commit messages:

```
feat(scope): Brief description of change
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Motivation
Why is this change needed? What problem does it solve?

## Changes Made
- List key changes
- Be specific about modifications

## Testing
How has this been tested?
- [ ] Manual testing
- [ ] Type checking passes

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] My changes generate no new warnings or errors
- [ ] I have updated documentation as needed
```

### Review Process

1. **Automated Checks**: Ensure all CI checks pass (if configured)
2. **Code Review**: Wait for maintainer review
3. **Address Feedback**: Make requested changes
4. **Approval**: Once approved, your PR will be merged

### After Your PR is Merged

1. Delete your feature branch:
   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. Update your local main branch:
   ```bash
   git checkout main
   git pull upstream main
   ```

## Feature Flags

Fluxel uses feature flags for optional functionality. When adding feature-gated code:

### Rust Feature Flags

Define features in `src-tauri/Cargo.toml`:

```toml
[features]
profiling = []
```

Use in code:

```rust
#[cfg(feature = "profiling")]
mod profiling;

#[cfg(feature = "profiling")]
{
    // Feature-gated code
}
```

### Frontend Feature Detection

Check feature availability at runtime:

```tsx
const { isAvailable } = useProfilerStore();

{isAvailable && <ProfilerPanel />}
```

## Getting Help

### Resources

- **Documentation**: Check [CLAUDE.md](./CLAUDE.md) for project overview
- **Coding Standards**: See [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- **Issues**: Browse existing issues for context
- **Discussions**: Use GitHub Discussions for questions

### Communication

- **Ask Questions**: Don't hesitate to ask in PR comments or discussions
- **Be Patient**: Maintainers are volunteers and may take time to respond
- **Be Respectful**: Everyone is here to help the project succeed

### Common Issues

**Build fails after pulling latest changes**:
```bash
bun install  # Reinstall dependencies
```

**TypeScript errors in IDE but not in CLI**:
```bash
# Restart TypeScript server in your editor
# Or run type check manually
bun x tsc
```

**Tauri dev fails to start**:
```bash
# Clean and rebuild
cd src-tauri
cargo clean
cd ..
bun run tauri dev
```

## Tips for First-Time Contributors

1. **Start Small**: Begin with documentation, small bug fixes, or minor features
2. **Ask for Help**: If you're stuck, ask! The community is here to support you
3. **Read Existing Code**: Learn from the existing codebase patterns
4. **Follow the Standards**: Adhering to coding standards makes review easier
5. **Be Patient**: Code review takes time, and feedback is meant to help

## Recognition

All contributors will be recognized in the project. Your contributions, big or small, are valuable to Fluxel's success!

---

Thank you for contributing to Fluxel! Your efforts help make this project better for everyone.
