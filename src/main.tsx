import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";

// Expose invoke to window for debugging/profiling
if (import.meta.env.DEV) {
  (window as any).invoke = invoke;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
