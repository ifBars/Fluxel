import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import AuthPage from "./components/auth/AuthPage";
import LandingPage from "./components/landing/LandingPage";
import EditorPage from "./components/editor/EditorPage";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore, useEditorStore, useFileSystemStore, useProjectStore } from "@/stores";
import { loadConfigMetadata } from "./lib/config/loader";
import "./styles/index.css";

type AppView = "auth" | "landing" | "editor";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const initAppearance = useSettingsStore((state) => state.initAppearance);
  const { closeAllTabs } = useEditorStore();
  const { clearTree, loadDirectory } = useFileSystemStore();
  const { closeProject, openProject } = useProjectStore();

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

  const handleCloseProject = () => {
    closeAllTabs();
    clearTree();
    closeProject();
    setCurrentView("landing");
  };

  const openExternalProject = useCallback(
    async (rootPath: string) => {
      clearTree();
      openProject(rootPath);
      await loadDirectory(rootPath);

      // Load config metadata in the background
      loadConfigMetadata(rootPath).catch((error) => {
        console.error("Failed to load config metadata:", error);
      });

      setCurrentView("editor");
    },
    [clearTree, loadDirectory, openProject],
  );

  // Listen for paths emitted from the backend (context menu launch)
  useEffect(() => {
    const unlistenPromise = listen<string>("external-open", async (event) => {
      const rootPath = event.payload;
      if (!rootPath) return;

      try {
        await openExternalProject(rootPath);
      } catch (error) {
        console.error("Failed to open project from external event:", error);
      }
    });

    return () => {
      unlistenPromise
        .then((unlisten) => unlisten())
        .catch(() => {});
    };
  }, [openExternalProject]);

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

