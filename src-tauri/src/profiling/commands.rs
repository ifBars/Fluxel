//! Tauri commands for the profiling subsystem.
//!
//! Exposes 4 commands to the frontend:
//! - `profiler_set_enabled` - Enable/disable span collection
//! - `profiler_get_status` - Get profiler status
//! - `profiler_get_recent_spans` - Get recent span summaries
//! - `profiler_get_attribution` - Get attribution report for a span tree

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::profiling::attribution::{AttributionEngine, AttributionReport};
use crate::profiling::buffer::{SpanId, SpanSummary};
use crate::profiling::FluxelProfiler;

/// Profiler status response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilerStatus {
    /// Whether profiling is enabled.
    pub enabled: bool,
    /// Number of spans currently stored.
    pub span_count: usize,
    /// Maximum buffer capacity.
    pub buffer_capacity: usize,
}

/// Enable or disable span collection.
#[tauri::command]
pub fn profiler_set_enabled(state: State<'_, FluxelProfiler>, enabled: bool) {
    state.set_enabled(enabled);
    println!(
        "[Profiling] Collection {}",
        if enabled { "enabled" } else { "disabled" }
    );
}

/// Get the current profiler status.
#[tauri::command]
pub fn profiler_get_status(state: State<'_, FluxelProfiler>) -> ProfilerStatus {
    ProfilerStatus {
        enabled: state.is_enabled(),
        span_count: state.span_count(),
        buffer_capacity: state.capacity(),
    }
}

/// Get the most recent spans.
///
/// # Arguments
/// * `limit` - Maximum number of spans to return (default: 100)
#[tauri::command]
pub fn profiler_get_recent_spans(
    state: State<'_, FluxelProfiler>,
    limit: Option<usize>,
) -> Vec<SpanSummary> {
    state.recent_spans(limit.unwrap_or(100))
}

/// Get an attribution report for a span tree.
///
/// # Arguments
/// * `root_span_id` - The ID of the root span to analyze
#[tauri::command]
pub fn profiler_get_attribution(
    state: State<'_, FluxelProfiler>,
    root_span_id: String,
) -> Result<AttributionReport, String> {
    // Parse span ID
    let root_id: SpanId = root_span_id
        .parse()
        .map_err(|_| format!("Invalid span ID: {}", root_span_id))?;

    // Get span tree
    let tree = state.get_span_tree(root_id);

    if tree.is_empty() {
        return Err(format!("Span not found: {}", root_span_id));
    }

    // Find root span in tree
    let root = tree
        .iter()
        .find(|s| s.id == root_span_id)
        .cloned()
        .ok_or_else(|| format!("Root span not found in tree: {}", root_span_id))?;

    // Generate attribution report
    let report = AttributionEngine::analyze(root, &tree);

    Ok(report)
}

/// Clear all stored spans (useful for resetting between profiling sessions).
#[tauri::command]
pub fn profiler_clear(state: State<'_, FluxelProfiler>) {
    state.clear();
    println!("[Profiling] Buffer cleared");
}
