import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { X, Minus, Square, ChevronDown } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useFileSystemStore } from "@/stores/useFileSystemStore";
import { useEditorStore } from "@/stores/useEditorStore";
import { loadConfigMetadata } from "@/lib/config/loader";

interface TitleBarProps {
  showMenu?: boolean;
  onCloseProject?: () => void;
}

export function TitleBar({ showMenu = true, onCloseProject }: TitleBarProps) {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  const { openProject, currentProject } = useProjectStore();
  const { loadDirectory, clearTree } = useFileSystemStore();
  const { closeAllTabs, saveAllFiles } = useEditorStore();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenFolder = async () => {
    setIsFileMenuOpen(false);
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
    setIsFileMenuOpen(false);
    await saveAllFiles();
  };

  const handleCloseProject = () => {
    setIsFileMenuOpen(false);
    closeAllTabs();
    clearTree();
    onCloseProject?.();
  };

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

  return (
    <div className="relative z-40 flex items-center justify-between h-10 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none">
      {/* Left side - Logo and Menu */}
      <div className="flex items-center h-full">
        {/* Logo */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-4 text-sm font-medium text-foreground h-full"
        >
          <span className="text-primary font-bold">Fluxel</span>
        </div>

        {/* File Menu */}
        {showMenu && (
          <div ref={fileMenuRef} className="relative">
            <button
              onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              className={`h-10 px-3 flex items-center gap-1 text-sm hover:bg-muted/50 transition-colors ${isFileMenuOpen ? 'bg-muted/50' : ''}`}
            >
              File
              <ChevronDown className="w-3 h-3" />
            </button>

            {isFileMenuOpen && (
              <div className="absolute top-full left-0 mt-0.5 w-56 bg-card/100 border border-border rounded-md shadow-lg py-1 z-[80] backdrop-blur-none">
                <MenuItem
                  label="Open Folder..."
                  shortcut="Ctrl+O"
                  onClick={handleOpenFolder}
                />
                <MenuDivider />
                <MenuItem
                  label="Save All"
                  shortcut="Ctrl+Shift+S"
                  onClick={handleSaveAll}
                />
                <MenuDivider />
                <MenuItem
                  label="Close Folder"
                  onClick={handleCloseProject}
                  disabled={!currentProject}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center - Project name (draggable) */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center h-full"
      >
        {currentProject && (
          <span className="text-xs text-muted-foreground">
            {currentProject.name}
          </span>
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

interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({ label, shortcut, onClick, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-1.5 text-sm text-left flex items-center justify-between transition-colors ${disabled
        ? 'text-muted-foreground/50 cursor-not-allowed'
        : 'hover:bg-muted/50 text-foreground'
        }`}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="text-xs text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-border" />;
}
