/**
 * Tauri Services
 * 
 * Low-level TypeScript wrappers for Tauri backend commands.
 * These provide typed interfaces to the Rust backend functionality.
 */

// Batch file operations
export * from './BatchFileService';

// Node.js module resolution (explicit exports to avoid TypingsResponse conflict)
export {
    resolveNodeModule,
    discoverPackageTypings,
    discoverTypingsForPackages,
    analyzeModuleGraph,
    type ModuleFormat,
    type ResolveOptions,
    type ResolveResponse,
    type AnalyzeResponse,
} from './NodeResolverService';

// Child process lifecycle management
export * from './ProcessManager';
export { ProcessManager, default as ProcessManagerDefault } from './ProcessManager';

