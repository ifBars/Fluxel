import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores";
import { openWorkspace } from "@/lib/services/ProjectManager";
import SettingsDialog from "@/components/workbench/SettingsDialog";
import { Button } from "@/components/ui/button";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";
import logo from "@/assets/logo.png";

// Inline SVG icons to avoid eager loading lucide-react during app initialization
const FolderOpenIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
);

const GitBranchIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
);

const BoxIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

interface LandingPageProps {
    onProjectOpen: () => void;
}

export default function LandingPage({ onProjectOpen }: LandingPageProps) {
    const { recentProjects } = useProjectStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [openingProjectPath, setOpeningProjectPath] = useState<string | null>(null);

    const handleOpenProject = async () => {
        const clickSpan = FrontendProfiler.startSpan('landing:open_project_click', 'frontend_interaction');
        FrontendProfiler.trackInteraction('button_click', { button: 'open_project' });
        
        await FrontendProfiler.profileAsync('landing:handleOpenProject', 'frontend_interaction', async () => {
        try {
            const dialogSpan = FrontendProfiler.startSpan('landing:open_project_dialog', 'frontend_interaction');
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Open Project",
            });
            dialogSpan.end({ hasSelection: selected ? 'true' : 'false' });

            if (selected && typeof selected === "string") {
                setOpeningProjectPath(selected);
                const transitionSpan = FrontendProfiler.startSpan('landing:open_project_transition', 'frontend_interaction');
                startTransition(async () => {
                    try {
                        // Wait for directory to load before switching views
                        await openWorkspace(selected, { waitForDirectory: true });
                        transitionSpan.end({ path: selected });
                        onProjectOpen();
                    } catch (error) {
                        console.error("Failed to open project:", error);
                        transitionSpan.end({ error: 'true' });
                    } finally {
                        setOpeningProjectPath(null);
                    }
                });
            }
        } catch (error) {
            console.error("Failed to open project:", error);
        }
        }).finally(async () => {
            await clickSpan.end();
        });
    };

    const handleOpenRecentProject = async (rootPath: string) => {
        const clickSpan = FrontendProfiler.startSpan('landing:open_recent_project_click', 'frontend_interaction');
        FrontendProfiler.trackInteraction('button_click', { button: 'open_recent_project', path: rootPath });
        
        // Show loading state immediately
        setOpeningProjectPath(rootPath);
        
    // Use startTransition to keep UI responsive during workspace opening
    // Profile the gap between workspace opening and view switch
    const gapSpan = FrontendProfiler.startSpan('gap:workspaceToViewSwitch', 'frontend_interaction');
    
    FrontendProfiler.profileAsync('landing:handleOpenRecentProject', 'frontend_interaction', async () => {
            try {
                // Wait for directory to load before switching views
                // This eliminates the gap where the UI switches but file tree isn't ready
                await openWorkspace(rootPath, { waitForDirectory: true });
                
                // End gap span when workspace opens, before view switch
                gapSpan.end({ rootPath });
                
                // Profile React transition scheduling
                const transitionSpan = FrontendProfiler.startSpan('react:startTransition', 'frontend_render');
                startTransition(() => {
                    // End transition span when React schedules the update
                    Promise.resolve().then(() => {
                        transitionSpan.end({ view: 'editor' });
                    });
                    
                    try {
                        onProjectOpen();
                    } catch (error) {
                        console.error("Failed to open recent project:", error);
                    } finally {
                        setOpeningProjectPath(null);
                    }
                });
            } catch (error) {
                console.error("Failed to open recent project:", error);
                gapSpan.cancel();
                setOpeningProjectPath(null);
            }
        }, { rootPath }).finally(async () => {
            await clickSpan.end({ path: rootPath });
        }).catch(() => {
            // Ignore errors in profiling
        });
    };

    // Truncate path from the left for display
    const truncatePath = (path: string, maxLength = 45) => {
        if (path.length <= maxLength) return path;
        return "..." + path.slice(-(maxLength - 3));
    };

    return (
        <div className="h-full w-full bg-background flex flex-col items-center justify-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center max-w-2xl w-full px-8"
            >
                {/* Logo and Brand */}
                <div className="flex flex-col items-center mb-12">
                    <div className="flex items-center gap-4 mb-4">
                        <img src={logo} alt="Fluxel Logo" className="w-16 h-16" />
                        <h1 className="text-5xl font-bold text-foreground tracking-tight font-sans">
                            FLUXEL
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground/80 font-medium">
                        <span className="text-primary/90">Pro+</span>
                        <span className="text-muted-foreground/40">•</span>
                        <button
                            onClick={() => {
                                const clickSpan = FrontendProfiler.startSpan('landing:settings_button_click', 'frontend_interaction');
                                FrontendProfiler.trackInteraction('button_click', { button: 'settings' });
                                FrontendProfiler.profileSync('landing:open_settings', 'frontend_interaction', () => {
                                    setIsSettingsOpen(true);
                                });
                                clickSpan.end();
                            }}
                            className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                        >
                            Settings
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 w-full mb-10">
                    <ActionButton
                        icon={<FolderOpenIcon size={18} />}
                        label="Open project"
                        onClick={handleOpenProject}
                    />
                    <ActionButton
                        icon={<GitBranchIcon size={18} />}
                        label="Clone repo"
                        onClick={() => {
                            FrontendProfiler.trackInteraction('button_click', { button: 'clone_repo', disabled: 'true' });
                        }}
                        disabled
                    />
                    <ActionButton
                        icon={<BoxIcon size={18} />}
                        label="Placeholder"
                        onClick={() => {
                            FrontendProfiler.trackInteraction('button_click', { button: 'placeholder', disabled: 'true' });
                        }}
                        disabled
                    />
                </div>

                {/* Recent Projects */}
                <div className="w-full">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">Recent projects</span>
                        <span className="text-sm text-muted-foreground">
                            View all ({recentProjects.length})
                        </span>
                    </div>

                    {recentProjects.length === 0 ? (
                        <div className="text-sm text-muted-foreground/60 text-center py-8">
                            No recent projects
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {recentProjects.slice(0, 5).map((project) => {
                                const isOpening = openingProjectPath === project.rootPath;
                                return (
                                    <button
                                        key={project.rootPath}
                                        onClick={() => handleOpenRecentProject(project.rootPath)}
                                        disabled={isPending}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                            {isOpening && (
                                                <svg
                                                    className="animate-spin h-3 w-3"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    />
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    />
                                                </svg>
                                            )}
                                            {project.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {truncatePath(project.rootPath)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Settings Dialog */}
            <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

function ActionButton({ icon, label, onClick, disabled }: ActionButtonProps) {
    return (
        <Button
            variant="surface"
            size="tile"
            onClick={onClick}
            disabled={disabled}
            className="flex-col items-start text-left"
        >
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm font-medium text-foreground">{label}</span>
        </Button>
    );
}
