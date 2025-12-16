import { useEffect } from 'react';
import { useProfilerStore } from '@/stores';

export function useGlobalShortcuts() {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Use Meta key on Mac, Control on Windows/Linux
            const modifier = event.metaKey || event.ctrlKey;

            // Ctrl/Cmd + Alt + P: Toggle Profiler Panel
            if (modifier && event.altKey && (event.key === 'p' || event.key === 'P')) {
                event.preventDefault();
                useProfilerStore.getState().togglePanel();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
}
