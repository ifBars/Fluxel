import { useEditorStore, useFileSystemStore, usePreviewStore, useProjectStore } from '@/stores';
import { loadConfigMetadata } from '@/lib/config/loader';

/**
 * Central project/workspace lifecycle orchestration.
 *
 * Keeps all "open/close workspace" side-effects in one place so other features can
 * reliably react to `useProjectStore` state (including detected `projectProfile`).
 */
export async function openWorkspace(rootPath: string): Promise<void> {
  const normalizedRoot = rootPath.replace(/\\/g, '/');

  // Close/cleanup anything tied to the previous workspace.
  await usePreviewStore.getState().stopPreview();
  useEditorStore.getState().closeAllTabs();
  useFileSystemStore.getState().clearTree();

  // Update project state (kicks off detection + language service init).
  useProjectStore.getState().openProject(normalizedRoot);

  // Load file tree for the new workspace.
  await useFileSystemStore.getState().loadDirectory(normalizedRoot);

  // Load config metadata in the background.
  loadConfigMetadata(normalizedRoot).catch((error) => {
    console.error('[ProjectManager] Failed to load config metadata:', error);
  });
}

export async function closeWorkspace(): Promise<void> {
  await usePreviewStore.getState().stopPreview();
  useEditorStore.getState().closeAllTabs();
  useFileSystemStore.getState().clearTree();
  useProjectStore.getState().closeProject();
}

