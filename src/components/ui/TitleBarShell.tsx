import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePreviewStore } from "@/stores";
import { killAllProcesses } from '@/lib/services/processManager';

// Inline SVG icons to avoid eager loading lucide-react during app initialization
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const MinusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const SquareIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>
);

interface TitleBarShellProps {
  /** Optional editor-specific menus to render after the logo */
  leftContent?: React.ReactNode;
  /** Optional editor-specific content to render in the center area */
  centerContent?: React.ReactNode;
}

/**
 * Lightweight titlebar shell with window controls and logo.
 * Does not import any project/build/C# stores to avoid loading them on cold start.
 */
export function TitleBarShell({ leftContent, centerContent }: TitleBarShellProps) {
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
      if (import.meta.env.DEV) {
        console.log('[TitleBarShell] Cleaning up before close...');
      }

      // Stop preview server first (if running)
      await usePreviewStore.getState().stopPreview().catch((err) => {
        console.error('Failed to stop preview server:', err);
      });

      // Kill all tracked child processes
      await killAllProcesses().catch((err) => {
        console.error('Failed to kill all processes:', err);
      });

      if (import.meta.env.DEV) {
        console.log('[TitleBarShell] Cleanup complete, closing window...');
      }

      // Close the window - Tauri backend will also run cleanup on exit event
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Close error:", error);
    }
  };

  return (
    <div className="relative z-40 flex items-center justify-between h-10 bg-card/80 backdrop-blur-sm border-b border-border/50 select-none">
      {/* Left side - Logo and optional menus */}
      <div className="flex items-center h-full">
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-4 text-sm font-medium text-foreground h-full"
        >
          <span className="text-primary font-bold">Fluxel</span>
        </div>
        {leftContent}
      </div>

      {/* Center - Optional editor-specific content */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center h-full"
      >
        {centerContent}
      </div>

      {/* Window Controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-muted transition-colors duration-150"
          aria-label="Minimize"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-muted transition-colors duration-150"
          aria-label="Maximize"
        >
          <SquareIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-destructive hover:text-destructive-foreground transition-colors duration-150"
          aria-label="Close"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
