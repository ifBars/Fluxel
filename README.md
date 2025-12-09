# Fluxel

A Tauri desktop code editor with visual editing capabilities.

## Configuration Metadata Parsing

Fluxel automatically parses common framework configuration files to extract project metadata, such as dev server ports, build settings, and framework information. This metadata is used throughout the application (e.g., preview functionality) to provide a better developer experience.

### Supported Config Files

- **Vite** (`vite.config.ts`, `vite.config.js`) - Extracts dev server port, HMR settings, and build output directory
- **package.json** - Extracts project info, dependencies, scripts, and TypeScript usage
- **tauri.conf.json** - Extracts Tauri-specific configuration (window settings, build commands, etc.)
- **tsconfig.json** - Extracts TypeScript path aliases and compiler options

### How It Works

1. When a project is opened, Fluxel automatically loads and parses all relevant config files
2. Parsed metadata is stored in a persisted Zustand store (`useConfigMetadataStore`) keyed by project root path
3. The metadata is used by various features (e.g., preview uses the configured dev server port)
4. Metadata is cached and can be reloaded on demand

### Extending the Parser System

To add support for additional framework config files:

1. Create a new parser in `src/lib/config/parsers/` (e.g., `next.ts` for Next.js)
2. Implement a parser function that returns `ConfigResult<Partial<ConfigMetadata>>`
3. Add the parser to the `loadConfigMetadata` function in `src/lib/config/loader.ts`
4. Update the `ConfigMetadata` type if new fields are needed

Example parser structure:
```typescript
export async function parseNextConfig(
  projectRoot: string
): Promise<ConfigResult<{ devServer: DevServerConfig }>> {
  // Parse next.config.js/ts and extract relevant fields
  // Return ConfigResult with extracted data
}
```

### Metadata Store

The config metadata is stored in `useConfigMetadataStore` and can be accessed throughout the application:

```typescript
import { useConfigMetadataStore } from '@/stores/useConfigMetadataStore';

const metadata = useConfigMetadataStore.getState().getMetadata(projectRoot);
const devServerPort = metadata?.devServer?.port;
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
