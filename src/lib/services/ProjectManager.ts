import { useEditorStore, useFileSystemStore, usePreviewStore, useProjectStore } from '@/stores';
import { loadConfigMetadata } from '@/lib/config/loader';
import { FrontendProfiler } from './FrontendProfiler';

/**
 * Central project/workspace lifecycle orchestration.
 *
 * Keeps all "open/close workspace" side-effects in one place so other features can
 * reliably react to `useProjectStore` state (including detected `projectProfile`).
 */
export async function openWorkspace(rootPath: string): Promise<void> {
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
  });
}

