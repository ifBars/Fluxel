import { useEffect, RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useWorkbenchStore, useBuildPanelStore, useAgentStore, useDiagnosticsStore } from '@/stores';

export function useKeyboardShortcuts(sidebarPanelRef: RefObject<PanelImperativeHandle | null>) {
    const { setActiveActivity } = useWorkbenchStore();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if editor has focus (avoid interfering with input fields)
            const target = event.target as HTMLElement;
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // Use Meta key on Mac, Control on Windows/Linux
            const modifier = event.metaKey || event.ctrlKey;

            // Ctrl/Cmd + B: Toggle Sidebar
            if (modifier && event.key === 'b' && !event.shiftKey) {
                event.preventDefault();
                const panel = sidebarPanelRef.current;
                if (panel) {
                    if (panel.isCollapsed()) {
                        panel.expand();
                    } else {
                        panel.collapse();
                    }
                }
                return;
            }

            // Ctrl/Cmd + Shift + E: Focus Explorer
            if (modifier && event.shiftKey && event.key === 'E') {
                event.preventDefault();
                setActiveActivity('files');
                return;
            }

            // Ctrl/Cmd + Shift + F: Focus Search
            if (modifier && event.shiftKey && event.key === 'F') {
                event.preventDefault();
                setActiveActivity('search');
                return;
            }

            // Ctrl/Cmd + Shift + G: Focus Source Control
            if (modifier && event.shiftKey && event.key === 'G') {
                event.preventDefault();
                setActiveActivity('git');
                return;
            }

            // Ctrl/Cmd + ` : Toggle Build/Terminal Panel

            // Ctrl/Cmd + B: Toggle Sidebar
            if (modifier && event.key === 'b' && !event.shiftKey) {
                event.preventDefault();
                const panel = sidebarPanelRef.current;
                if (panel) {
                    if (panel.isCollapsed()) {
                        panel.expand();
                    } else {
                        panel.collapse();
                    }
                }
                return;
            }

            // Ctrl/Cmd + Shift + E: Focus Explorer
            if (modifier && event.shiftKey && event.key === 'E') {
                event.preventDefault();
                setActiveActivity('files');
                return;
            }

            // Ctrl/Cmd + Shift + F: Focus Search
            if (modifier && event.shiftKey && event.key === 'F') {
                event.preventDefault();
                setActiveActivity('search');
                return;
            }

            // Ctrl/Cmd + Shift + G: Focus Source Control
            if (modifier && event.shiftKey && event.key === 'G') {
                event.preventDefault();
                setActiveActivity('git');
                return;
            }

            // Ctrl/Cmd + ` : Toggle Build/Terminal Panel
            if (modifier && event.key === '`') {
                event.preventDefault();
                useBuildPanelStore.getState().togglePanel();
                return;
            }

            // Ctrl/Cmd + L: Toggle AI Agent Panel
            if (modifier && event.key === 'l' && !event.shiftKey) {
                event.preventDefault();
                useAgentStore.getState().togglePanel();
                return;
            }



            // Ctrl/Cmd + Shift + P: Command Palette (mapped to Search for now)
            if (modifier && event.shiftKey && (event.key === 'p' || event.key === 'P')) {
                event.preventDefault();
                setActiveActivity('search');
                return;
            }

            // F8: Go to next problem (editor should have focus)
            if (event.key === 'F8' && !event.shiftKey && !modifier && !isInputField) {
                event.preventDefault();
                useDiagnosticsStore.getState().goToNextDiagnostic();
                return;
            }

            // Shift+F8: Go to previous problem (editor should have focus)
            if (event.key === 'F8' && event.shiftKey && !modifier && !isInputField) {
                event.preventDefault();
                useDiagnosticsStore.getState().goToPreviousDiagnostic();
                return;
            }

            // Ctrl+Shift+M: Toggle Problems panel
            if (modifier && event.shiftKey && event.key === 'M') {
                event.preventDefault();
                useBuildPanelStore.getState().togglePanel();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [sidebarPanelRef, setActiveActivity]);
}
