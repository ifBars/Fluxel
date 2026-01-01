import { useState, useCallback, memo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  useProjectStore,
  useEditorStore,
  useSettingsStore,
  type UIDensity,
  useWorkbenchStore,
  useBuildPanelStore,
  useCSharpStore,
} from "@/stores";
import { executeBuild, executeTypeCheck } from '@/lib/services/BuildManager';
import { openWorkspace, closeWorkspace } from "@/lib/services/ProjectManager";
import { TitlebarDropdown } from "./TitlebarDropdown";
import {
  TitlebarMenuButton,
  TitlebarMenuDropdown,
  TitlebarMenuItem,
  TitlebarMenuDivider,
  useTitlebarMenu,
} from "./TitlebarMenu";

interface EditorTitleBarProps {
  onCloseProject?: () => void;
}

/**
 * Editor-specific titlebar menus and project info.
 * This component is lazy-loaded and only rendered when showMenu is true.
 */
function EditorTitleBar({ onCloseProject }: EditorTitleBarProps) {
  const [isBuilding, setIsBuilding] = useState(false);

  // Menu state management
  const { activeMenu, menuRef, toggleMenu, openMenuOnHover, closeMenu } = useTitlebarMenu();

  const currentProject = useProjectStore((state) => state.currentProject);
  const saveAllFiles = useEditorStore((state) => state.saveAllFiles);
  const triggerAction = useEditorStore((state) => state.triggerAction);

  // Settings and Workbench stores for View menu
  const setSidebarOpen = useWorkbenchStore((state) => state.setSidebarOpen);
  const isSidebarOpen = useWorkbenchStore((state) => state.isSidebarOpen);

  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const wordWrap = useSettingsStore((state) => state.wordWrap);
  const setWordWrap = useSettingsStore((state) => state.setWordWrap);
  const showMinimap = useSettingsStore((state) => state.showMinimap);
  const setShowMinimap = useSettingsStore((state) => state.setShowMinimap);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);
  const setShowLineNumbers = useSettingsStore((state) => state.setShowLineNumbers);
  const uiDensity = useSettingsStore((state) => state.uiDensity);
  const setUIDensity = useSettingsStore((state) => state.setUIDensity);
  const buildSystem = useSettingsStore((state) => state.buildSystem);
  const customBuildCommand = useSettingsStore((state) => state.customBuildCommand);

  // File Menu Actions
  const handleOpenFolder = useCallback(async () => {
    closeMenu();
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });

      if (selected && typeof selected === 'string') {
        await openWorkspace(selected);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }, [closeMenu]);

  const handleSaveAll = useCallback(async () => {
    closeMenu();
    await saveAllFiles();
  }, [closeMenu, saveAllFiles]);

  // Build Panel Store
  const startBuild = useBuildPanelStore((state) => state.startBuild);
  const finishBuild = useBuildPanelStore((state) => state.finishBuild);
  const setOutput = useBuildPanelStore((state) => state.setOutput);
  const appendOutput = useBuildPanelStore((state) => state.appendOutput);

  const handleBuildProject = useCallback(async () => {
    if (!currentProject) return;
    closeMenu();
    setIsBuilding(true);
    startBuild();
    try {
      const result = await executeBuild({
        projectRoot: currentProject.rootPath,
        buildSystem,
        customBuildCommand,
      });
      // Send output to panel
      const outputLines = result.output ? result.output.split('\n') : [];
      if (result.error) {
        outputLines.push(`Error: ${result.error}`);
      }
      setOutput(outputLines);
      // Pass BuildResult diagnostics and duration to store
      finishBuild(
        result.success ? 'success' : 'error',
        result.diagnostics,
        result.durationMs
      );
    } catch (error) {
      appendOutput(`Build error: ${error}`);
      finishBuild('error');
    } finally {
      setIsBuilding(false);
    }
  }, [currentProject, buildSystem, customBuildCommand, closeMenu, startBuild, setOutput, appendOutput, finishBuild]);

  const handleTypeCheck = useCallback(async () => {
    if (!currentProject) return;
    closeMenu();
    setIsBuilding(true);
    startBuild();
    try {
      const result = await executeTypeCheck(currentProject.rootPath);
      const outputLines = result.output ? result.output.split('\n') : [];
      if (result.error) {
        outputLines.push(`Error: ${result.error}`);
      }
      setOutput(outputLines);
      finishBuild(
        result.success ? 'success' : 'error',
        result.diagnostics,
        result.durationMs
      );
    } catch (error) {
      appendOutput(`Type check error: ${error}`);
      finishBuild('error');
    } finally {
      setIsBuilding(false);
    }
  }, [currentProject, closeMenu, startBuild, setOutput, appendOutput, finishBuild]);

  const handleCloseProject = useCallback(async () => {
    closeMenu();
    await closeWorkspace();
    onCloseProject?.();
  }, [closeMenu, onCloseProject]);

  // View Menu Actions
  const handleZoomIn = useCallback(() => setFontSize(Math.min(fontSize + 1, 32)), [fontSize, setFontSize]);
  const handleZoomOut = useCallback(() => setFontSize(Math.max(fontSize - 1, 8)), [fontSize, setFontSize]);
  const handleResetZoom = useCallback(() => setFontSize(14), [setFontSize]);
  const cycleDensity = useCallback(() => {
    const densities: UIDensity[] = ['compact', 'comfortable', 'spacious'];
    const nextIndex = (densities.indexOf(uiDensity) + 1) % densities.length;
    setUIDensity(densities[nextIndex]);
  }, [uiDensity, setUIDensity]);

  // Helper for triggering editor actions
  const action = useCallback((act: import("@/stores").EditorAction) => {
    triggerAction(act);
    closeMenu();
  }, [triggerAction, closeMenu]);

  return (
    <div className="flex items-center h-full" ref={menuRef}>
      {/* File Menu */}
      <div className="relative h-full">
        <TitlebarMenuButton
          label="File"
          isOpen={activeMenu === 'file'}
          onClick={() => toggleMenu('file')}
          onMouseEnter={() => openMenuOnHover('file')}
        />
        {activeMenu === 'file' && (
          <TitlebarMenuDropdown>
            <TitlebarMenuItem label="Open Folder..." shortcut="Ctrl+O" onClick={handleOpenFolder} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Save All" shortcut="Ctrl+Shift+S" onClick={handleSaveAll} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Close Folder" onClick={handleCloseProject} disabled={!currentProject} />
          </TitlebarMenuDropdown>
        )}
      </div>

      {/* Edit Menu */}
      <div className="relative h-full">
        <TitlebarMenuButton
          label="Edit"
          isOpen={activeMenu === 'edit'}
          onClick={() => toggleMenu('edit')}
          onMouseEnter={() => openMenuOnHover('edit')}
        />
        {activeMenu === 'edit' && (
          <TitlebarMenuDropdown>
            <TitlebarMenuItem label="Undo" shortcut="Ctrl+Z" onClick={() => action('undo')} />
            <TitlebarMenuItem label="Redo" shortcut="Ctrl+Y" onClick={() => action('redo')} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Cut" shortcut="Ctrl+X" onClick={() => action('cut')} />
            <TitlebarMenuItem label="Copy" shortcut="Ctrl+C" onClick={() => action('copy')} />
            <TitlebarMenuItem label="Paste" shortcut="Ctrl+V" onClick={() => action('paste')} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Find" shortcut="Ctrl+F" onClick={() => action('find')} />
            <TitlebarMenuItem label="Replace" shortcut="Ctrl+H" onClick={() => action('replace')} />
          </TitlebarMenuDropdown>
        )}
      </div>

      {/* Selection Menu */}
      <div className="relative h-full">
        <TitlebarMenuButton
          label="Selection"
          isOpen={activeMenu === 'selection'}
          onClick={() => toggleMenu('selection')}
          onMouseEnter={() => openMenuOnHover('selection')}
        />
        {activeMenu === 'selection' && (
          <TitlebarMenuDropdown>
            <TitlebarMenuItem label="Select All" shortcut="Ctrl+A" onClick={() => action('selectAll')} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Expand Selection" shortcut="Shift+Alt+Right" onClick={() => { }} disabled />
            <TitlebarMenuItem label="Shrink Selection" shortcut="Shift+Alt+Left" onClick={() => { }} disabled />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Add Cursor Above" shortcut="Ctrl+Alt+Up" onClick={() => { }} disabled />
            <TitlebarMenuItem label="Add Cursor Below" shortcut="Ctrl+Alt+Down" onClick={() => { }} disabled />
          </TitlebarMenuDropdown>
        )}
      </div>

      {/* View Menu */}
      <div className="relative h-full">
        <TitlebarMenuButton
          label="View"
          isOpen={activeMenu === 'view'}
          onClick={() => toggleMenu('view')}
          onMouseEnter={() => openMenuOnHover('view')}
        />
        {activeMenu === 'view' && (
          <TitlebarMenuDropdown>
            <TitlebarMenuItem
              label="Command Palette..."
              shortcut="F1"
              onClick={() => { closeMenu(); /* TODO: Implement Command Palette */ }}
              disabled
            />
            <TitlebarMenuDivider />
            <TitlebarMenuItem
              label={isSidebarOpen ? "Hide Side Bar" : "Show Side Bar"}
              shortcut="Ctrl+B"
              onClick={() => { setSidebarOpen(!isSidebarOpen); closeMenu(); }}
            />
            <TitlebarMenuItem
              label="Toggle Build Panel"
              shortcut="Ctrl+`"
              onClick={() => { useBuildPanelStore.getState().togglePanel(); closeMenu(); }}
              checked={useBuildPanelStore.getState().isOpen}
            />
            <TitlebarMenuItem
              label="Toggle Minimap"
              onClick={() => { setShowMinimap(!showMinimap); closeMenu(); }}
              checked={showMinimap}
            />
            <TitlebarMenuItem
              label="Toggle Line Numbers"
              onClick={() => { setShowLineNumbers(!showLineNumbers); closeMenu(); }}
              checked={showLineNumbers}
            />
            <TitlebarMenuItem
              label="Toggle Word Wrap"
              shortcut="Alt+Z"
              onClick={() => { setWordWrap(wordWrap === 'off' ? 'on' : 'off'); closeMenu(); }}
              checked={wordWrap !== 'off'}
            />
            <TitlebarMenuDivider />
            <TitlebarMenuItem label="Zoom In" shortcut="Ctrl+=" onClick={handleZoomIn} />
            <TitlebarMenuItem label="Zoom Out" shortcut="Ctrl+-" onClick={handleZoomOut} />
            <TitlebarMenuItem label="Reset Zoom" shortcut="Ctrl+0" onClick={handleResetZoom} />
            <TitlebarMenuDivider />
            <TitlebarMenuItem
              label={`UI Density: ${uiDensity.charAt(0).toUpperCase() + uiDensity.slice(1)}`}
              onClick={() => { cycleDensity(); closeMenu(); }}
            />
          </TitlebarMenuDropdown>
        )}
      </div>

      {/* Build Menu */}
      <div className="relative h-full">
        <TitlebarMenuButton
          label="Build"
          isOpen={activeMenu === 'build'}
          onClick={() => toggleMenu('build')}
          onMouseEnter={() => openMenuOnHover('build')}
        />
        {activeMenu === 'build' && (
          <TitlebarMenuDropdown>
            <TitlebarMenuItem
              label="Build Project"
              shortcut="Ctrl+Shift+B"
              onClick={handleBuildProject}
              disabled={!currentProject || isBuilding}
            />
            <TitlebarMenuItem
              label="Type Check"
              shortcut="Ctrl+Shift+T"
              onClick={handleTypeCheck}
              disabled={!currentProject || isBuilding}
            />
          </TitlebarMenuDropdown>
        )}
      </div>
    </div>
  );
}

const EditorTitleBarMemo = memo(EditorTitleBar);

/**
 * Center content component for editor titlebar (project name + C# config).
 * Separated to allow lazy loading of the center content independently.
 */
function EditorTitleBarCenter() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectProfile = useProjectStore((state) => state.projectProfile);
  const projectInitStatus = useProjectStore((state) => state.projectInitStatus);
  const projectInitError = useProjectStore((state) => state.projectInitError);
  const configurations = useCSharpStore((state) => state.configurations);
  const selectedConfiguration = useCSharpStore((state) => state.selectedConfiguration);
  const setSelectedConfiguration = useCSharpStore((state) => state.setSelectedConfiguration);
  const isLoadingConfigs = useCSharpStore((state) => state.isLoadingConfigs);

  // Debug logging for C# configuration selector
  if (import.meta.env.DEV) {
    const cSharpStoreState = useCSharpStore.getState() as any;
    console.log('[EditorTitleBarCenter] Render state', {
      hasCurrentProject: !!currentProject,
      projectInitStatus,
      projectInitError,
      projectProfileKind: projectProfile?.kind,
      projectRoot: projectProfile?.root_path,
      configurationsCount: configurations.length,
      configurations: configurations,
      isLoadingConfigs,
      selectedConfiguration,
      lastLoadedWorkspace: cSharpStoreState.lastLoadedWorkspace,
    });
  }

  if (!currentProject) {
    if (import.meta.env.DEV) {
      console.log('[EditorTitleBarCenter] No current project, returning null');
    }
    return null;
  }

  // Show C# selector if we have configurations, regardless of projectProfile state
  // This handles the case where detection fails but configs were already loaded
  const hasCSharpConfigs = configurations.length > 0;
  const isCSharpProject = projectProfile?.kind === 'dotnet' || projectProfile?.kind === 'mixed';

  // Debug: Determine if we should show C# selector
  const shouldShowCSharpSelector = hasCSharpConfigs || isCSharpProject;

  if (import.meta.env.DEV) {
    console.log('[EditorTitleBarCenter] Visibility decision', {
      projectProfileKind: projectProfile?.kind,
      isCSharpProject,
      hasCSharpConfigs,
      shouldShowCSharpSelector,
      configsLength: configurations.length,
      isLoadingConfigs,
    });
  }

  return (
    <>
      <span className="text-xs text-muted-foreground">
        {currentProject.name}
      </span>
      {/* C# Build Configuration Selector */}
      {isLoadingConfigs && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">|</span>
          <span className="text-xs text-muted-foreground/50 italic">Loading configs...</span>
        </div>
      )}
      {!isLoadingConfigs && hasCSharpConfigs && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">|</span>
          <TitlebarDropdown
            value={selectedConfiguration}
            options={configurations.map((config) => ({
              value: config.name,
              label: config.name,
              description: config.target_framework,
            }))}
            onChange={setSelectedConfiguration}
            width="auto"
            align="center"
          />
        </div>
      )}
      {!isLoadingConfigs && configurations.length === 0 && isCSharpProject && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">|</span>
          <span className="text-xs text-yellow-600 dark:text-yellow-400" title="No build configurations found">
            No configs
          </span>
        </div>
      )}
      {/* Show detection error indicator when detection fails and no configs loaded */}
      {projectInitStatus === 'error' && configurations.length === 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">|</span>
          <span
            className="text-xs text-red-500 dark:text-red-400 cursor-help"
            title={projectInitError || 'Project detection failed'}
          >
            ⚠ Detection failed
          </span>
        </div>
      )}
    </>
  );
}

const EditorTitleBarCenterMemo = memo(EditorTitleBarCenter);

// Export memoized versions
export { EditorTitleBarMemo as EditorTitleBar, EditorTitleBarCenterMemo as EditorTitleBarCenter };
