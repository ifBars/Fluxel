/**
 * ProfilerService - Core Tauri profiling API wrapper
 * 
 * Provides a typed interface to all profiling Tauri commands.
 * All methods are no-ops if profiling is not available (production builds).
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type {
    ProfilerStatus,
    SpanSummary,
    AttributionReport,
    FrontendSpanInput,
    SessionReport,
    ExportFormat,
} from '@/types/profiling';

/**
 * Check if profiling commands are available.
 * In production builds, profiling commands are not registered.
 */
let isProfilingAvailable: boolean | null = null;
let profilingCheckPromise: Promise<boolean> | null = null;

async function checkProfilingAvailable(): Promise<boolean> {
    if (isProfilingAvailable !== null) {
        return isProfilingAvailable;
    }

    // Deduplicate concurrent checks
    if (profilingCheckPromise) {
        return profilingCheckPromise;
    }

    profilingCheckPromise = (async () => {
        try {
            await invoke('profiler_get_status');
            isProfilingAvailable = true;
        } catch {
            isProfilingAvailable = false;
            console.log('[Profiler] Profiling not available (production build or feature disabled)');
        }
        return isProfilingAvailable;
    })();

    return profilingCheckPromise;
}

/**
 * Synchronous check for profiling availability.
 * Returns false if we haven't checked yet (to avoid blocking).
 */
function isProfilingAvailableSync(): boolean {
    return isProfilingAvailable === true;
}

// =============================================================================
// Span Batching for Performance
// =============================================================================

const pendingSpans: FrontendSpanInput[] = [];
let flushScheduled = false;
const BATCH_FLUSH_INTERVAL = 50; // ms - flush every 50ms max

function scheduleFlush(): void {
    if (flushScheduled || pendingSpans.length === 0) return;
    flushScheduled = true;
    
    // Use setTimeout for batching - low priority, won't block UI
    setTimeout(flushPendingSpans, BATCH_FLUSH_INTERVAL);
}

async function flushPendingSpans(): Promise<void> {
    flushScheduled = false;
    
    if (pendingSpans.length === 0) return;
    if (!isProfilingAvailableSync()) {
        pendingSpans.length = 0; // Clear if profiling not available
        return;
    }
    
    // Take all pending spans
    const spans = pendingSpans.splice(0, pendingSpans.length);
    
    try {
        // Send all spans in a single IPC call
        await invoke('profiler_record_frontend_spans_batch', { spans });
    } catch {
        // If batch command doesn't exist, fall back to individual calls
        // This maintains backwards compatibility
        for (const span of spans) {
            invoke('profiler_record_frontend_span', { span }).catch(() => {});
        }
    }
}

/**
 * Queue a span for batched recording.
 * This is fire-and-forget - spans are batched and sent periodically.
 */
function queueSpan(span: FrontendSpanInput): void {
    // Early exit if we know profiling isn't available
    if (isProfilingAvailable === false) return;
    
    pendingSpans.push(span);
    scheduleFlush();
}

// =============================================================================
// Basic Commands
// =============================================================================

/**
 * Enable or disable profiling.
 */
export async function setEnabled(enabled: boolean): Promise<void> {
    if (!await checkProfilingAvailable()) return;
    await invoke('profiler_set_enabled', { enabled });
}

/**
 * Get current profiler status.
 */
export async function getStatus(): Promise<ProfilerStatus | null> {
    if (!await checkProfilingAvailable()) return null;
    return invoke<ProfilerStatus>('profiler_get_status');
}

/**
 * Get recent spans.
 */
export async function getRecentSpans(limit = 100): Promise<SpanSummary[]> {
    if (!await checkProfilingAvailable()) return [];
    return invoke<SpanSummary[]>('profiler_get_recent_spans', { limit });
}

/**
 * Get attribution report for a span tree.
 */
export async function getAttribution(rootSpanId: string): Promise<AttributionReport | null> {
    if (!await checkProfilingAvailable()) return null;
    return invoke<AttributionReport>('profiler_get_attribution', { rootSpanId });
}

/**
 * Clear all stored spans.
 */
export async function clear(): Promise<void> {
    if (!await checkProfilingAvailable()) return;
    await invoke('profiler_clear');
}

// =============================================================================
// Session Commands
// =============================================================================

/**
 * Start a named profiling session.
 * @returns Session ID to use when ending the session
 */
export async function startSession(name: string): Promise<string | null> {
    if (!await checkProfilingAvailable()) return null;
    return invoke<string>('profiler_start_session', { name });
}

/**
 * End a profiling session and get the report.
 */
export async function endSession(sessionId: string): Promise<SessionReport | null> {
    if (!await checkProfilingAvailable()) return null;
    return invoke<SessionReport>('profiler_end_session', { sessionId });
}

// =============================================================================
// Frontend Span Recording
// =============================================================================

/**
 * Record a span from the frontend.
 * This allows React/TypeScript code to record profiling data.
 * 
 * Note: Spans are batched and sent asynchronously for performance.
 * This function returns immediately and does not block.
 */
export async function recordFrontendSpan(span: FrontendSpanInput): Promise<void> {
    // Use the fast path - queue for batching
    queueSpan(span);
}

// =============================================================================
// Export Commands
// =============================================================================

/**
 * Export profiling data in the specified format.
 * @param format Export format: "json" or "chrome_trace"
 * @param sessionName Name to include in the export (for Chrome Trace)
 * @param limit Maximum number of spans to export
 * @returns Exported data as a string
 */
export async function exportData(
    format: ExportFormat,
    sessionName?: string,
    limit?: number
): Promise<string | null> {
    if (!await checkProfilingAvailable()) {
        console.warn('[Profiler] Profiling not available');
        return null;
    }
    try {
        // Tauri automatically converts camelCase to snake_case for command parameters
        return await invoke<string>('profiler_export', { 
            format, 
            sessionName: sessionName || null, 
            limit: limit || null 
        });
    } catch (error) {
        console.error('[Profiler] Failed to export data:', error);
        throw error;
    }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if profiling is available in this build.
 */
export async function isAvailable(): Promise<boolean> {
    return checkProfilingAvailable();
}

/**
 * Download export data as a file using Tauri's save dialog.
 * This allows users to choose where to save the file.
 */
export async function downloadExport(
    format: ExportFormat,
    filename?: string,
    sessionName?: string
): Promise<void> {
    try {
        console.log('[Profiler] Starting export:', { format, sessionName });
        const data = await exportData(format, sessionName);
        
        if (!data) {
            const errorMsg = 'No profiling data available to export. Make sure profiling is enabled and you have recorded some spans.';
            console.error('[Profiler]', errorMsg);
            alert(errorMsg);
            return;
        }

        if (data.trim() === '[]' || data.trim() === '{}') {
            const errorMsg = 'No profiling data to export. The export is empty. Make sure you have recorded some spans before exporting.';
            console.warn('[Profiler]', errorMsg);
            alert(errorMsg);
            return;
        }

        const extension = format === 'json' ? '.json' : '.json';
        const defaultFilename = filename || `fluxel-profiling-${sessionName || 'export'}-${Date.now()}${extension}`;

        // Use Tauri's save dialog to let user choose where to save
        const filePath = await save({
            defaultPath: defaultFilename,
            filters: [{
                name: format === 'json' ? 'JSON' : 'Chrome Trace',
                extensions: ['json']
            }],
            title: `Save Profiling Export (${format === 'json' ? 'JSON' : 'Chrome Trace'})`
        });

        if (!filePath) {
            // User cancelled the save dialog
            console.log('[Profiler] Export cancelled by user');
            return;
        }

        // Write the file using Tauri's fs plugin
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(filePath, data);
        
        console.log('[Profiler] Export completed successfully:', filePath);
    } catch (error) {
        const errorMsg = `Failed to export profiling data: ${error instanceof Error ? error.message : String(error)}`;
        console.error('[Profiler]', errorMsg, error);
        alert(errorMsg);
        throw error;
    }
}

// Default export as an object for convenience
export const ProfilerService = {
    // Basic commands
    setEnabled,
    getStatus,
    getRecentSpans,
    getAttribution,
    clear,

    // Session commands
    startSession,
    endSession,

    // Frontend span recording
    recordFrontendSpan,

    // Export
    exportData,
    downloadExport,

    // Utilities
    isAvailable,
};

// Eagerly check profiling availability so that sync checks work
// This is fire-and-forget - we don't block on it
checkProfilingAvailable().catch(() => {});

export default ProfilerService;
