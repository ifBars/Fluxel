# Fluxel Profiling System

This module implements a scalable, low-intrusion performance profiling and tracing system for the Fluxel IDE. It answers "Why was this slow?" by attributing latency to concrete causes (Git, LSP, I/O, etc.).

## 1. Enabling Profiling

The profiling system is **feature-gated** to ensure zero overhead when not in use.

To enable it during development:

```bash
# Using bun (recommended)
bun tauri dev -- --features profiling

# Or using cargo directly
cargo tauri dev -- --features profiling
```

When the `profiling` feature is disabled (default), all instrumentation macros compile to no-ops, and the subsystem is not initialized.

## 2. Architecture

The system is built on the [tracing](https://github.com/tokio-rs/tracing) ecosystem:

1.  **Instrumentation**: `#[instrument]` macros on high-level entry points (Tauri commands, LSP methods).
2.  **Collection**: `FluxelProfiler` subscriber captures spans and stores them in a **Ring Buffer** (capacity: 10,000 recursive spans).
3.  **Attribution**: An engine analyzes span trees to calculate self-time, find critical paths, and identify hotspots.
4.  **No Disk I/O**: All data is kept in memory. The frontend polls for data only when needed.

## 3. Adding Instrumentation

To track a new function or command, add the `tracing::instrument` attribute. Always use `cfg_attr` to conditionalize it.

**Basic Usage:**

```rust
#[cfg_attr(feature = "profiling", tracing::instrument(skip(self)))]
pub fn complex_operation(&self) {
    // ...
}
```

**With Categories (Recommended):**

Add a `category` field to help the attribution engine group related costs.

```rust
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(
        skip(root_path),
        fields(category = "git", repo = %root_path)
    )
)]
pub fn git_status(root_path: &str) { ... }
```

**Supported Categories:**
- `tauri_command` (inferred)
- `file_io`
- `git_operation`
- `lsp_request`
- `search`
- `workspace`

## 4. Frontend API

Four Tauri commands are exposed to the frontend. TypeScript types are available in `src/types/profiling.ts`.

### Commands

| Command | Description |
|---------|-------------|
| `profiler_set_enabled(enabled: bool)` | Toggles data collection on/off. |
| `profiler_get_status()` | Returns enabled state, span count, and buffer capacity. |
| `profiler_get_recent_spans(limit: number)` | Returns the most recent N finished spans (summaries). |
| `profiler_get_attribution(root_span_id: string)` | Returns a detailed report for a specific operation tree. |

### Example Usage (Frontend)

```typescript
import { invoke } from "@tauri-apps/api/core";

// 1. Check status
const status = await invoke("profiler_get_status");
console.log(`Stored Spans: ${status.spanCount}`);

// 2. Get recent activity
const spans = await invoke("profiler_get_recent_spans", { limit: 10 });
console.log("Recent", spans);

// 3. Analyze specific slow operation
const report = await invoke("profiler_get_attribution", {
  rootSpanId: spans[0].id
});

console.log("Breakdown:", report.breakdowns);
console.log("Critical Path:", report.criticalPath);
```

## 5. Latency Attribution

The `profiler_get_attribution` command performs heavy analysis on the Rust side to return:

- **Breakdowns**: Time spent per category (e.g., "Git: 80%", "Computation: 20%").
- **Self-Time**: Time spent in a function excluding its children.
- **Critical Path**: The chain of spans that actually determined the total duration (crucial for async code).
- **Hotspots**: The individual spans contributing most to execution time.
