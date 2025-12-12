/**
 * Batch File Service
 * 
 * TypeScript wrapper for the Rust batch file operations.
 * Used by the TypeLoader for efficient type file reading.
 */

import { invoke } from '@tauri-apps/api/core';

export interface TypingsResponse {
    package_name: string;
    files: string[];
    package_json: string | null;
}

/**
 * Read multiple files in parallel via Rust backend.
 * Returns a map of path -> content for successfully read files.
 */
export async function batchReadFiles(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {};

    return invoke<Record<string, string>>('batch_read_files', { paths });
}

/**
 * Batch discover typings for multiple packages.
 * More efficient than calling discover_package_typings N times.
 */
export async function batchDiscoverTypings(
    packageNames: string[],
    projectRoot: string
): Promise<TypingsResponse[]> {
    if (packageNames.length === 0) return [];

    return invoke<TypingsResponse[]>('batch_discover_typings', {
        packageNames,
        projectRoot,
    });
}

/**
 * Get the count of type files that would be loaded for given packages.
 * Useful for progress indication.
 */
export async function countPackageTypeFiles(
    packageNames: string[],
    projectRoot: string
): Promise<number> {
    if (packageNames.length === 0) return 0;

    return invoke<number>('count_package_type_files', {
        packageNames,
        projectRoot,
    });
}
