/**
 * Monaco TypeScript language wiring (VSCode-style)
 *
 * Centralizes configuration of the Monaco TypeScript worker and hydration
 * of project types/models so we get real IntelliSense instead of syntax-only mode.
 */
import type * as Monaco from 'monaco-editor';
import { loadProjectTypes, clearProjectTypes } from './TypeLoader';
import { registerProjectSourceFiles, clearProjectSourceModels } from './SourceManager';

type MonacoInstance = typeof Monaco;

/**
 * Configure Monaco's TypeScript/Javascript defaults similarly to VSCode.
 */
export function configureTypeScriptLanguage(monaco: MonacoInstance): void {
    const ts = monaco.typescript;

    // Keep worker models in sync and alive for cross-file IntelliSense
    ts.typescriptDefaults.setEagerModelSync?.(true);
    ts.javascriptDefaults.setEagerModelSync?.(true);

    // Baseline compiler options; tsconfig hydration will refine these.
    // Apply to BOTH TS and JS defaults so JS files get DOM/lib types too.
    const baseOptions: Monaco.typescript.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        noEmit: true,
        noLib: false, // Ensure default libs are loaded
        lib: ['es2015', 'es2020', 'dom', 'dom.iterable', 'webworker.importscripts'],
    };
    ts.typescriptDefaults.setCompilerOptions(baseOptions);
    ts.javascriptDefaults.setCompilerOptions(baseOptions);

    console.log('[Monaco TS] TS compiler options set:', ts.typescriptDefaults.getCompilerOptions());
    console.log('[Monaco TS] JS compiler options set:', ts.javascriptDefaults.getCompilerOptions());

    // Enable full diagnostics and suggestions
    ts.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
    });
    ts.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
    });
}

/**
 * Hydrate Monaco with project-aware types and source models.
 */
export async function hydrateTypeScriptWorkspace(
    projectRoot: string,
    monaco: MonacoInstance
): Promise<void> {
    // Load node_modules/@types + tsconfig compiler options
    await loadProjectTypes(projectRoot, monaco);

    // Mirror project source files into Monaco models for cross-file resolution
    await registerProjectSourceFiles(projectRoot, monaco);
}

/**
 * Clear Monaco's project-specific state.
 */
export function resetTypeScriptWorkspace(monaco: MonacoInstance): void {
    clearProjectSourceModels(monaco);
    clearProjectTypes(monaco);
    configureTypeScriptLanguage(monaco);
}
