import { useEffect, useState } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useGitStore, useProjectStore, useSettingsStore, useEditorStore } from '@/stores';
import { RefreshCw, GitCommit, Upload, Download, Loader2, Trash2, CheckSquare, Square } from 'lucide-react';

export default function GitPanel() {
    const {
        files,
        branch,
        isLoading,
        error,
        commitMessage,
        setCommitMessage,
        refreshStatus,
        commit,
        push,
        pull,
        getFileAtHead,
        discardChanges
    } = useGitStore();

    const { currentProject } = useProjectStore();
    const { githubToken } = useSettingsStore();

    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    // Initialize selection when files change
    useEffect(() => {
        // By default select all files that are not already selected (to preserve unselected state if we wanted distinct behavior, 
        // but here we just re-select everything on refresh effectively similar to VSCode's behavior of staging all new changes 
        // if we consider "files" as "changes"). 
        // Actually, better UX: if files change significantly (refresh), reset selection to all?
        // Or if we consider this list as "Unstaged Changes" + "Staged Changes" combined (simplified view), 
        // we might want to default to all selected.

        // Let's default to all files selected whenever the file list changes length or content
        const newSet = new Set<string>();
        files.forEach(f => newSet.add(f.path));
        setSelectedFiles(newSet);
    }, [files]);

    const toggleFileSelection = (path: string) => {
        const newSet = new Set(selectedFiles);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        setSelectedFiles(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedFiles.size === files.length) {
            setSelectedFiles(new Set());
        } else {
            const newSet = new Set<string>();
            files.forEach(f => newSet.add(f.path));
            setSelectedFiles(newSet);
        }
    };

    useEffect(() => {
        if (currentProject) {
            refreshStatus(currentProject.rootPath);
        }
    }, [currentProject, refreshStatus]);

    const handleCommit = async () => {
        if (!currentProject || !commitMessage.trim()) return;
        if (selectedFiles.size === 0) {
            alert('No files selected for commit');
            return;
        }
        try {
            await commit(currentProject.rootPath, commitMessage, Array.from(selectedFiles));
        } catch (e) {
            console.error(e);
        }
    };

    const handlePush = async () => {
        if (!currentProject || !githubToken) {
            alert('Please configure GitHub Token in settings first');
            return;
        }
        try {
            await push(currentProject.rootPath, githubToken);
        } catch (e) {
            alert(String(e));
        }
    };

    const handlePull = async () => {
        if (!currentProject || !githubToken) {
            alert('Please configure GitHub Token in settings first');
            return;
        }
        try {
            await pull(currentProject.rootPath, githubToken);
        } catch (e) {
            alert(String(e));
        }
    };

    const { openDiff } = useEditorStore();

    const handleFileClick = async (file: { path: string, status: string }) => {
        console.log('[GitPanel] File clicked:', file);
        if (!currentProject) {
            console.error('[GitPanel] No project open');
            return;
        }

        // Construct absolute path for the editor tab
        // git status returns relative paths, but the editor expects absolute paths
        const absolutePath = `${currentProject.rootPath}/${file.path}`.replace(/\\/g, '/').replace(/\/+/g, '/');
        console.log('[GitPanel] Absolute path:', absolutePath);

        try {
            let original = '';
            // Only try to read HEAD if not new
            if (file.status !== 'new') {
                console.log('[GitPanel] Fetching HEAD content...');
                try {
                    original = await getFileAtHead(currentProject.rootPath, file.path);
                    console.log('[GitPanel] HEAD content fetched, length:', original.length);
                } catch (err) {
                    console.error('[GitPanel] Failed to fetch HEAD:', err);
                    throw new Error(`Failed to fetch HEAD version: ${err}`);
                }
            }

            let modified = '';
            // Read working copy content if not deleted
            if (file.status !== 'deleted') {
                try {
                    console.log('[GitPanel] Reading working copy...');
                    modified = await readTextFile(absolutePath);
                    console.log('[GitPanel] Working copy read, length:', modified.length);
                } catch (readErr) {
                    console.error('[GitPanel] Failed to read working file:', readErr);
                    throw new Error(`Failed to read working copy: ${readErr}`);
                }
            }

            // Open diff with explicit content
            console.log('[GitPanel] Opening diff tab...');
            await openDiff(absolutePath, original, modified);
            console.log('[GitPanel] Diff tab opened');
        } catch (e) {
            console.error('[GitPanel] Error handling file click:', e);
            alert(`Failed to open diff for path: ${absolutePath}\nError: ${e}`);
        }
    };

    const handleDiscard = async (file: { path: string }) => {
        if (!currentProject) return;
        if (!confirm(`Are you sure you want to discard changes to ${file.path}?`)) return;

        try {
            await discardChanges(currentProject.rootPath, file.path);
        } catch (e) {
            alert(String(e));
        }
    };

    if (!currentProject) {
        return (
            <div className="p-4 text-sm text-muted-foreground text-center">
                <p>No project open</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="p-2 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {branch || '...'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => refreshStatus(currentProject.rootPath)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Refresh Status"
                    >
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handlePull}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Pull"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        onClick={handlePush}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Push"
                    >
                        <Upload size={14} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-destructive/10 text-destructive text-xs p-2 m-2 rounded border border-destructive/20 break-words">
                    {error}
                </div>
            )}

            {/* Changes List */}
            <div className="flex-1 overflow-auto">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleSelectAll}
                            className="hover:text-foreground transition-colors"
                            title={selectedFiles.size === files.length ? "Deselect All" : "Select All"}
                        >
                            {files.length > 0 && selectedFiles.size === files.length ? (
                                <CheckSquare size={14} />
                            ) : (
                                <Square size={14} className={selectedFiles.size > 0 ? "opacity-50" : ""} />
                            )}
                        </button>
                        <span>Changes</span>
                    </div>
                    <span>{selectedFiles.size} / {files.length}</span>
                </div>

                {files.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground italic text-center opacity-70">
                        No changes detected.
                    </div>
                ) : (
                    <div className="space-y-px">
                        {files.map((file) => (
                            <div
                                key={file.path}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-sm group cursor-pointer"
                                onClick={() => handleFileClick(file)}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFileSelection(file.path);
                                    }}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {selectedFiles.has(file.path) ? (
                                        <CheckSquare size={14} className="text-primary" />
                                    ) : (
                                        <Square size={14} />
                                    )}
                                </button>
                                <span className={`w-3 h-3 rounded-full shrink-0 ${file.status === 'modified' ? 'bg-orange-500' :
                                    file.status === 'new' ? 'bg-green-500' :
                                        file.status === 'deleted' ? 'bg-red-500' : 'bg-gray-500'
                                    }`} title={file.status} />
                                <span className="truncate flex-1 text-foreground/80 group-hover:text-foreground">
                                    {file.path.split(/[\\/]/).pop()}
                                </span>
                                <span className="text-xs text-muted-foreground opacity-50 shrink-0 mr-2">
                                    {file.status[0]?.toUpperCase()}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDiscard(file);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                    title="Discard Changes"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Commit Section */}
            <div className="p-3 border-t border-border bg-muted/10">
                <div className="space-y-2">
                    <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Message (Ctrl+Enter to commit)"
                        className="w-full h-20 bg-background border border-border rounded p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                handleCommit();
                            }
                        }}
                    />
                    <button
                        onClick={handleCommit}
                        disabled={isLoading || files.length === 0 || selectedFiles.size === 0 || !commitMessage.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-1.5 rounded text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <GitCommit size={14} />}
                        Commit ({selectedFiles.size})
                    </button>
                </div>
            </div>
        </div>
    );
}
