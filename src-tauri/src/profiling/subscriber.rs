//! FluxelProfiler - Custom tracing subscriber layer.
//!
//! Captures span lifecycle events and stores completed spans in a ring buffer.
//! Designed for minimal overhead and non-blocking operation.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Instant;

use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::{Context, Layer};
use tracing_subscriber::registry::LookupSpan;

use crate::profiling::buffer::{CompletedSpan, RingBuffer, SpanCategory, SpanId, SpanSummary};

/// In-flight span data stored in the registry.
struct SpanData {
    name: String,
    target: String,
    start_time: Instant,
    fields: Vec<(String, String)>,
}

/// FluxelProfiler captures tracing spans and stores them in a bounded buffer.
///
/// This is a `tracing_subscriber::Layer` that can be composed with other layers.
/// It's designed to have minimal overhead when disabled.
#[derive(Clone)]
pub struct FluxelProfiler {
    inner: Arc<ProfilerInner>,
}

struct ProfilerInner {
    /// Ring buffer for completed spans.
    buffer: RwLock<RingBuffer>,
    /// Whether profiling is enabled.
    enabled: AtomicBool,
    /// Counter for generating sequential span IDs.
    next_id: AtomicU64,
    /// Map from tracing span ID to our sequential ID.
    id_map: RwLock<HashMap<u64, SpanId>>,
    /// In-flight span data.
    span_data: RwLock<HashMap<SpanId, SpanData>>,
}

impl FluxelProfiler {
    /// Create a new profiler with the given span buffer capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Arc::new(ProfilerInner {
                buffer: RwLock::new(RingBuffer::new(capacity)),
                enabled: AtomicBool::new(true), // Enabled by default when feature is on
                next_id: AtomicU64::new(1),
                id_map: RwLock::new(HashMap::new()),
                span_data: RwLock::new(HashMap::new()),
            }),
        }
    }

    /// Enable or disable span collection.
    pub fn set_enabled(&self, enabled: bool) {
        self.inner.enabled.store(enabled, Ordering::Relaxed);
    }

    /// Check if profiling is enabled.
    pub fn is_enabled(&self) -> bool {
        self.inner.enabled.load(Ordering::Relaxed)
    }

    /// Get the number of spans currently stored.
    pub fn span_count(&self) -> usize {
        self.inner.buffer.read().unwrap().len()
    }

    /// Get the buffer capacity.
    pub fn capacity(&self) -> usize {
        self.inner.buffer.read().unwrap().capacity()
    }

    /// Get recent spans.
    pub fn recent_spans(&self, limit: usize) -> Vec<SpanSummary> {
        self.inner.buffer.read().unwrap().recent(limit)
    }

    /// Get a span tree for attribution.
    pub fn get_span_tree(&self, root_id: SpanId) -> Vec<SpanSummary> {
        let buffer = self.inner.buffer.read().unwrap();
        let reference = buffer.reference_time().unwrap_or_else(Instant::now);

        buffer
            .find_tree(root_id)
            .into_iter()
            .map(|span| SpanSummary::from_completed(span, reference))
            .collect()
    }

    /// Clear all stored spans.
    pub fn clear(&self) {
        self.inner.buffer.write().unwrap().clear();
        self.inner.id_map.write().unwrap().clear();
        self.inner.span_data.write().unwrap().clear();
    }

    /// Generate a new sequential span ID.
    fn next_span_id(&self) -> SpanId {
        self.inner.next_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Map a tracing span ID to our sequential ID.
    fn map_id(&self, tracing_id: &Id) -> SpanId {
        let tracing_id_val = tracing_id.into_u64();

        // Check if already mapped
        if let Some(&id) = self.inner.id_map.read().unwrap().get(&tracing_id_val) {
            return id;
        }

        // Create new mapping
        let new_id = self.next_span_id();
        self.inner
            .id_map
            .write()
            .unwrap()
            .insert(tracing_id_val, new_id);
        new_id
    }

    /// Get our ID for a tracing span ID.
    fn get_id(&self, tracing_id: &Id) -> Option<SpanId> {
        self.inner
            .id_map
            .read()
            .unwrap()
            .get(&tracing_id.into_u64())
            .copied()
    }
}

/// Visitor for extracting span fields.
struct FieldVisitor {
    fields: Vec<(String, String)>,
}

impl FieldVisitor {
    fn new() -> Self {
        Self { fields: Vec::new() }
    }
}

impl tracing::field::Visit for FieldVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.fields
            .push((field.name().to_string(), format!("{:?}", value)));
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }

    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.fields
            .push((field.name().to_string(), value.to_string()));
    }
}

impl<S> Layer<S> for FluxelProfiler
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_new_span(&self, attrs: &Attributes<'_>, id: &Id, _ctx: Context<'_, S>) {
        if !self.is_enabled() {
            return;
        }

        let our_id = self.map_id(id);

        // Extract fields
        let mut visitor = FieldVisitor::new();
        attrs.record(&mut visitor);

        // Store span data
        let data = SpanData {
            name: attrs.metadata().name().to_string(),
            target: attrs.metadata().target().to_string(),
            start_time: Instant::now(),
            fields: visitor.fields,
        };

        self.inner.span_data.write().unwrap().insert(our_id, data);
    }

    fn on_record(&self, id: &Id, values: &Record<'_>, _ctx: Context<'_, S>) {
        if !self.is_enabled() {
            return;
        }

        if let Some(our_id) = self.get_id(id) {
            let mut visitor = FieldVisitor::new();
            values.record(&mut visitor);

            if let Some(data) = self.inner.span_data.write().unwrap().get_mut(&our_id) {
                data.fields.extend(visitor.fields);
            }
        }
    }

    fn on_event(&self, _event: &Event<'_>, _ctx: Context<'_, S>) {
        // Events are not captured in this implementation.
        // Could be extended to capture events within spans.
    }

    fn on_enter(&self, _id: &Id, _ctx: Context<'_, S>) {
        // Enter timing is captured on new_span
    }

    fn on_exit(&self, _id: &Id, _ctx: Context<'_, S>) {
        // Exit is handled on close
    }

    fn on_close(&self, id: Id, ctx: Context<'_, S>) {
        if !self.is_enabled() {
            return;
        }

        let our_id = match self.get_id(&id) {
            Some(id) => id,
            None => return,
        };

        // Remove span data
        let data = match self.inner.span_data.write().unwrap().remove(&our_id) {
            Some(data) => data,
            None => return,
        };

        // Get parent ID
        let parent_id = ctx
            .span(&id)
            .and_then(|span| span.parent())
            .and_then(|parent| self.get_id(&parent.id()));

        let end_time = Instant::now();
        let duration_ns = end_time.duration_since(data.start_time).as_nanos() as u64;

        // Infer category
        let category = SpanCategory::from_span(&data.name, &data.target, &data.fields);

        // Create completed span
        let completed = CompletedSpan {
            id: our_id,
            parent_id,
            name: data.name,
            target: data.target,
            category,
            start_time: data.start_time,
            end_time,
            duration_ns,
            fields: data.fields,
        };

        // Push to buffer
        self.inner.buffer.write().unwrap().push(completed);

        // Clean up ID mapping
        self.inner.id_map.write().unwrap().remove(&id.into_u64());
    }
}
