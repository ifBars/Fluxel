//! Profiling session management.
//!
//! Sessions allow grouping spans into named time periods for before/after comparisons.
//! Sessions capture all spans recorded between start and end, and can be exported
//! as JSON or Chrome Trace format for external analysis.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use super::buffer::{SpanCategory, SpanSummary};

/// Counter for generating session IDs.
static NEXT_SESSION_ID: AtomicU64 = AtomicU64::new(1);

/// A profiling session that groups spans for analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilingSession {
    /// Unique session identifier.
    pub id: String,
    /// Human-readable session name.
    pub name: String,
    /// Session start time in milliseconds (from profiler reference time).
    pub start_time_ms: f64,
    /// Session end time in milliseconds (None if still active).
    pub end_time_ms: Option<f64>,
    /// Number of spans captured in this session.
    pub span_count: usize,
}

/// Summary report when a session ends.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionReport {
    /// The session details.
    pub session: ProfilingSession,
    /// Time breakdown by category.
    pub breakdowns: Vec<CategorySessionBreakdown>,
    /// Top spans by duration.
    pub top_spans: Vec<SpanSummary>,
    /// Total duration of all spans (may exceed session duration due to overlap).
    pub total_span_time_ms: f64,
}

/// Category breakdown within a session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySessionBreakdown {
    pub category: SpanCategory,
    pub total_time_ms: f64,
    pub span_count: usize,
    pub percentage: f64,
}

/// Chrome Trace format event (for export).
#[derive(Debug, Clone, Serialize)]
pub struct ChromeTraceEvent {
    pub name: String,
    pub cat: String,
    pub ph: String, // "B" for begin, "E" for end, or "X" for complete
    pub ts: f64,    // Microseconds
    pub dur: f64,   // Duration in microseconds (for "X" events)
    pub pid: u32,
    pub tid: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<HashMap<String, String>>,
}

/// Session manager for tracking active and completed sessions.
#[derive(Debug, Default)]
pub struct SessionManager {
    /// Currently active sessions.
    active_sessions: HashMap<String, ActiveSession>,
}

/// An active session being recorded.
#[derive(Debug)]
struct ActiveSession {
    id: String,
    name: String,
    start_instant: Instant,
}

impl SessionManager {
    /// Create a new session manager.
    pub fn new() -> Self {
        Self {
            active_sessions: HashMap::new(),
        }
    }

    /// Start a new profiling session.
    ///
    /// Returns the session ID.
    pub fn start_session(&mut self, name: String, _current_span_count: usize) -> String {
        let id = format!(
            "session_{}",
            NEXT_SESSION_ID.fetch_add(1, Ordering::Relaxed)
        );

        let session = ActiveSession {
            id: id.clone(),
            name,
            start_instant: Instant::now(),
        };

        self.active_sessions.insert(id.clone(), session);
        id
    }

    /// End a session and generate a report.
    ///
    /// Returns None if the session doesn't exist.
    pub fn end_session(
        &mut self,
        session_id: &str,
        spans: &[SpanSummary],
        reference_time: Instant,
    ) -> Option<SessionReport> {
        let session = self.active_sessions.remove(session_id)?;
        let end_instant = Instant::now();

        // Calculate relative times
        let start_time_ms = session
            .start_instant
            .duration_since(reference_time)
            .as_secs_f64()
            * 1000.0;
        let end_time_ms = end_instant.duration_since(reference_time).as_secs_f64() * 1000.0;

        // Filter spans that fall within this session's time window
        let session_spans: Vec<_> = spans
            .iter()
            .filter(|s| s.start_time_ms >= start_time_ms && s.start_time_ms <= end_time_ms)
            .collect();

        let span_count = session_spans.len();

        // Calculate category breakdowns
        let mut by_category: HashMap<SpanCategory, (f64, usize)> = HashMap::new();
        let mut total_span_time = 0.0;

        for span in &session_spans {
            let entry = by_category.entry(span.category).or_insert((0.0, 0));
            entry.0 += span.duration_ms;
            entry.1 += 1;
            total_span_time += span.duration_ms;
        }

        let breakdowns: Vec<_> = by_category
            .into_iter()
            .map(|(category, (time, count))| CategorySessionBreakdown {
                category,
                total_time_ms: time,
                span_count: count,
                percentage: if total_span_time > 0.0 {
                    (time / total_span_time) * 100.0
                } else {
                    0.0
                },
            })
            .collect();

        // Get top spans by duration
        let mut top_spans: Vec<_> = session_spans.into_iter().cloned().collect();
        top_spans.sort_by(|a, b| {
            b.duration_ms
                .partial_cmp(&a.duration_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        top_spans.truncate(10);

        Some(SessionReport {
            session: ProfilingSession {
                id: session.id,
                name: session.name,
                start_time_ms,
                end_time_ms: Some(end_time_ms),
                span_count,
            },
            breakdowns,
            top_spans,
            total_span_time_ms: total_span_time,
        })
    }

    /// Check if a session is active.
    #[allow(dead_code)] // Used in tests
    pub fn is_active(&self, session_id: &str) -> bool {
        self.active_sessions.contains_key(session_id)
    }

    /// Get the currently active session ID, if any.
    pub fn active_session_id(&self) -> Option<&str> {
        self.active_sessions.keys().next().map(|s| s.as_str())
    }
}

/// Export spans to Chrome Trace format JSON.
pub fn export_chrome_trace(spans: &[SpanSummary], session_name: &str) -> String {
    let events: Vec<ChromeTraceEvent> = spans
        .iter()
        .map(|span| {
            let mut args = HashMap::new();
            for (key, value) in &span.fields {
                args.insert(key.clone(), value.clone());
            }
            args.insert("target".to_string(), span.target.clone());

            ChromeTraceEvent {
                name: span.name.clone(),
                cat: format!("{:?}", span.category).to_lowercase(),
                ph: "X".to_string(),             // Complete event
                ts: span.start_time_ms * 1000.0, // Convert to microseconds
                dur: span.duration_ms * 1000.0,
                pid: 1,
                tid: 1,
                args: if args.is_empty() { None } else { Some(args) },
            }
        })
        .collect();

    // Chrome Trace format wraps events in an object
    serde_json::json!({
        "traceEvents": events,
        "displayTimeUnit": "ms",
        "metadata": {
            "session": session_name
        }
    })
    .to_string()
}

/// Export spans as simple JSON.
pub fn export_json(spans: &[SpanSummary]) -> String {
    serde_json::to_string_pretty(spans).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_lifecycle() {
        let mut manager = SessionManager::new();
        let reference = Instant::now();

        // Start a session
        let id = manager.start_session("test_session".to_string(), 0);
        assert!(manager.is_active(&id));

        // End session with empty spans
        let report = manager.end_session(&id, &[], reference);
        assert!(report.is_some());
        assert!(!manager.is_active(&id));

        let report = report.unwrap();
        assert_eq!(report.session.name, "test_session");
        assert_eq!(report.session.span_count, 0);
    }
}
