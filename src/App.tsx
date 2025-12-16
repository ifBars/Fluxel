import { useState, useEffect, useLayoutEffect, useCallback, Suspense, lazy, memo, useMemo, useTransition, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "./components/ui/titlebar";
import { useSettingsStore, usePreviewStore } from "@/stores";
import { openWorkspace, closeWorkspace } from "@/lib/services/ProjectManager";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";
import { useProfiler } from "@/hooks/useProfiler";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { preloadIconPack } from "@/lib/icons";
import { ProfilerPanel } from "./components/ProfilerPanel";
import "./styles/index.css";

// Lazy-load all views to minimize initial bundle size
const AuthPage = lazy(() => import("./components/auth/AuthPage"));
const LandingPage = lazy(() => import("./components/landing/LandingPage"));
const EditorPage = lazy(() => import("./components/editor/EditorPage"));

type AppView = "auth" | "landing" | "editor";

/**
 * Suspense fallback component that tracks module loading time.
 * When React Suspense is waiting for a lazy component to load,
 * this component renders and starts a profiler span.
 */
function TrackedSuspenseFallback({ view }: { view: string }) {
  const spanRef = useRef<ReturnType<typeof FrontendProfiler.startSpan> | null>(null);

  // Start span on mount (when Suspense begins loading)
  if (!spanRef.current) {
    spanRef.current = FrontendProfiler.startSpan(`suspense_load:${view}`, 'frontend_render');
  }

  // Profile the actual module import
  useEffect(() => {
    const importSpan = FrontendProfiler.startSpan(`module_import:${view}`, 'frontend_render');
    
    // Use a small delay to capture when the module actually loads
    // This is approximate since we can't hook into the actual import
    const checkInterval = setInterval(() => {
      // Check if component has mounted (module loaded)
      if (document.querySelector(`[data-component="${view}"]`)) {
        importSpan.end({ view });
        clearInterval(checkInterval);
      }
    }, 1);
    
    return () => {
      clearInterval(checkInterval);
      importSpan.cancel();
    };
  }, [view]);

  // End span on unmount (when lazy component finishes loading)
  useEffect(() => {
    return () => {
      if (spanRef.current) {
        spanRef.current.end({ view });
        spanRef.current = null;
      }
    };
  }, [view]);
  
  // Track when module actually loads by checking if component rendered
  useEffect(() => {
    const checkSpan = FrontendProfiler.startSpan(`module_import:${view}`, 'frontend_render');
    // Module is loaded when this component unmounts (Suspense resolved)
    return () => {
      checkSpan.end({ view });
    };
  }, [view]);

  return null; // Invisible fallback
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>("auth");
  const [, startTransition] = useTransition();
  const initAppearance = useSettingsStore((state) => state.initAppearance);
  const { ProfilerWrapper } = useProfiler('App');
  useGlobalShortcuts();

  // Initialize appearance settings on mount
  useEffect(() => {
    initAppearance();
  }, [initAppearance]);

  // Preload icon pack in parallel with launch path check (optimized startup)
  useEffect(() => {
    const iconPack = useSettingsStore.getState().iconPack;
    const packKey = iconPack in { 'material-design': true, 'feather': true, 'heroicons': true, 'bootstrap': true, 'phosphor': true, 'lucide': true, 'exuanbo': true, 'material': true }
      ? iconPack as 'material-design' | 'feather' | 'heroicons' | 'bootstrap' | 'phosphor' | 'lucide' | 'exuanbo' | 'material'
      : 'material-design';

    // Run icon preloading concurrently with launch path check for faster startup
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
    
    // Profile React transition scheduling and rendering
    const transitionSpan = FrontendProfiler.startSpan('react:startTransition', 'frontend_render');
    startTransition(() => {
      // Profile the actual state update
      const stateUpdateSpan = FrontendProfiler.startSpan('react:setState', 'frontend_render');
      setCurrentView("editor");
      
      // End spans after React schedules the update
      // The actual render will be tracked by component ProfilerWrapper
      Promise.resolve().then(() => {
        stateUpdateSpan.end({ view: 'editor' });
        transitionSpan.end({ view: 'editor' });
      });
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

    // Start launch path check immediately (icon preload runs in parallel via separate useEffect)
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
          <Suspense fallback={<TrackedSuspenseFallback view="editor" />}>
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
        <ProfilerPanel />
      </main>
    </ProfilerWrapper>
  );
}

export default memo(App);

