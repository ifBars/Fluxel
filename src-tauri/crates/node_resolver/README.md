# Fluxel Node Resolver

Node-style module resolver and lightweight module analyzer for Fluxel.

A pure Rust library that provides Node.js-compatible module resolution, TypeScript typing discovery, and module dependency analysis for the Fluxel IDE.

## Usage

The crate exports native Rust functions that can be used directly in Rust code:

```rust
use fluxel_node_resolver::{
    resolve_module_native, 
    discover_typings_native, 
    analyze_module_native,
    ResolveRequest, 
    ResolveOptions
};

// Resolve a module
let result = resolve_module_native(
    ResolveRequest {
        specifier: "react".to_string(),
        importer: "/path/to/file.ts".to_string(),
        project_root: Some("/path/to/project".to_string()),
    },
    Some(ResolveOptions::default()),
)?;

// Discover TypeScript typings for a package
let typings = discover_typings_native(
    "react",
    &Utf8PathBuf::from("/path/to/project")
)?;

// Analyze module imports/exports
let analysis = analyze_module_native(
    &Utf8PathBuf::from("/path/to/file.ts")
)?;
```

## Core Functions

### `resolve_module_native`

Resolves a module specifier to its file path using Node.js resolution semantics. Supports:
- Relative and absolute paths
- Node.js package resolution (`node_modules`)
- Package.json `exports` field with conditions
- CommonJS and ESM formats
- TypeScript file extensions

### `discover_typings_native`

Discovers TypeScript type definition files for a given package. Searches for:
- `@types/*` packages
- `types` field in package.json
- `.d.ts` files in package directories

### `analyze_module_native`

Analyzes a module's imports and exports using SWC. Returns:
- List of imported modules
- List of exported symbols
- Transformed/parsed module content

## Types

- `ResolveRequest` - Input for module resolution
- `ResolveOptions` - Configuration for resolution (conditions, extensions, etc.)
- `ResolveResponse` - Result of module resolution
- `TypingsResponse` - Result of typing discovery
- `AnalyzeResponse` - Result of module analysis
- `ModuleFormat` - Enum for module format (ESM, CommonJS, TypeDefinition, Unknown)

## Testing

```bash
cd src-tauri
cargo test
```

