import { Suspense, lazy } from 'react';
import { Eye } from 'lucide-react';
import { useEditorStore } from '@/stores';

// Lazy-load preview components to avoid loading them until needed
const WebPreview = lazy(() => import('./previews/WebPreview'));
const MarkdownPreview = lazy(() => import('./previews/MarkdownPreview'));

/**
 * Determine the preview type based on file extension
 */
function getPreviewType(filename: string): 'markdown' | 'web' | null {
    const extension = filename.split('.').pop()?.toLowerCase();

    // Markdown files
    if (extension && ['md', 'markdown', 'mdx'].includes(extension)) {
        return 'markdown';
    }

    // Web preview is the default fallback
    return 'web';
}

export default function VisualEditor() {
    const { getActiveTab } = useEditorStore();
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

    // Determine which preview to show based on file type
    const previewType = getPreviewType(activeTab.filename);

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

    // Default to web preview for all other files
    return (
        <Suspense fallback={null}>
            <WebPreview />
        </Suspense>
    );
}
