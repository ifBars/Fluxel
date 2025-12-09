import { useEffect, RefObject } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';
import { useWorkbenchStore } from '@/stores/useWorkbenchStore';

export function useKeyboardShortcuts(sidebarPanelRef: RefObject<ImperativePanelHandle | null>) {
    const { setActiveActivity } = useWorkbenchStore();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
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
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [sidebarPanelRef, setActiveActivity]);
}
