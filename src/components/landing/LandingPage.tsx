import { useState } from "react";
import { motion } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores";
import { openWorkspace } from "@/lib/services/ProjectManager";
import SettingsDialog from "@/components/workbench/SettingsDialog";
import { Button } from "@/components/ui/button";
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

    const handleOpenProject = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Open Project",
            });

            if (selected && typeof selected === "string") {
                await openWorkspace(selected);

                onProjectOpen();
            }
        } catch (error) {
            console.error("Failed to open project:", error);
        }
    };

    const handleOpenRecentProject = async (rootPath: string) => {
        try {
            await openWorkspace(rootPath);

            onProjectOpen();
        } catch (error) {
            console.error("Failed to open recent project:", error);
        }
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
                            onClick={() => setIsSettingsOpen(true)}
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
                        onClick={() => { }}
                        disabled
                    />
                    <ActionButton
                        icon={<BoxIcon size={18} />}
                        label="Placeholder"
                        onClick={() => { }}
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
                            {recentProjects.slice(0, 5).map((project) => (
                                <button
                                    key={project.rootPath}
                                    onClick={() => handleOpenRecentProject(project.rootPath)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                                >
                                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                        {project.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {truncatePath(project.rootPath)}
                                    </span>
                                </button>
                            ))}
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
