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

/// Hierarchical span node for tree analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanTreeNode {
    /// The span data.
    pub span: SpanSummary,
    /// Self time (excluding children).
    pub self_time_ms: f64,
    /// Direct children of this span.
    pub children: Vec<SpanTreeNode>,
    /// Depth in the tree (0 = root).
    pub depth: usize,
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
    /// Hierarchical tree structure for flame graph visualization.
    pub tree: Option<SpanTreeNode>,
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

        // Find hotspots (top 10 by self-time, excluding trivial spans)
        let mut hotspots: Vec<_> = spans
            .iter()
            .filter(|s| {
                let self_time = *self_times.get(&s.id).unwrap_or(&0.0);
                self_time > 0.1 // Only include spans with >0.1ms self-time
            })
            .map(|s| (s.clone(), *self_times.get(&s.id).unwrap_or(&0.0)))
            .collect();
        hotspots.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let hotspots: Vec<_> = hotspots.into_iter().take(10).map(|(s, _)| s).collect();

        // Build hierarchical tree for flame graph
        let tree = Self::build_tree_node(&root, &children_map, &self_times, 0);

        AttributionReport {
            root_span: root,
            total_time_ms,
            breakdowns,
            critical_path,
            hotspots,
            tree: Some(tree),
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

    /// Build a hierarchical tree node recursively.
    fn build_tree_node(
        span: &SpanSummary,
        children_map: &HashMap<String, Vec<SpanSummary>>,
        self_times: &HashMap<String, f64>,
        depth: usize,
    ) -> SpanTreeNode {
        let children = children_map.get(&span.id).cloned().unwrap_or_default();
        
        // Sort children by start time for proper flame graph ordering
        let mut sorted_children = children;
        sorted_children.sort_by(|a, b| {
            a.start_time_ms
                .partial_cmp(&b.start_time_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let child_nodes: Vec<SpanTreeNode> = sorted_children
            .iter()
            .map(|child| Self::build_tree_node(child, children_map, self_times, depth + 1))
            .collect();

        SpanTreeNode {
            span: span.clone(),
            self_time_ms: *self_times.get(&span.id).unwrap_or(&0.0),
            children: child_nodes,
            depth,
        }
    }
}

#[cfg(test)]
mod comprehensive_tests {
    use super::*;

    fn make_span(
        id: &str,
        parent: Option<&str>,
        category: SpanCategory,
        start_time_ms: f64,
        duration_ms: f64,
        name: &str,
    ) -> SpanSummary {
        SpanSummary {
            id: id.to_string(),
            parent_id: parent.map(|p| p.to_string()),
            name: name.to_string(),
            target: "test".to_string(),
            category,
            start_time_ms,
            duration_ms,
            fields: vec![],
        }
    }

    #[test]
    fn test_self_time_calculation() {
        // Create a tree: root(100ms) -> child1(60ms), child2(30ms)
        // Expected self-time for root: 100 - 60 - 30 = 10ms
        let root = make_span("1", None, SpanCategory::TauriCommand, 0.0, 100.0, "root");
        let child1 = make_span("2", Some("1"), SpanCategory::FileIo, 10.0, 60.0, "child1");
        let child2 = make_span("3", Some("1"), SpanCategory::GitOperation, 70.0, 30.0, "child2");

        let spans = vec![root.clone(), child1, child2];
        let report = AttributionEngine::analyze(root, &spans);

        // Verify the tree structure is built
        assert!(report.tree.is_some());
        let tree = report.tree.unwrap();
        assert_eq!(tree.children.len(), 2);
        
        // Root should have 10ms self-time (100 - 60 - 30)
        assert!((tree.self_time_ms - 10.0).abs() < 0.01, "Root self-time should be ~10ms, got {}", tree.self_time_ms);
    }

    #[test]
    fn test_nested_hierarchy() {
        // Create a deep tree: root -> a -> b -> c
        let root = make_span("1", None, SpanCategory::TauriCommand, 0.0, 100.0, "root");
        let a = make_span("2", Some("1"), SpanCategory::FileIo, 5.0, 80.0, "level_a");
        let b = make_span("3", Some("2"), SpanCategory::BackendOperation, 10.0, 60.0, "level_b");
        let c = make_span("4", Some("3"), SpanCategory::LspRequest, 15.0, 40.0, "level_c");

        let spans = vec![root.clone(), a.clone(), b.clone(), c.clone()];
        let report = AttributionEngine::analyze(root, &spans);

        // Verify tree depth
        let tree = report.tree.unwrap();
        assert_eq!(tree.depth, 0);
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].depth, 1);
        assert_eq!(tree.children[0].children[0].depth, 2);
        assert_eq!(tree.children[0].children[0].children[0].depth, 3);

        // Verify self-times: each level has 20ms self-time
        assert!((tree.self_time_ms - 20.0).abs() < 0.01);
        assert!((tree.children[0].self_time_ms - 20.0).abs() < 0.01);
        assert!((tree.children[0].children[0].self_time_ms - 20.0).abs() < 0.01);
        assert!((tree.children[0].children[0].children[0].self_time_ms - 40.0).abs() < 0.01);
    }

    #[test]
    fn test_critical_path_identification() {
        // Critical path should be: root -> slow_child -> deep
        let root = make_span("1", None, SpanCategory::TauriCommand, 0.0, 100.0, "root");
        let fast = make_span("2", Some("1"), SpanCategory::FileIo, 5.0, 10.0, "fast_child");
        let slow = make_span("3", Some("1"), SpanCategory::BackendOperation, 20.0, 80.0, "slow_child");
        let deep = make_span("4", Some("3"), SpanCategory::LspRequest, 25.0, 60.0, "deep");

        let spans = vec![root.clone(), fast, slow.clone(), deep.clone()];
        let report = AttributionEngine::analyze(root, &spans);

        assert_eq!(report.critical_path.len(), 3);
        assert_eq!(report.critical_path[0].name, "root");
        assert_eq!(report.critical_path[1].name, "slow_child");
        assert_eq!(report.critical_path[2].name, "deep");
    }

    #[test]
    fn test_hotspot_detection() {
        let root = make_span("1", None, SpanCategory::TauriCommand, 0.0, 100.0, "root");
        let fast = make_span("2", Some("1"), SpanCategory::FileIo, 5.0, 5.0, "fast");
        let medium = make_span("3", Some("1"), SpanCategory::BackendOperation, 15.0, 30.0, "medium");
        let slow = make_span("4", Some("1"), SpanCategory::LspRequest, 50.0, 50.0, "slow_hotspot");

        let spans = vec![root.clone(), fast, medium, slow.clone()];
        let report = AttributionEngine::analyze(root, &spans);

        // Top hotspot should be the span with highest self-time
        assert!(!report.hotspots.is_empty());
        assert_eq!(report.hotspots[0].name, "slow_hotspot");
    }

    #[test]
    fn test_category_breakdown() {
        let root = make_span("1", None, SpanCategory::TauriCommand, 0.0, 100.0, "root");
        let file1 = make_span("2", Some("1"), SpanCategory::FileIo, 5.0, 30.0, "file_op1");
        let file2 = make_span("3", Some("1"), SpanCategory::FileIo, 40.0, 20.0, "file_op2");
        let git = make_span("4", Some("1"), SpanCategory::GitOperation, 65.0, 25.0, "git_op");

        let spans = vec![root.clone(), file1, file2, git];
        let report = AttributionEngine::analyze(root, &spans);

        assert_eq!(report.breakdowns.len(), 3);

        let file_io_breakdown = report.breakdowns.iter()
            .find(|b| matches!(b.category, SpanCategory::FileIo))
            .expect("FileIo category should exist");
        
        assert_eq!(file_io_breakdown.span_count, 2);
        assert!((file_io_breakdown.self_time_ms - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_performance_with_large_tree() {
        use std::time::Instant;

        let mut spans = Vec::new();
        let root = make_span("root", None, SpanCategory::TauriCommand, 0.0, 1000.0, "root");
        spans.push(root.clone());

        for i in 0..10 {
            let child_id = format!("child_{}", i);
            let child = make_span(
                &child_id,
                Some("root"),
                SpanCategory::BackendOperation,
                (i * 10) as f64,
                90.0,
                &format!("child_{}", i)
            );
            spans.push(child);

            for j in 0..10 {
                let grandchild_id = format!("grandchild_{}_{}", i, j);
                let grandchild = make_span(
                    &grandchild_id,
                    Some(&child_id),
                    SpanCategory::FileIo,
                    (i * 10 + j) as f64,
                    8.0,
                    &format!("grandchild_{}_{}", i, j)
                );
                spans.push(grandchild);
            }
        }

        let start = Instant::now();
        let report = AttributionEngine::analyze(root, &spans);
        let elapsed = start.elapsed();

        // Analysis should complete quickly
        assert!(elapsed.as_millis() < 50, "Analysis took too long: {:?}", elapsed);
        
        assert_eq!(spans.len(), 111);
        let tree = report.tree.unwrap();
        assert_eq!(tree.children.len(), 10);
    }
}

#[cfg(test)]
mod basic_tests {
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
        assert!(report.hotspots.len() > 0);
        assert!(report.tree.is_some());
    }
}
