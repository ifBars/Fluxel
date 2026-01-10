/**
 * Process Manager Service
 * 
 * Tracks spawned child processes and coordinates cleanup with the Rust backend.
 * Ensures dev servers and other child processes are properly terminated when
 * the app closes, project is closed, or user disconnects.
 */

import { invoke } from '@tauri-apps/api/core';

/** Set of PIDs currently being tracked on the frontend */
const trackedPids = new Set<number>();

/**
 * Register a child process PID with both frontend and backend tracking
 */
export async function registerProcess(pid: number): Promise<void> {
    trackedPids.add(pid);
    console.log('[ProcessManager] Registering PID:', pid);

    try {
        await invoke('register_child_process', { pid });
    } catch (error) {
        console.error('[ProcessManager] Failed to register PID with backend:', error);
    }
}

/**
 * Unregister a child process PID (call when process exits normally)
 */
export async function unregisterProcess(pid: number): Promise<void> {
    trackedPids.delete(pid);
    console.log('[ProcessManager] Unregistering PID:', pid);

    try {
        await invoke('unregister_child_process', { pid });
    } catch (error) {
        console.error('[ProcessManager] Failed to unregister PID with backend:', error);
    }
}

/**
 * Kill all tracked child processes
 * Called during app cleanup, project close, etc.
 */
export async function killAllProcesses(): Promise<void> {
    if (trackedPids.size === 0) {
        console.log('[ProcessManager] No tracked processes to kill');
        return;
    }

    console.log('[ProcessManager] Killing all tracked processes:', Array.from(trackedPids));

    try {
        await invoke('kill_all_child_processes');
        trackedPids.clear();
    } catch (error) {
        console.error('[ProcessManager] Failed to kill processes:', error);
    }
}

/**
 * Get the count of currently tracked processes
 */
export function getTrackedCount(): number {
    return trackedPids.size;
}

/**
 * Check if a specific PID is being tracked
 */
export function isTracked(pid: number): boolean {
    return trackedPids.has(pid);
}

// Default export as a namespace-like object
export const ProcessManager = {
    registerProcess,
    unregisterProcess,
    killAllProcesses,
    getTrackedCount,
    isTracked,
};

export default ProcessManager;
