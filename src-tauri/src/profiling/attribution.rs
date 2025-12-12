//! Attribution engine for analyzing span trees and answering "Why was this slow?"
//!
//! Provides latency attribution by category, critical path analysis, and hotspot detection.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::profiling::buffer::{SpanCategory, SpanSummary};

/// Breakdown of time spent in a specific category.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryBreakdown {
    pub category: SpanCategory,
    /// Total wall-clock time in this category (including nested spans).
    pub total_time_ms: f64,
    /// Self time (excluding time in child spans).
    pub self_time_ms: f64,
    /// Percentage of total operation time.
    pub percentage: f64,
    /// Number of spans in this category.
    pub span_count: usize,
}

/// Complete attribution report for an operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributionReport {
    /// The root span of the operation.
    pub root_span: SpanSummary,
    /// Total wall-clock time for the operation.
    pub total_time_ms: f64,
    /// Breakdown by category.
    pub breakdowns: Vec<CategoryBreakdown>,
    /// Critical path - spans that determined total time.
    pub critical_path: Vec<SpanSummary>,
    /// Top spans by self-time (hotspots).
    pub hotspots: Vec<SpanSummary>,
}

/// Engine for computing attribution reports.
pub struct AttributionEngine;

impl AttributionEngine {
    /// Analyze a span tree and produce an attribution report.
    ///
    /// # Arguments
    /// * `root` - The root span of the operation
    /// * `spans` - All spans in the tree (including root)
    pub fn analyze(root: SpanSummary, spans: &[SpanSummary]) -> AttributionReport {
        let total_time_ms = root.duration_ms;

        // Build parent-child map
        let children_map = Self::build_children_map(spans);

        // Calculate self-time for each span
        let mut self_times: HashMap<String, f64> = HashMap::new();
        for span in spans {
            let children_time: f64 = children_map
                .get(&span.id)
                .map(|children| children.iter().map(|c| c.duration_ms).sum())
                .unwrap_or(0.0);

            let self_time = (span.duration_ms - children_time).max(0.0);
            self_times.insert(span.id.clone(), self_time);
        }

        // Group by category
        let breakdowns = Self::compute_category_breakdowns(spans, &self_times, total_time_ms);

        // Find critical path
        let critical_path = Self::find_critical_path(&root, &children_map, spans);

        // Find hotspots (top 5 by self-time)
        let mut hotspots: Vec<_> = spans
            .iter()
            .map(|s| (s.clone(), *self_times.get(&s.id).unwrap_or(&0.0)))
            .collect();
        hotspots.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let hotspots: Vec<_> = hotspots.into_iter().take(5).map(|(s, _)| s).collect();

        AttributionReport {
            root_span: root,
            total_time_ms,
            breakdowns,
            critical_path,
            hotspots,
        }
    }

    /// Build a map from parent ID to children.
    fn build_children_map(spans: &[SpanSummary]) -> HashMap<String, Vec<SpanSummary>> {
        let mut map: HashMap<String, Vec<SpanSummary>> = HashMap::new();

        for span in spans {
            if let Some(ref parent_id) = span.parent_id {
                map.entry(parent_id.clone()).or_default().push(span.clone());
            }
        }

        map
    }

    /// Compute category breakdowns.
    fn compute_category_breakdowns(
        spans: &[SpanSummary],
        self_times: &HashMap<String, f64>,
        total_time_ms: f64,
    ) -> Vec<CategoryBreakdown> {
        let mut by_category: HashMap<SpanCategory, (f64, f64, usize)> = HashMap::new();

        for span in spans {
            let self_time = *self_times.get(&span.id).unwrap_or(&0.0);
            let entry = by_category.entry(span.category).or_insert((0.0, 0.0, 0));
            entry.0 += span.duration_ms; // total time
            entry.1 += self_time; // self time
            entry.2 += 1; // count
        }

        let mut breakdowns: Vec<_> = by_category
            .into_iter()
            .map(|(category, (total, self_time, count))| CategoryBreakdown {
                category,
                total_time_ms: total,
                self_time_ms: self_time,
                percentage: if total_time_ms > 0.0 {
                    (self_time / total_time_ms) * 100.0
                } else {
                    0.0
                },
                span_count: count,
            })
            .collect();

        // Sort by self-time descending
        breakdowns.sort_by(|a, b| {
            b.self_time_ms
                .partial_cmp(&a.self_time_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        breakdowns
    }

    /// Find the critical path (longest sequential chain).
    fn find_critical_path(
        root: &SpanSummary,
        children_map: &HashMap<String, Vec<SpanSummary>>,
        _spans: &[SpanSummary],
    ) -> Vec<SpanSummary> {
        let mut path = vec![root.clone()];
        let mut current = root;

        // Follow the longest child at each level
        loop {
            let children = match children_map.get(&current.id) {
                Some(c) if !c.is_empty() => c,
                _ => break,
            };

            // Find child with longest duration
            let longest = children.iter().max_by(|a, b| {
                a.duration_ms
                    .partial_cmp(&b.duration_ms)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            match longest {
                Some(child) => {
                    path.push(child.clone());
                    current = child;
                }
                None => break,
            }
        }

        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_span(
        id: &str,
        parent: Option<&str>,
        category: SpanCategory,
        duration_ms: f64,
    ) -> SpanSummary {
        SpanSummary {
            id: id.to_string(),
            parent_id: parent.map(|p| p.to_string()),
            name: format!("span_{}", id),
            target: "test".to_string(),
            category,
            start_time_ms: 0.0,
            duration_ms,
            fields: vec![],
        }
    }

    #[test]
    fn test_attribution_basic() {
        let root = make_span("1", None, SpanCategory::TauriCommand, 100.0);
        let child1 = make_span("2", Some("1"), SpanCategory::FileIo, 60.0);
        let child2 = make_span("3", Some("1"), SpanCategory::GitOperation, 30.0);

        let spans = vec![root.clone(), child1, child2];
        let report = AttributionEngine::analyze(root, &spans);

        assert_eq!(report.total_time_ms, 100.0);
        assert_eq!(report.breakdowns.len(), 3);
        assert_eq!(report.critical_path.len(), 2); // root -> longest child
        assert_eq!(report.hotspots.len(), 3);
    }
}
