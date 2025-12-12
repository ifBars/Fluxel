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

**TypeScript/React:**

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

**Browser Console (Paste-Ready):**

Use these commands directly in your browser's developer console (dev mode only):

```javascript
// Quick enable/disable
await window.invoke("profiler_set_enabled", { enabled: true });
await window.invoke("profiler_set_enabled", { enabled: false });

// Check profiler status
const status = await window.invoke("profiler_get_status");
console.table(status);

// View recent spans (adjust limit as needed)
const spans = await window.invoke("profiler_get_recent_spans", { limit: 20 });
console.table(spans.map(s => ({
  name: s.name,
  duration_ms: s.durationMs.toFixed(2),
  category: s.fields?.find(f => f[0] === 'category')?.[1] || s.category
})));

// Analyze a specific operation (replace with actual span ID)
if (spans.length > 0) {
  const report = await window.invoke("profiler_get_attribution", {
    rootSpanId: spans[0].id
  });
  console.log("📊 Time Breakdown:", report.breakdowns);
  console.log("🔥 Critical Path:", report.criticalPath);
  console.log("⚡ Hotspots:", report.hotspots);
} else {
  console.warn("⚠️ No spans captured yet. Try navigating around the app first.");
}

// Full profiling workflow example
(async () => {
  // 1. Enable profiling
  await window.invoke("profiler_set_enabled", { enabled: true });
  console.log("✅ Profiling enabled");
  
  // 2. Perform some operations in the IDE (open files, run commands, etc.)
  console.log("⏳ Perform IDE operations now...");
  
  // 3. Wait a moment for operations to complete
  await new Promise(r => setTimeout(r, 2000));
  
  // 4. Fetch and analyze results
  const spans = await window.invoke("profiler_get_recent_spans", { limit: 10 });
  console.log(`📈 Captured ${spans.length} operations`);
  
  // 5. Analyze the slowest operation
  if (spans.length > 0) {
    const slowest = spans.reduce((a, b) => a.durationMs > b.durationMs ? a : b);
    const report = await window.invoke("profiler_get_attribution", {
      rootSpanId: slowest.id
    });
    
    console.log(`\n🐌 Slowest: ${slowest.name} (${slowest.durationMs.toFixed(2)}ms)`);
    console.table(report.breakdowns.map(b => ({
      category: b.category,
      time_ms: b.totalTimeMs.toFixed(2),
      percentage: `${b.percentage.toFixed(1)}%`,
      count: b.spanCount
    })));
  }
})();
```

## 5. Latency Attribution

The `profiler_get_attribution` command performs heavy analysis on the Rust side to return:

- **Breakdowns**: Time spent per category (e.g., "Git: 80%", "Computation: 20%").
- **Self-Time**: Time spent in a function excluding its children.
- **Critical Path**: The chain of spans that actually determined the total duration (crucial for async code).
- **Hotspots**: The individual spans contributing most to execution time.
