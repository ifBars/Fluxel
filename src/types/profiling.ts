/**
 * Fluxel Performance Profiling Types
 * 
 * TypeScript types for the profiling API exposed by the Rust backend.
 * These types mirror the Rust structs in src-tauri/src/profiling/.
 */

/**
 * Category of a span for attribution grouping.
 */
export type SpanCategory =
    | 'tauri_command'
    | 'file_io'
    | 'git_operation'
    | 'lsp_request'
    | 'search'
    | 'workspace'
    | 'other';

/**
 * Summary of a completed span.
 */
export interface SpanSummary {
    /** Unique identifier for this span */
    id: string;
    /** Parent span ID, if any */
    parentId: string | null;
    /** Span name (usually function name) */
    name: string;
    /** Tracing target (usually module path) */
    target: string;
    /** Inferred category for grouping */
    category: SpanCategory;
    /** Relative start time in milliseconds */
    startTimeMs: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** Captured fields as key-value pairs */
    fields: [string, string][];
}

/**
 * Profiler status information.
 */
export interface ProfilerStatus {
    /** Whether profiling is enabled */
    enabled: boolean;
    /** Number of spans currently stored */
    spanCount: number;
    /** Maximum buffer capacity */
    bufferCapacity: number;
}

/**
 * Breakdown of time spent in a specific category.
 */
export interface CategoryBreakdown {
    /** The category */
    category: SpanCategory;
    /** Total wall-clock time in this category */
    totalTimeMs: number;
    /** Self time (excluding time in child spans) */
    selfTimeMs: number;
    /** Percentage of total operation time */
    percentage: number;
    /** Number of spans in this category */
    spanCount: number;
}

/**
 * Complete attribution report for an operation.
 */
export interface AttributionReport {
    /** The root span of the operation */
    rootSpan: SpanSummary;
    /** Total wall-clock time for the operation */
    totalTimeMs: number;
    /** Breakdown by category */
    breakdowns: CategoryBreakdown[];
    /** Critical path - spans that determined total time */
    criticalPath: SpanSummary[];
    /** Top spans by self-time (hotspots) */
    hotspots: SpanSummary[];
}

/**
 * Profiler API functions.
 * 
 * These map to the Tauri commands in src-tauri/src/profiling/commands.rs
 */
export interface ProfilerApi {
    /** Enable or disable profiling */
    setEnabled: (enabled: boolean) => Promise<void>;
    /** Get current profiler status */
    getStatus: () => Promise<ProfilerStatus>;
    /** Get recent spans */
    getRecentSpans: (limit?: number) => Promise<SpanSummary[]>;
    /** Get attribution report for a span tree */
    getAttribution: (rootSpanId: string) => Promise<AttributionReport>;
    /** Clear all stored spans */
    clear: () => Promise<void>;
}
