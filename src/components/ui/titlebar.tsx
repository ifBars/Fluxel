import { Suspense, lazy } from "react";
import { TitleBarShell } from "./TitleBarShell";

// Lazy-load editor-specific titlebar components to avoid loading project/build/C# stores on cold start
const EditorTitleBar = lazy(() => import("./EditorTitleBar").then(m => ({ default: m.EditorTitleBar })));
const EditorTitleBarCenter = lazy(() => import("./EditorTitleBar").then(m => ({ default: m.EditorTitleBarCenter })));

interface TitleBarProps {
  showMenu?: boolean;
  onCloseProject?: () => void;
}

/**
 * Main titlebar component that conditionally loads editor-specific features.
 * On cold start (Auth/Landing), only the lightweight shell is rendered.
 */
export function TitleBar({ showMenu = true, onCloseProject }: TitleBarProps) {
  return (
    <TitleBarShell
      leftContent={
        showMenu ? (
          <Suspense fallback={null}>
            <EditorTitleBar onCloseProject={onCloseProject} />
          </Suspense>
        ) : undefined
      }
      centerContent={
        showMenu ? (
          <Suspense fallback={null}>
            <div
              data-tauri-drag-region
              className="flex-1 flex items-center justify-center h-full gap-3"
            >
              <EditorTitleBarCenter />
            </div>
          </Suspense>
        ) : undefined
      }
    />
  );
}
