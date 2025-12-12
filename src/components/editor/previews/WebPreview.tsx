import { useState, useRef, useEffect, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { RefreshCw, ExternalLink, Settings, AlertCircle, Loader2, Power, Play, MousePointer2 } from 'lucide-react';
import { usePreviewStore, useProjectStore, useInspectorStore } from '@/stores';
import { isInspectorMessage } from '@/lib/inspector/inspectorMessages';
import type { IframeToParentMessage } from '@/lib/inspector/inspectorMessages';

import inspectorBridgeScript from '@/lib/inspector/inspectorBridgeInline.js?raw';


console.log('[WebPreview] Module initializing, inspectorBridgeScript length:', inspectorBridgeScript?.length);

export default function WebPreview() {
    const { currentProject } = useProjectStore();
    const {
        previewUrl,
        isServerRunning,
        isLoading,
        error,
        port,
        startPreview,
        stopPreview,
        refreshPreview,
        setPort
    } = usePreviewStore();

    const {
        isInspectorOpen,
        isInspectorMode,
        setInspectorMode,
        setInspectorOpen,
        selectElement,
        setHoveredElement,
        setComponentTree,
        setIframeRef,
    } = useInspectorStore();

    const [showSettings, setShowSettings] = useState(false);
    const [srcDoc, setSrcDoc] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Store iframe ref in inspector store so InspectorPanel can access it
    useEffect(() => {
        setIframeRef(iframeRef as React.RefObject<HTMLIFrameElement>);
        return () => setIframeRef(null);
    }, [setIframeRef]);

    console.log('[WebPreview] Render state:', { previewUrl, isServerRunning, isLoading, isInspectorMode });


    // Handle messages from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Log all messages from inspector prefix to debug flow
            if (event.data && typeof event.data === 'object' && event.data.__source === 'fluxel-inspector:') {
                console.log('[WebPreview] Received inspector message:', event.data.type, event.data);
            }

            if (!isInspectorMessage(event)) return;

            const message = event.data as IframeToParentMessage;
            switch (message.type) {
                case 'inspector:ready':
                    // Iframe is ready, enable inspector if mode is on
                    if (isInspectorMode && iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.postMessage(
                            { type: 'inspector:enable', __source: 'fluxel-inspector:' },
                            '*'
                        );
                    }
                    break;
                case 'element:hover':
                    setHoveredElement(message.payload);
                    break;
                case 'element:select':
                    selectElement(message.payload);
                    break;
                case 'element:deselect':
                    selectElement(null);
                    break;
                case 'tree:update':
                    setComponentTree(message.payload);
                    break;
                case 'style:changed':
                    console.log('[WebPreview] Style applied successfully:', message.payload);
                    break;
                case 'text:changed':
                    console.log('[WebPreview] Text changed successfully:', message.payload);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [isInspectorMode, selectElement, setHoveredElement, setComponentTree]);

    // Cleanup and Auto-start
    // Cleanup and Auto-start
    useEffect(() => {
        const initPreview = async () => {
            console.log('[WebPreview] initPreview check:', { rootPath: currentProject?.rootPath, isServerRunning, isLoading, previewUrl });
            if (currentProject?.rootPath && !isServerRunning && !isLoading && !previewUrl) {
                console.log('[WebPreview] Triggering startPreview for:', currentProject.rootPath);
                // Determine if we should auto-start. 
                // For now, we auto-start if there's no error and we're just mounting.
                // We pass true for auto-start logic (which attempts to spawn bun run dev if needed)
                await startPreview(currentProject.rootPath);
            }
        };

        initPreview();

        return () => {
            // Always stop the preview when component unmounts to prevent zombie processes
            stopPreview().catch(console.error);
        };
    }, [currentProject?.rootPath]); // Dependency on rootPath ensures restart on project switch

    // Fetch content via Bun to bypass CORS and inject inspector script
    useEffect(() => {
        if (!previewUrl || !isServerRunning) {
            setSrcDoc(null);
            return;
        }

        const fetchContent = async () => {
            try {
                console.log('[WebPreview] Fetching content via bun for:', previewUrl);
                // Use bun to fetch the page content -> bypasses CORS
                const cmd = Command.create('bun', [
                    '-e',
                    `fetch('${previewUrl}').then(r => r.text()).then(console.log)`
                ]);

                const output = await cmd.execute();
                if (output.code === 0) {
                    let html = output.stdout;

                    // Inject <base> tag to fix relative links
                    const baseTag = `<base href="${previewUrl}/" />`;
                    if (html.includes('<head>')) {
                        html = html.replace('<head>', `<head>${baseTag}`);
                    } else {
                        // Fallback if no head
                        html = `${baseTag}${html}`;
                    }

                    // Inject inspector script
                    // We put it at the end of body to ensure DOM is present
                    const scriptTag = `<script>${inspectorBridgeScript}</script>`;
                    if (html.includes('</body>')) {
                        html = html.replace('</body>', `${scriptTag}</body>`);
                    } else {
                        html += scriptTag;
                    }

                    console.log('[WebPreview] Content fetched and transformed, setting srcDoc');
                    setSrcDoc(html);
                } else {
                    console.error('[WebPreview] Failed to fetch content via bun:', output.stderr);
                }
            } catch (err) {
                console.error('[WebPreview] Error fetching content:', err);
            }
        };

        fetchContent();
    }, [previewUrl, isServerRunning]);



    // Toggle inspector panel
    const toggleInspector = useCallback(() => {
        if (!isInspectorOpen) {
            setInspectorOpen(true);
        } else {
            setInspectorOpen(false);
            setInspectorMode(false);
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: 'inspector:disable', __source: 'fluxel-inspector:' },
                    '*'
                );
            }
        }
    }, [isInspectorOpen, setInspectorOpen, setInspectorMode]);

    const handleStartPreview = async () => {
        if (currentProject) {
            // Clear any previous error before starting
            usePreviewStore.setState({ error: null });
            await startPreview(currentProject.rootPath);
        }
    };

    const handleOpenExternal = () => {
        if (previewUrl) {
            window.open(previewUrl, '_blank');
        }
    };

    // Show settings panel
    if (showSettings) {
        return (
            <div className="h-full w-full flex flex-col bg-background">
                <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-muted/20">
                    <span className="text-sm font-medium">Web Preview Settings</span>
                    <button
                        onClick={() => setShowSettings(false)}
                        className="text-sm text-primary hover:underline"
                    >
                        Back to Preview
                    </button>
                </div>
                <div className="flex-1 p-6">
                    <div className="max-w-md space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Dev Server Port
                            </label>
                            <input
                                type="number"
                                value={port}
                                onChange={(e) => setPort(parseInt(e.target.value) || 5173)}
                                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
                                placeholder="5173"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                The port where your dev server is running
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show placeholder when no project is open
    if (!currentProject) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
                <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Play className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Web Preview</h3>
                    <p className="text-muted-foreground text-center max-w-xs">
                        Open a project folder to enable the live preview.
                    </p>
                </div>
            </div>
        );
    }

    // Show preview placeholder when not running
    if (!isServerRunning && !isLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
                <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-4 max-w-md">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Play className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Live Web Preview</h3>
                    <p className="text-muted-foreground text-center">
                        Start your dev server and click the button below to see a live preview of your app.
                    </p>

                    {error && (
                        <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 w-full">
                        <button
                            onClick={handleStartPreview}
                            className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Connect to Dev Server
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                    </div>

                    <div className="text-xs text-muted-foreground text-center mt-2">
                        <p>Run your dev server first:</p>
                        <code className="bg-muted px-2 py-1 rounded mt-1 inline-block">
                            bun run dev
                        </code>
                    </div>
                </div>
            </div>
        );
    }

    // Show loading state
    if (isLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground">Connecting to dev server...</p>
                </div>
            </div>
        );
    }

    // Show live preview
    return (
        <div className="h-full w-full flex flex-col bg-background">
            {/* Preview Toolbar */}
            <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">
                        {previewUrl}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Inspector Toggle */}
                    <button
                        onClick={toggleInspector}
                        className={`
                            p-1.5 rounded transition-colors
                            ${isInspectorOpen
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }
                        `}
                        title={isInspectorOpen ? 'Close Inspector' : 'Open Inspector'}
                    >
                        <MousePointer2 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <button
                        onClick={refreshPreview}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleOpenExternal}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Open in Browser"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button
                        onClick={stopPreview}
                        className="ml-2 px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-1"
                        title="Disconnect"
                    >
                        <Power className="w-4 h-4" />
                        <span className="text-xs font-medium">Disconnect</span>
                    </button>
                </div>
            </div>

            {/* Preview iframe */}
            <div className={`flex-1 overflow-hidden bg-white ${isInspectorMode ? 'ring-2 ring-primary ring-inset' : ''}`}>
                {previewUrl && (
                    <iframe
                        ref={iframeRef}
                        key={previewUrl}
                        srcDoc={srcDoc || undefined}
                        src={srcDoc ? undefined : previewUrl}
                        className="w-full h-full border-0"
                        title="Web Preview"
                        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                    />
                )}
            </div>
        </div>
    );
}
