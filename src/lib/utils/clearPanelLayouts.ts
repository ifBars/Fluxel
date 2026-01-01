/**
 * Utility to clear old react-resizable-panels v3 localStorage data
 * This should be run once after migrating to v4
 */
export function clearOldPanelLayouts() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    const prefix = 'react-resizable-panels:';
    const keys = Object.keys(localStorage);
    
    // Clear all react-resizable-panels keys (from v3)
    keys.forEach(key => {
        if (key.startsWith(prefix)) {
            console.log('[Panel Migration] Clearing old layout:', key);
            localStorage.removeItem(key);
        }
    });
}
