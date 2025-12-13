import { useState, useEffect, useLayoutEffect, useCallback, Suspense, lazy } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore, usePreviewStore } from "@/stores";
import { openWorkspace, closeWorkspace } from "@/lib/services/ProjectManager";
import "./styles/index.css";

// Lazy-load all views to minimize initial bundle size
const AuthPage = lazy(() => import("./components/auth/AuthPage"));
const LandingPage = lazy(() => import("./components/landing/LandingPage"));
const EditorPage = lazy(() => import("./components/editor/EditorPage"));

type AppView = "auth" | "landing" | "editor";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const initAppearance = useSettingsStore((state) => state.initAppearance);

  // Initialize appearance settings on mount
  useEffect(() => {
    initAppearance();
  }, [initAppearance]);

  // Signal to HTML loading screen that app content is ready
  // Uses requestAnimationFrame for immediate signal after first paint
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('data-app-ready', 'true');
      }
    });
  }, []);

  const handleLogin = () => {
    setCurrentView("landing");
  };

  const handleProjectOpen = () => {
    setCurrentView("editor");
  };

  const handleCloseProject = async () => {
    await closeWorkspace();
    setCurrentView("landing");
  };

  const openExternalProject = useCallback(
    async (rootPath: string) => {
      await openWorkspace(rootPath);

      setCurrentView("editor");
    },
    [],
  );



  // Check for launch arguments on mount (context menu launch)
  useEffect(() => {
    const checkLaunchPath = async () => {
      try {
        const path = await invoke<string | null>("get_launch_path");
        if (path) {
          await openExternalProject(path);
        }
      } catch (error) {
        console.error("Failed to check launch path:", error);
      }
    };

    checkLaunchPath();
  }, [openExternalProject]);

  // Setup window close handler to cleanup processes before exit
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupCloseHandler = async () => {
      const currentWindow = getCurrentWindow();
      unlisten = await currentWindow.onCloseRequested(async (_event) => {
        console.log("[App] Window close requested, cleaning up processes...");

        // Stop preview/dev server before allowing close
        try {
          await usePreviewStore.getState().stopPreview();
        } catch (error) {
          console.error("[App] Error stopping preview during close:", error);
        }

        // Allow the window to close
        // Note: The Rust backend will also kill any remaining tracked processes
      });
    };

    setupCloseHandler();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "auth":
        return (
          <Suspense fallback={null}>
            <AuthPage onLogin={handleLogin} />
          </Suspense>
        );
      case "landing":
        return (
          <Suspense fallback={null}>
            <LandingPage onProjectOpen={handleProjectOpen} />
          </Suspense>
        );
      case "editor":
        return (
          <Suspense fallback={null}>
            <EditorPage />
          </Suspense>
        );
    }
  };

  return (
    <main className="font-sans antialiased text-foreground bg-background h-screen flex flex-col overflow-hidden">
      <TitleBar
        showMenu={currentView === "editor"}
        onCloseProject={handleCloseProject}
      />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
    </main>
  );
}

export default App;

