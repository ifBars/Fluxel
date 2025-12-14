import { useState, useEffect, useLayoutEffect, useCallback, Suspense, lazy, memo, useMemo, useTransition, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore, usePreviewStore } from "@/stores";
import { openWorkspace, closeWorkspace } from "@/lib/services/ProjectManager";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";
import { useProfiler } from "@/hooks/useProfiler";
import { preloadIconPack } from "@/lib/icons";
import "./styles/index.css";

// Lazy-load all views to minimize initial bundle size
const AuthPage = lazy(() => import("./components/auth/AuthPage"));
const LandingPage = lazy(() => import("./components/landing/LandingPage"));
const EditorPage = lazy(() => import("./components/editor/EditorPage"));

type AppView = "auth" | "landing" | "editor";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const [, startTransition] = useTransition();
  const initAppearance = useSettingsStore((state) => state.initAppearance);
  const { ProfilerWrapper } = useProfiler('App');

  // Initialize appearance settings on mount
  useEffect(() => {
    initAppearance();
  }, [initAppearance]);

  // Preload icon pack to avoid lazy loading overhead during file tree rendering
  useEffect(() => {
    const iconPack = useSettingsStore.getState().iconPack;
    const packKey = iconPack in { 'material-design': true, 'feather': true, 'heroicons': true, 'bootstrap': true, 'phosphor': true, 'lucide': true, 'exuanbo': true, 'material': true } 
      ? iconPack as 'material-design' | 'feather' | 'heroicons' | 'bootstrap' | 'phosphor' | 'lucide' | 'exuanbo' | 'material'
      : 'material-design';
    void preloadIconPack(packKey);
  }, []);

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

  const handleLogin = useCallback(() => {
    FrontendProfiler.trackInteraction('view_switch', { from: 'auth', to: 'landing' });
    startTransition(() => {
      setCurrentView("landing");
    });
  }, [startTransition]);

  const handleProjectOpen = useCallback(() => {
    FrontendProfiler.trackInteraction('view_switch', { from: 'landing', to: 'editor' });
    startTransition(() => {
      setCurrentView("editor");
    });
  }, [startTransition]);

  const handleCloseProject = useCallback(async () => {
    await FrontendProfiler.profileAsync('closeProject', 'workspace', async () => {
      await closeWorkspace();
      FrontendProfiler.trackInteraction('view_switch', { from: 'editor', to: 'landing' });
      startTransition(() => {
        setCurrentView("landing");
      });
    });
  }, [startTransition]);

  const openExternalProject = useCallback(
    async (rootPath: string) => {
      await openWorkspace(rootPath);
      FrontendProfiler.trackInteraction('view_switch', { from: 'landing', to: 'editor' });
      startTransition(() => {
        setCurrentView("editor");
      });
    },
    [startTransition],
  );



  // Check for launch arguments on mount (context menu launch)
  // Use refs to prevent duplicate calls and avoid stale closures
  const hasCheckedLaunchPath = useRef(false);
  const openExternalProjectRef = useRef(openExternalProject);
  openExternalProjectRef.current = openExternalProject;

  useEffect(() => {
    const checkLaunchPath = async () => {
      // Guard against duplicate calls (React Strict Mode, dep changes)
      if (hasCheckedLaunchPath.current) return;
      hasCheckedLaunchPath.current = true;

      await FrontendProfiler.profileAsync('checkLaunchPath', 'workspace', async () => {
        try {
          const path = await invoke<string | null>("get_launch_path");
          if (path) {
            await openExternalProjectRef.current(path);
          }
        } catch (error) {
          console.error("Failed to check launch path:", error);
        }
      });
    };

    checkLaunchPath();
  }, []); // Run only on mount

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

  const renderView = useMemo(() => {
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
  }, [currentView, handleLogin, handleProjectOpen]);

  return (
    <ProfilerWrapper>
      <main className="font-sans antialiased text-foreground bg-background h-screen flex flex-col overflow-hidden">
        <TitleBar
          showMenu={currentView === "editor"}
          onCloseProject={handleCloseProject}
        />
        <div className="flex-1 overflow-hidden">
          {renderView}
        </div>
      </main>
    </ProfilerWrapper>
  );
}

export default memo(App);

