import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { X, Minus, Square } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useFileSystemStore } from "@/stores/useFileSystemStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { useSettingsStore, UIDensity } from "@/stores/useSettingsStore";
import { useWorkbenchStore } from "@/stores/useWorkbenchStore";
import { useBuildPanelStore } from "@/stores/useBuildPanelStore";
import { useCSharpStore } from "@/stores/useCSharpStore";
import { loadConfigMetadata } from "@/lib/config/loader";
import { executeBuild, executeTypeCheck } from "@/lib/buildManager";
import { TitlebarDropdown } from "./TitlebarDropdown";
import {
  TitlebarMenuButton,
  TitlebarMenuDropdown,
  TitlebarMenuItem,
  TitlebarMenuDivider,
  useTitlebarMenu,
} from "./TitlebarMenu";

interface TitleBarProps {
  showMenu?: boolean;
  onCloseProject?: () => void;
}

export function TitleBar({ showMenu = true, onCloseProject }: TitleBarProps) {
  const [isBuilding, setIsBuilding] = useState(false);

  // Menu state management
  const { activeMenu, menuRef, toggleMenu, openMenuOnHover, closeMenu } = useTitlebarMenu();

  const { openProject, currentProject } = useProjectStore();
  const { loadDirectory, clearTree } = useFileSystemStore();
  const { closeAllTabs, saveAllFiles, triggerAction } = useEditorStore();

  // Settings and Workbench stores for View menu
  const {
    setSidebarOpen,
    isSidebarOpen,
  } = useWorkbenchStore();

  const {
    fontSize, setFontSize,
    wordWrap, setWordWrap,
    showMinimap, setShowMinimap,
    showLineNumbers, setShowLineNumbers,
    uiDensity, setUIDensity,
    buildSystem, customBuildCommand
  } = useSettingsStore();

  // C# configuration store
  const { configurations, selectedConfiguration, setSelectedConfiguration } = useCSharpStore();



  // Load C# configurations when project changes
  useEffect(() => {
    if (currentProject?.rootPath) {
      console.log('[TitleBar] Project changed, loading C# configurations for:', currentProject.rootPath);
      useCSharpStore.getState().loadProjectConfigurations(currentProject.rootPath);
    } else {
      // Reset configurations when no project is open
      useCSharpStore.getState().reset();
    }
  }, [currentProject?.rootPath]);



  // File Menu Actions
  const handleOpenFolder = async () => {
    closeMenu();
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });

      if (selected && typeof selected === 'string') {
        // Close existing tabs and clear tree
        closeAllTabs();
        clearTree();

        // Open the new project
        openProject(selected);
        await loadDirectory(selected);

        // Load config metadata in the background
        loadConfigMetadata(selected).catch((error) => {
          console.error("Failed to load config metadata:", error);
        });
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleSaveAll = async () => {
    closeMenu();
    await saveAllFiles();
  };

  // Build Panel Store
  const { startBuild, finishBuild, setOutput, appendOutput } = useBuildPanelStore();

  const handleBuildProject = async () => {
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
      finishBuild(result.success ? 'success' : 'error');
    } catch (error) {
      appendOutput(`Build error: ${error}`);
      finishBuild('error');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleTypeCheck = async () => {
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
      finishBuild(result.success ? 'success' : 'error');
    } catch (error) {
      appendOutput(`Type check error: ${error}`);
      finishBuild('error');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleCloseProject = () => {
    closeMenu();
    closeAllTabs();
    clearTree();
    onCloseProject?.();
  };

  // View Menu Actions
  const handleZoomIn = () => setFontSize(Math.min(fontSize + 1, 32));
  const handleZoomOut = () => setFontSize(Math.max(fontSize - 1, 8));
  const handleResetZoom = () => setFontSize(14);
  const cycleDensity = () => {
    const densities: UIDensity[] = ['compact', 'comfortable', 'spacious'];
    const nextIndex = (densities.indexOf(uiDensity) + 1) % densities.length;
    setUIDensity(densities[nextIndex]);
  };

  // Window Controls
  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("Minimize error:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (error) {
      console.error("Maximize error:", error);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Close error:", error);
    }
  };

  // Helper for triggering editor actions
  const action = (act: import("@/stores/useEditorStore").EditorAction) => {
    triggerAction(act);
    closeMenu();
  };

  return (
    <div className="relative z-40 flex items-center justify-between h-10 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none">
      {/* Left side - Logo and Menu */}
      <div className="flex items-center h-full" ref={menuRef}>
        {/* Logo */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-4 text-sm font-medium text-foreground h-full"
        >
          <span className="text-primary font-bold">Fluxel</span>
        </div>

        {/* Menubar */}
        {showMenu && (
          <div className="flex items-center h-full">
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
                    onClick={() => { setWordWrap(!wordWrap); closeMenu(); }}
                    checked={wordWrap}
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
        )}
      </div>

      {/* Center - Project name + C# Config selector (draggable) */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center h-full gap-3"
      >
        {currentProject && (
          <>
            <span className="text-xs text-muted-foreground">
              {currentProject.name}
            </span>
            {/* C# Build Configuration Selector */}
            {configurations.length > 0 && (
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
          </>
        )}
      </div>

      {/* Window Controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-muted transition-colors duration-150"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-muted transition-colors duration-150"
          aria-label="Maximize"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-destructive hover:text-destructive-foreground transition-colors duration-150"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
