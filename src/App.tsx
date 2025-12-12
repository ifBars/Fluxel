import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AuthPage from "./components/auth/AuthPage";
import LandingPage from "./components/landing/LandingPage";
import EditorPage from "./components/editor/EditorPage";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore, usePreviewStore } from "@/stores";
import { openWorkspace, closeWorkspace } from "@/lib/services/ProjectManager";
import "./styles/index.css";

type AppView = "auth" | "landing" | "editor";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const initAppearance = useSettingsStore((state) => state.initAppearance);

  // Initialize appearance settings on mount
  useEffect(() => {
    initAppearance();
  }, [initAppearance]);

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
        return <AuthPage onLogin={handleLogin} />;
      case "landing":
        return <LandingPage onProjectOpen={handleProjectOpen} />;
      case "editor":
        return <EditorPage />;
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

