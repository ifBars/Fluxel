//! Fluxel Performance Profiling Subsystem
//!
//! Feature-gated infrastructure for collecting and analyzing performance data.
//! Enable with `--features profiling` during development.
//!
//! # Architecture
//!
//! - `subscriber`: Custom tracing Layer that captures span lifecycle events
//! - `buffer`: Bounded ring buffer for span storage (no heap allocation on push)
//! - `attribution`: Latency analysis and "Why was this slow?" reports
//! - `sessions`: Session management for before/after comparisons and export
//! - `commands`: Tauri commands exposing profiler data to the frontend
//!
//! # Usage
//!
//! ```rust,ignore
//! // In lib.rs setup
//! #[cfg(feature = "profiling")]
//! {
//!     let profiler = profiling::init();
//!     app.manage(profiler);
//! }
//! ```

#[cfg(feature = "profiling")]
mod attribution;
#[cfg(feature = "profiling")]
mod buffer;
#[cfg(feature = "profiling")]
pub mod commands;
#[cfg(feature = "profiling")]
mod sessions;
#[cfg(feature = "profiling")]
mod subscriber;

#[cfg(feature = "profiling")]
pub use subscriber::FluxelProfiler;

#[cfg(feature = "profiling")]
use tracing_subscriber::prelude::*;

/// Initialize the profiling subscriber and install it as the global default.
/// Returns the profiler instance for Tauri state management.
#[cfg(feature = "profiling")]
pub fn init() -> FluxelProfiler {
    let profiler = FluxelProfiler::new(10_000); // 10k span capacity

    // Clone for the layer (profiler is Arc-wrapped internally)
    let layer = profiler.clone();

    // Build subscriber with our custom layer AND standard fmt layer for console output
    // This ensures logs still show up in the terminal
    let subscriber = tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .with(layer);

    // Set as global default
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set global tracing subscriber");

    println!("[Profiling] Initialized with 10,000 span capacity");

    profiler
}

/// No-op initialization when profiling is disabled.
#[cfg(not(feature = "profiling"))]
pub fn init() {}
