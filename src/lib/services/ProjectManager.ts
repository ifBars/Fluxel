import { useEditorStore, useFileSystemStore, usePreviewStore, useProjectStore, useCSharpStore } from '@/stores';
import { loadConfigMetadata } from '@/lib/config/loader';
import type { ProjectProfile } from '@/types/project';
import { FrontendProfiler } from './FrontendProfiler';

type ProjectInitStatus = ReturnType<typeof useProjectStore.getState>["projectInitStatus"];

interface ProjectLifecycleSnapshot {
  rootPath: string | null;
  profile: ProjectProfile | null;
  status: ProjectInitStatus;
}

let lifecycleSubscribed = false;
let lastCSharpConfigRoot: string | null = null;

/**
 * Determine if the detected profile should enable C# specific workflows.
 */
export function shouldLoadCSharpConfigurations(profile: ProjectProfile | null): profile is ProjectProfile {
  if (!profile) return false;
  return profile.kind === 'dotnet'
    || profile.kind === 'mixed'
    || Boolean(profile.dotnet.project_path || profile.dotnet.solution_path);
}

/**
 * Determine if the detected profile should hydrate Monaco's TypeScript services.
 */
export function shouldHydrateTypeScriptWorkspace(profile: ProjectProfile | null): profile is ProjectProfile {
  if (!profile) return false;
  
  // For pure C# projects, never hydrate TypeScript services regardless of package.json presence
  if (profile.kind === 'dotnet') {
    return false;
  }
  
  // For JavaScript projects, hydrate if they have Node.js artifacts
  if (profile.kind === 'javascript') {
    const hasNodeArtifacts = profile.node.has_package_json || profile.node.has_tsconfig || profile.node.has_jsconfig;
    return hasNodeArtifacts;
  }
  
  // For mixed projects, hydrate if they have TypeScript-specific artifacts
  if (profile.kind === 'mixed') {
    const hasTypeScriptArtifacts = profile.node.has_tsconfig || profile.node.has_jsconfig;
    return hasTypeScriptArtifacts;
  }
  
  // Unknown projects - hydrate if they have TypeScript artifacts
  const hasTypeScriptArtifacts = profile.node.has_tsconfig || profile.node.has_jsconfig;
  return hasTypeScriptArtifacts;
}

function resetCSharpConfigurations(): void {
  useCSharpStore.getState().reset();
  lastCSharpConfigRoot = null;
}

async function orchestrateProjectServices(profile: ProjectProfile): Promise<void> {
  await FrontendProfiler.profileAsync('orchestrateProjectServices', 'workspace', async () => {
    if (shouldLoadCSharpConfigurations(profile)) {
      if (lastCSharpConfigRoot !== profile.root_path) {
        lastCSharpConfigRoot = profile.root_path;
        try {
          await useCSharpStore.getState().loadProjectConfigurations(profile.root_path);
        } catch (error) {
          lastCSharpConfigRoot = null;
          console.error('[ProjectManager] Failed to load C# configurations:', error);
        }
      }
    } else if (lastCSharpConfigRoot) {
      resetCSharpConfigurations();
    }
  }, { profileKind: profile.kind, rootPath: profile.root_path });
}

async function handleProjectLifecycle(snapshot: ProjectLifecycleSnapshot, previous?: ProjectLifecycleSnapshot): Promise<void> {
  const projectChanged = snapshot.rootPath !== previous?.rootPath;
  const parentId = FrontendProfiler.getCurrentParentId();

  await FrontendProfiler.profileAsync('handleProjectLifecycle', 'workspace', async () => {
    if (!snapshot.rootPath) {
      resetCSharpConfigurations();
      return;
    }

    if (projectChanged) {
      resetCSharpConfigurations();
    }

    if (snapshot.status !== 'ready' || !snapshot.profile) {
      return;
    }

    await orchestrateProjectServices(snapshot.profile);
  }, { 
    rootPath: snapshot.rootPath || 'none',
    status: snapshot.status,
    projectChanged: String(projectChanged),
    hasProfile: String(snapshot.profile !== null),
    parentId 
  });
}

/**
 * Initialize project lifecycle orchestration (runs once).
 */
export function initializeProjectOrchestrator(): void {
  if (lifecycleSubscribed) return;
  lifecycleSubscribed = true;

  let prevSnapshot: ProjectLifecycleSnapshot | undefined;
  
  useProjectStore.subscribe((state) => {
    const snapshot: ProjectLifecycleSnapshot = {
      rootPath: state.currentProject?.rootPath ?? null,
      profile: state.projectProfile,
      status: state.projectInitStatus,
    };
    void handleProjectLifecycle(snapshot, prevSnapshot);
    prevSnapshot = snapshot;
  });
}

/**
 * Central project/workspace lifecycle orchestration.
 *
 * Keeps all "open/close workspace" side-effects in one place so other features can
 * reliably react to `useProjectStore` state (including detected `projectProfile`).
 * 
 * @param rootPath - The workspace root path to open
 * @param options.waitForDirectory - If true, waits for loadDirectory to complete before resolving (default: false)
 */
export async function openWorkspace(
  rootPath: string, 
  options?: { waitForDirectory?: boolean }
): Promise<void> {
  initializeProjectOrchestrator();
  await FrontendProfiler.profileAsync('openWorkspace', 'workspace', async () => {
    const normalizedRoot = rootPath.replace(/\\/g, '/');
    const parentId = FrontendProfiler.getCurrentParentId();

    // Fire-and-forget cleanup operations - don't block workspace opening
    // These run in parallel with the new workspace loading
    usePreviewStore.getState().stopPreview().catch(() => { });
    useEditorStore.getState().closeAllTabs();
    useFileSystemStore.getState().clearTree();

    // Update project state immediately for UI responsiveness (kicks off detection + language service init).
    // This allows the UI to show loading state immediately while directory loads.
    // Profile store subscription handlers that run after openProject
    const storeUpdateSpan = FrontendProfiler.startSpan('store:openProject', 'workspace');
    useProjectStore.getState().openProject(normalizedRoot);
    
    // Store subscriptions run synchronously, but we need to track them
    // Use a microtask to capture subscription handler execution
    Promise.resolve().then(() => {
      storeUpdateSpan.end({ rootPath: normalizedRoot });
    });

    // Load file tree for the new workspace.
    // This happens after project state update so UI can show immediately.
    // By default, we do NOT await this so the UI transition can happen instantly.
    // Pass waitForDirectory=true to wait for the directory to fully load before returning.
    // Note: loadDirectory already profiles itself internally, so no outer wrapper needed.
    // We pass explicit parent ID since we may be firing and forgetting (leaving the span context)
    const loadDirPromise = useFileSystemStore.getState().loadDirectory(normalizedRoot, parentId);
    
    if (options?.waitForDirectory) {
      // Wait for directory to load before proceeding to view switch
      // This eliminates the gap between loadDirectory and workbench_init
      await loadDirPromise.catch((error) => {
        console.error('[ProjectManager] Failed to load directory:', error);
      });
    } else {
      // Fire-and-forget (original behavior)
      loadDirPromise.catch((error) => {
        console.error('[ProjectManager] Failed to load directory:', error);
      });
    }

    // Load config metadata in the background (already non-blocking, but ensure it doesn't interfere).
    FrontendProfiler.profileAsync('loadConfigMetadata', 'workspace', async () => {
      await loadConfigMetadata(normalizedRoot);
    }, { parentId }).catch((error) => {
      console.error('[ProjectManager] Failed to load config metadata:', error);
    });
  }, { rootPath });
}

export async function closeWorkspace(): Promise<void> {
  await FrontendProfiler.profileAsync('closeWorkspace', 'workspace', async () => {
    await FrontendProfiler.profileAsync('stopPreview', 'tauri_command', async () => {
      await usePreviewStore.getState().stopPreview();
    });
    FrontendProfiler.profileSync('closeAllTabs', 'frontend_render', () => {
      useEditorStore.getState().closeAllTabs();
    });
    FrontendProfiler.profileSync('clearTree', 'workspace', () => {
      useFileSystemStore.getState().clearTree();
    });
    FrontendProfiler.profileSync('closeProject', 'workspace', () => {
      useProjectStore.getState().closeProject();
    });
    resetCSharpConfigurations();
  });
}
