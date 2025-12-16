//! Ring buffer for bounded span storage.
//!
//! Provides O(1) push and efficient iteration over recent entries.
//! When capacity is reached, oldest entries are automatically dropped.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::Instant;

/// Unique identifier for a span, derived from tracing's span ID.
pub type SpanId = u64;

/// Category of a span for attribution grouping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpanCategory {
    TauriCommand,
    FileIo,
    GitOperation,
    LspRequest,
    Search,
    Workspace,
    /// React component renders tracked via useProfiler hook
    FrontendRender,
    /// User interactions (clicks, inputs) tracked from frontend
    FrontendInteraction,
    /// Frontend network/API calls
    FrontendNetwork,
    /// Generic backend operation
    BackendOperation,
    Other,
}

impl SpanCategory {
    /// Infer category from span name and target.
    pub fn from_span(name: &str, target: &str, fields: &[(String, String)]) -> Self {
        // Check explicit category field first
        for (key, value) in fields {
            if key == "category" {
                return match value.as_str() {
                    "git" => SpanCategory::GitOperation,
                    "lsp" => SpanCategory::LspRequest,
                    "search" => SpanCategory::Search,
                    "workspace" => SpanCategory::Workspace,
                    "file_io" => SpanCategory::FileIo,
                    "frontend_render" => SpanCategory::FrontendRender,
                    "frontend_interaction" => SpanCategory::FrontendInteraction,
                    "frontend_network" => SpanCategory::FrontendNetwork,
                    "tauri_command" => SpanCategory::TauriCommand,
                    _ => SpanCategory::Other,
                };
            }
        }

        // Infer from name/target patterns
        let name_lower = name.to_lowercase();
        let target_lower = target.to_lowercase();
        let is_frontend = target == "frontend";

        if name_lower.contains("git") || target_lower.contains("git") {
            SpanCategory::GitOperation
        } else if name_lower.contains("lsp") || target_lower.contains("lsp") {
            SpanCategory::LspRequest
        } else if name_lower.contains("search") {
            SpanCategory::Search
        } else if name_lower.contains("directory") || name_lower.contains("file") {
            SpanCategory::FileIo
        } else if target_lower.contains("tauri") || name_lower.starts_with("command") {
            SpanCategory::TauriCommand
        } else if !is_frontend {
            // If it's not explicitly frontend and matched nothing else, it's a generic backend op
            SpanCategory::BackendOperation
        } else {
            SpanCategory::Other
        }
    }
}

/// A completed span with timing information.
#[derive(Debug, Clone)]
pub struct CompletedSpan {
    /// Unique identifier for this span.
    pub id: SpanId,
    /// Parent span ID, if any.
    pub parent_id: Option<SpanId>,
    /// Span name (usually function name).
    pub name: String,
    /// Tracing target (usually module path).
    pub target: String,
    /// Inferred category for grouping.
    pub category: SpanCategory,
    /// When the span was entered.
    pub start_time: Instant,
    /// When the span was closed.
    #[allow(dead_code)]
    pub end_time: Instant,
    /// Total wall-clock duration in nanoseconds.
    pub duration_ns: u64,
    /// Captured field values.
    pub fields: Vec<(String, String)>,
}

impl CompletedSpan {
    /// Duration in milliseconds.
    pub fn duration_ms(&self) -> f64 {
        self.duration_ns as f64 / 1_000_000.0
    }
}

/// Serializable span summary for Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanSummary {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub target: String,
    pub category: SpanCategory,
    /// Relative start time in milliseconds (from buffer start).
    pub start_time_ms: f64,
    /// Duration in milliseconds.
    pub duration_ms: f64,
    /// Captured fields as key-value pairs.
    pub fields: Vec<(String, String)>,
}

impl SpanSummary {
    /// Create from a completed span, using a reference time for relative timestamps.
    pub fn from_completed(span: &CompletedSpan, reference_time: Instant) -> Self {
        let start_offset = span.start_time.duration_since(reference_time);

        Self {
            id: span.id.to_string(),
            parent_id: span.parent_id.map(|id| id.to_string()),
            name: span.name.clone(),
            target: span.target.clone(),
            category: span.category,
            start_time_ms: start_offset.as_secs_f64() * 1000.0,
            duration_ms: span.duration_ms(),
            fields: span.fields.clone(),
        }
    }
}

/// Bounded ring buffer for span storage.
///
/// Thread-safe wrapper around VecDeque with automatic eviction
/// of oldest entries when capacity is reached.
pub struct RingBuffer {
    data: VecDeque<CompletedSpan>,
    capacity: usize,
    /// Reference time for relative timestamps (first span's start time).
    reference_time: Option<Instant>,
}

impl RingBuffer {
    /// Create a new ring buffer with the given capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            data: VecDeque::with_capacity(capacity),
            capacity,
            reference_time: None,
        }
    }

    /// Push a span into the buffer. Evicts oldest if at capacity.
    pub fn push(&mut self, span: CompletedSpan) {
        // Set reference time from first span
        if self.reference_time.is_none() {
            self.reference_time = Some(span.start_time);
        }

        // Evict oldest if at capacity
        if self.data.len() >= self.capacity {
            self.data.pop_front();
        }

        self.data.push_back(span);
    }

    /// Get the most recent N spans.
    pub fn recent(&self, limit: usize) -> Vec<SpanSummary> {
        let reference = self.reference_time.unwrap_or_else(Instant::now);

        self.data
            .iter()
            .rev()
            .take(limit)
            .map(|span| SpanSummary::from_completed(span, reference))
            .collect()
    }

    /// Get all spans that are descendants of the given root span.
    pub fn find_tree(&self, root_id: SpanId) -> Vec<&CompletedSpan> {
        let mut tree = Vec::new();
        let mut queue: VecDeque<SpanId> = VecDeque::new();
        queue.push_back(root_id);

        // Find root span
        if let Some(root) = self.data.iter().find(|s| s.id == root_id) {
            tree.push(root);
        }

        // BFS to find all descendants
        while let Some(parent_id) = queue.pop_front() {
            for span in &self.data {
                if span.parent_id == Some(parent_id) {
                    tree.push(span);
                    queue.push_back(span.id);
                }
            }
        }

        tree
    }

    /// Find a span by ID.
    #[allow(dead_code)]
    pub fn find(&self, id: SpanId) -> Option<&CompletedSpan> {
        self.data.iter().find(|s| s.id == id)
    }

    /// Number of spans currently stored.
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if buffer is empty.
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Buffer capacity.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Reference time for relative timestamps.
    pub fn reference_time(&self) -> Option<Instant> {
        self.reference_time
    }

    /// Clear all spans and reset reference time.
    pub fn clear(&mut self) {
        self.data.clear();
        self.reference_time = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_capacity() {
        let mut buffer = RingBuffer::new(3);
        let now = Instant::now();

        for i in 0..5 {
            buffer.push(CompletedSpan {
                id: i,
                parent_id: None,
                name: format!("span_{}", i),
                target: "test".to_string(),
                category: SpanCategory::Other,
                start_time: now,
                end_time: now,
                duration_ns: 1000,
                fields: vec![],
            });
        }

        // Should only contain last 3
        assert_eq!(buffer.len(), 3);

        let recent = buffer.recent(10);
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].name, "span_4");
        assert_eq!(recent[1].name, "span_3");
        assert_eq!(recent[2].name, "span_2");
    }

    #[test]
    fn test_category_inference() {
        assert_eq!(
            SpanCategory::from_span("git_status", "git_manager", &[]),
            SpanCategory::GitOperation
        );

        assert_eq!(
            SpanCategory::from_span("send_message", "lsp", &[]),
            SpanCategory::LspRequest
        );

        assert_eq!(
            SpanCategory::from_span(
                "anything",
                "test",
                &[("category".to_string(), "search".to_string())]
            ),
            SpanCategory::Search
        );
    }
}
