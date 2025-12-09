import { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, GitBranch, Box } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/useProjectStore";
import { useFileSystemStore } from "@/stores/useFileSystemStore";
import { loadConfigMetadata } from "@/lib/config/loader";
import SettingsDialog from "@/components/workbench/SettingsDialog";
import logo from "@/assets/logo.png";

interface LandingPageProps {
    onProjectOpen: () => void;
}

export default function LandingPage({ onProjectOpen }: LandingPageProps) {
    const { recentProjects, openProject } = useProjectStore();
    const { loadDirectory, clearTree } = useFileSystemStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleOpenProject = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Open Project",
            });

            if (selected && typeof selected === "string") {
                clearTree();
                openProject(selected);
                await loadDirectory(selected);

                // Load config metadata in the background
                loadConfigMetadata(selected).catch((error) => {
                    console.error("Failed to load config metadata:", error);
                });

                onProjectOpen();
            }
        } catch (error) {
            console.error("Failed to open project:", error);
        }
    };

    const handleOpenRecentProject = async (rootPath: string) => {
        try {
            clearTree();
            openProject(rootPath);
            await loadDirectory(rootPath);

            // Load config metadata in the background
            loadConfigMetadata(rootPath).catch((error) => {
                console.error("Failed to load config metadata:", error);
            });

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
                        icon={<FolderOpen size={18} />}
                        label="Open project"
                        onClick={handleOpenProject}
                    />
                    <ActionButton
                        icon={<GitBranch size={18} />}
                        label="Clone repo"
                        onClick={() => { }}
                        disabled
                    />
                    <ActionButton
                        icon={<Box size={18} />}
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
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                flex flex-col items-start gap-2 p-4 rounded-lg border border-border bg-card
                transition-all duration-150
                ${disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                }
            `}
        >
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm font-medium text-foreground">{label}</span>
        </button>
    );
}
