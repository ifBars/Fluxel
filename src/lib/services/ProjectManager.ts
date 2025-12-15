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
  const hasNodeArtifacts = profile.node.has_package_json || profile.node.has_tsconfig || profile.node.has_jsconfig;
  const isNodeKind = profile.kind === 'javascript' || profile.kind === 'mixed';
  return isNodeKind || hasNodeArtifacts;
}

function resetCSharpConfigurations(): void {
  useCSharpStore.getState().reset();
  lastCSharpConfigRoot = null;
}

async function orchestrateProjectServices(profile: ProjectProfile): Promise<void> {
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
}

async function handleProjectLifecycle(snapshot: ProjectLifecycleSnapshot, previous?: ProjectLifecycleSnapshot): Promise<void> {
  const projectChanged = snapshot.rootPath !== previous?.rootPath;

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
}

/**
 * Initialize project lifecycle orchestration (runs once).
 */
export function initializeProjectOrchestrator(): void {
  if (lifecycleSubscribed) return;
  lifecycleSubscribed = true;

  useProjectStore.subscribe<ProjectLifecycleSnapshot>(
    (state) => ({
      rootPath: state.currentProject?.rootPath ?? null,
      profile: state.projectProfile,
      status: state.projectInitStatus,
    }),
    (snapshot, prevSnapshot) => {
      void handleProjectLifecycle(snapshot, prevSnapshot);
    }
  );
}

/**
 * Central project/workspace lifecycle orchestration.
 *
 * Keeps all "open/close workspace" side-effects in one place so other features can
 * reliably react to `useProjectStore` state (including detected `projectProfile`).
 */
export async function openWorkspace(rootPath: string): Promise<void> {
  initializeProjectOrchestrator();
  await FrontendProfiler.profileAsync('openWorkspace', 'workspace', async () => {
    const normalizedRoot = rootPath.replace(/\\/g, '/');

    // Fire-and-forget cleanup operations - don't block workspace opening
    // These run in parallel with the new workspace loading
    usePreviewStore.getState().stopPreview().catch(() => { });
    useEditorStore.getState().closeAllTabs();
    useFileSystemStore.getState().clearTree();

    // Update project state immediately for UI responsiveness (kicks off detection + language service init).
    // This allows the UI to show loading state immediately while directory loads.
    useProjectStore.getState().openProject(normalizedRoot);

    // Load file tree for the new workspace.
    // This happens after project state update so UI can show immediately.
    // We do NOT await this so the UI transition can happen instantly.
    // Note: loadDirectory already profiles itself internally, so no outer wrapper needed.
    useFileSystemStore.getState().loadDirectory(normalizedRoot).catch((error) => {
      console.error('[ProjectManager] Failed to load directory:', error);
    });

    // Load config metadata in the background (already non-blocking, but ensure it doesn't interfere).
    FrontendProfiler.profileAsync('loadConfigMetadata', 'workspace', async () => {
      await loadConfigMetadata(normalizedRoot);
    }).catch((error) => {
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
