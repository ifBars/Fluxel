import { Suspense, lazy } from 'react';
import { Eye, Terminal, Hammer } from 'lucide-react';
import { useEditorStore, useProjectStore } from '@/stores';
import type { ProjectProfile } from '@/types/project';

// Lazy-load preview components to avoid loading them until needed
const WebPreview = lazy(() => import('./previews/WebPreview'));
const MarkdownPreview = lazy(() => import('./previews/MarkdownPreview'));

/**
 * C# Preview placeholder component
 */
function CSharpPreview() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
            <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4 max-w-md">
                <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Hammer className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold">C# Development</h3>
                <p className="text-muted-foreground text-center mb-6">
                    Visual preview is not available for C# files. Use the Build Panel for project management, building, and diagnostics.
                </p>
                
                <div className="space-y-3 w-full">
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Terminal className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-foreground mb-1">Build Panel</p>
                            <p className="text-xs">Access build commands, output, and C# diagnostics</p>
                        </div>
                    </div>
                    
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-foreground mb-1">Code Editor</p>
                            <p className="text-xs">Full C# language support with IntelliSense</p>
                        </div>
                    </div>
                </div>
                
                <div className="text-xs text-muted-foreground text-center mt-4">
                    <p>Switch to Code mode for C# development</p>
                </div>
            </div>
        </div>
    );
}

/**
 * Determine the preview type based on file extension and project context
 */
function getPreviewType(filename: string, projectProfile?: ProjectProfile | null): 'markdown' | 'web' | 'csharp' | null {
    const extension = filename.split('.').pop()?.toLowerCase();

    // Markdown files always get preview
    if (extension && ['md', 'markdown', 'mdx'].includes(extension)) {
        return 'markdown';
    }

    // C# files - show C# specific preview
    if (extension && ['cs', 'csx', 'csproj', 'sln'].includes(extension)) {
        return 'csharp';
    }

    // Only show web preview for web-related files in web projects
    const webExtensions = ['html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'];
    if (extension && webExtensions.includes(extension)) {
        // Only show web preview if it's a JavaScript/TypeScript project or mixed project
        if (projectProfile?.kind === 'javascript' || projectProfile?.kind === 'mixed') {
            return 'web';
        }
    }

    return null; // No preview available
}

export default function VisualEditor() {
    const { getActiveTab } = useEditorStore();
    const { projectProfile } = useProjectStore();
    const activeTab = getActiveTab();

    // If no file is open, show a placeholder
    if (!activeTab) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
                <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Preview</h3>
                    <p className="text-muted-foreground text-center max-w-xs">
                        Open a file to see its preview here.
                    </p>
                </div>
            </div>
        );
    }

    // Determine which preview to show based on file type and project context
    const previewType = getPreviewType(activeTab.filename, projectProfile);

    // Render the appropriate preview component with Suspense fallback
    if (previewType === 'markdown') {
        return (
            <Suspense fallback={null}>
                <MarkdownPreview
                    content={activeTab.content}
                    filename={activeTab.filename}
                />
            </Suspense>
        );
    }

    if (previewType === 'csharp') {
        return <CSharpPreview />;
    }

    if (previewType === 'web') {
        return (
            <Suspense fallback={null}>
                <WebPreview />
            </Suspense>
        );
    }

    // Show "no preview available" for unsupported file types
    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
            <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center">
                    <Eye className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">No Preview Available</h3>
                <p className="text-muted-foreground text-center max-w-xs">
                    Preview is not available for this file type. Use the Code Editor for editing.
                </p>
            </div>
        </div>
    );
}
