import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";

// Suppress "ResizeObserver loop completed with undelivered notifications" error
// This error is benign and occurs when a resize observer callback modifies the layout (e.g., CodeEditor layout())
// which triggers another observation in the same frame.
const originalError = console.error;
const originalResizeObserverLoopError = "ResizeObserver loop completed with undelivered notifications";

window.addEventListener('error', (e) => {
  if (e.message.includes(originalResizeObserverLoopError)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
});

console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes(originalResizeObserverLoopError)) {
    return;
  }
  originalError(...args);
};

// Performance marks for startup timeline
performance.mark('app_start');

// Expose invoke to window for debugging/profiling
if (import.meta.env.DEV) {
  (window as any).invoke = invoke;

  // Register performance benchmarks for dev mode
  import('./lib/services/profiling/PerformanceBenchmark').then(({ registerGlobalBenchmarks }) => {
    registerGlobalBenchmarks();
  });
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (e) {
  console.error("React Render Failed:", e);
  document.body.innerHTML += `<div style="color:red; padding:20px;"><h1>React Render Failed</h1><pre>${e}</pre></div>`;
}

// Mark when React render is committed (first paint)
requestAnimationFrame(() => {
  performance.mark('react_render_committed');

  // Measure time to first render
  try {
    performance.measure('app_startup', 'app_start', 'react_render_committed');
    const measure = performance.getEntriesByName('app_startup')[0];
    if (import.meta.env.DEV && measure) {
      console.log(`[Performance] App startup: ${measure.duration.toFixed(2)}ms`);
    }
  } catch (e) {
    // Performance API might not be available in all contexts
  }
});
