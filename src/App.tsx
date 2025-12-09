import { useState, useEffect } from "react";
import AuthPage from "./components/auth/AuthPage";
import LandingPage from "./components/landing/LandingPage";
import EditorPage from "./components/editor/EditorPage";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useEditorStore } from "./stores/useEditorStore";
import { useFileSystemStore } from "./stores/useFileSystemStore";
import { useProjectStore } from "./stores/useProjectStore";
import "./styles/index.css";

type AppView = "auth" | "landing" | "editor";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const initAppearance = useSettingsStore((state) => state.initAppearance);
  const { closeAllTabs } = useEditorStore();
  const { clearTree } = useFileSystemStore();
  const { closeProject } = useProjectStore();

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

