/**
 * Services Module
 * 
 * This module exports all services for the Fluxel IDE, organized by domain:
 * 
 * - profiling/: Performance profiling and benchmarking utilities
 * - build/: Build system orchestration
 * - workspace/: Project lifecycle management
 * - tauri/: Low-level Tauri backend wrappers
 */

// Domain-specific service exports
export * from './profiling';
export * from './build';
export * from './workspace';
export * from './tauri';

// Legacy re-exports for backwards compatibility
// These point to the new locations but maintain the old import paths
export { ProfilerService } from './profiling';
export { FrontendProfiler } from './profiling';
export { PerformanceBenchmark } from './profiling';
export { executeBuild, executeTypeCheck, type BuildOptions, type BuildResult } from './build';
export { openWorkspace, closeWorkspace, initializeProjectOrchestrator, shouldLoadCSharpConfigurations, shouldHydrateTypeScriptWorkspace } from './workspace';
export { batchReadFiles, batchDiscoverTypings, countPackageTypeFiles } from './tauri';
export { resolveNodeModule, discoverPackageTypings, discoverTypingsForPackages, analyzeModuleGraph } from './tauri';
export { ProcessManager, registerProcess, unregisterProcess, killAllProcesses, getTrackedCount, isTracked } from './tauri';
