import { useEffect } from 'react';
import { useCommandStore, type Command } from '@/stores/commands';
import { useEditorStore, useBuildPanelStore, useAgentStore, useWorkbenchStore, useDiagnosticsStore, useNavigationStore, useDebugStore } from '@/stores';

/**
 * Hook to register default IDE commands
 * Should be called once at app initialization
 */
export function useDefaultCommands() {
    const registerCommand = useCommandStore(state => state.registerCommand);

    useEffect(() => {
        const commands: Command[] = [
            // ================================================================
            // File Commands
            // ================================================================
            {
                id: 'file.save',
                label: 'Save File',
                category: 'file',
                shortcut: 'Ctrl+S',
                description: 'Save the current file',
                when: () => {
                    const { activeTabId, tabs } = useEditorStore.getState();
                    const activeTab = tabs.find(t => t.id === activeTabId);
                    return !!activeTab && activeTab.content !== activeTab.originalContent;
                },
                execute: async () => {
                    const { activeTabId, saveFile } = useEditorStore.getState();
                    if (activeTabId) {
                        await saveFile(activeTabId);
                    }
                },
            },
            {
                id: 'file.saveAll',
                label: 'Save All Files',
                category: 'file',
                shortcut: 'Ctrl+Shift+S',
                description: 'Save all modified files',
                execute: async () => {
                    const { tabs, saveFile } = useEditorStore.getState();
                    for (const tab of tabs) {
                        if (tab.content !== tab.originalContent) {
                            await saveFile(tab.id);
                        }
                    }
                },
            },
            {
                id: 'file.closeTab',
                label: 'Close Tab',
                category: 'file',
                shortcut: 'Ctrl+W',
                description: 'Close the current editor tab',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    const { activeTabId, closeTab } = useEditorStore.getState();
                    if (activeTabId) {
                        closeTab(activeTabId);
                    }
                },
            },
            {
                id: 'file.closeAllTabs',
                label: 'Close All Tabs',
                category: 'file',
                description: 'Close all editor tabs',
                when: () => useEditorStore.getState().tabs.length > 0,
                execute: () => {
                    const { tabs, closeTab } = useEditorStore.getState();
                    tabs.forEach(tab => closeTab(tab.id));
                },
            },

            // ================================================================
            // Edit Commands
            // ================================================================
            {
                id: 'edit.undo',
                label: 'Undo',
                category: 'edit',
                shortcut: 'Ctrl+Z',
                description: 'Undo last action',
                execute: () => {
                    useEditorStore.getState().triggerAction('undo');
                },
            },
            {
                id: 'edit.redo',
                label: 'Redo',
                category: 'edit',
                shortcut: 'Ctrl+Shift+Z',
                description: 'Redo last undone action',
                execute: () => {
                    useEditorStore.getState().triggerAction('redo');
                },
            },
            {
                id: 'edit.find',
                label: 'Find',
                category: 'edit',
                shortcut: 'Ctrl+F',
                description: 'Find in current file',
                execute: () => {
                    useEditorStore.getState().triggerAction('find');
                },
            },
            {
                id: 'edit.replace',
                label: 'Find and Replace',
                category: 'edit',
                shortcut: 'Ctrl+H',
                description: 'Find and replace in current file',
                execute: () => {
                    useEditorStore.getState().triggerAction('replace');
                },
            },
            {
                id: 'edit.format',
                label: 'Format Document',
                category: 'edit',
                shortcut: 'Shift+Alt+F',
                description: 'Format the current document',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    useEditorStore.getState().triggerAction('formatDocument');
                },
            },

            // ================================================================
            // View Commands
            // ================================================================
            {
                id: 'view.toggleSidebar',
                label: 'Toggle Sidebar',
                category: 'view',
                shortcut: 'Ctrl+B',
                description: 'Show or hide the sidebar',
                execute: () => {
                    useWorkbenchStore.getState().toggleSidebar();
                },
            },
            {
                id: 'view.toggleBuildPanel',
                label: 'Toggle Problems/Terminal Panel',
                category: 'view',
                shortcut: 'Ctrl+`',
                description: 'Show or hide the bottom panel',
                execute: () => {
                    useBuildPanelStore.getState().togglePanel();
                },
            },
            {
                id: 'view.toggleAgent',
                label: 'Toggle AI Agent Panel',
                category: 'view',
                shortcut: 'Ctrl+L',
                description: 'Show or hide the AI assistant panel',
                execute: () => {
                    useAgentStore.getState().togglePanel();
                },
            },
            {
                id: 'view.focusExplorer',
                label: 'Focus on Explorer',
                category: 'view',
                shortcut: 'Ctrl+Shift+E',
                description: 'Open and focus the file explorer',
                execute: () => {
                    useWorkbenchStore.getState().setActiveActivity('files');
                },
            },
            {
                id: 'view.focusSearch',
                label: 'Focus on Search',
                category: 'view',
                shortcut: 'Ctrl+Shift+F',
                description: 'Open and focus the search panel',
                execute: () => {
                    useWorkbenchStore.getState().setActiveActivity('search');
                },
            },
            {
                id: 'view.focusGit',
                label: 'Focus on Source Control',
                category: 'view',
                shortcut: 'Ctrl+Shift+G',
                description: 'Open and focus the git panel',
                execute: () => {
                    useWorkbenchStore.getState().setActiveActivity('git');
                },
            },

            // ================================================================
            // Go Commands
            // ================================================================
            {
                id: 'go.toLine',
                label: 'Go to Line...',
                category: 'go',
                shortcut: 'Ctrl+G',
                description: 'Go to a specific line number',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    useEditorStore.getState().triggerAction('gotoLine');
                },
            },
            {
                id: 'go.toFile',
                label: 'Go to File...',
                category: 'go',
                shortcut: 'Ctrl+P',
                description: 'Quickly open a file by name',
                execute: () => {
                    useWorkbenchStore.getState().setActiveActivity('search');
                },
            },
            {
                id: 'go.toSymbolWorkspace',
                label: 'Go to Symbol in Workspace...',
                category: 'go',
                shortcut: 'Ctrl+T',
                description: 'Search for a symbol across all files',
                execute: () => {
                    useNavigationStore.getState().openSymbolSearch();
                },
            },
            {
                id: 'go.toSymbolFile',
                label: 'Go to Symbol in Editor...',
                category: 'go',
                shortcut: 'Ctrl+Shift+O',
                description: 'Search for a symbol in the current file',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    useNavigationStore.getState().openQuickOutline();
                },
            },
            {
                id: 'go.toDefinition',
                label: 'Go to Definition',
                category: 'go',
                shortcut: 'F12',
                description: 'Go to the definition of the symbol under cursor',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // Trigger Monaco's built-in go to definition
                    const event = new KeyboardEvent('keydown', { key: 'F12', bubbles: true });
                    document.activeElement?.dispatchEvent(event);
                },
            },
            {
                id: 'go.peekDefinition',
                label: 'Peek Definition',
                category: 'go',
                shortcut: 'Alt+F12',
                description: 'Peek at the definition without leaving current position',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // Trigger Monaco's built-in peek definition
                    const event = new KeyboardEvent('keydown', { key: 'F12', altKey: true, bubbles: true });
                    document.activeElement?.dispatchEvent(event);
                },
            },
            {
                id: 'go.findReferences',
                label: 'Find All References',
                category: 'go',
                shortcut: 'Shift+F12',
                description: 'Find all references to the symbol under cursor',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // Trigger Monaco's built-in find references
                    const event = new KeyboardEvent('keydown', { key: 'F12', shiftKey: true, bubbles: true });
                    document.activeElement?.dispatchEvent(event);
                },
            },
            {
                id: 'go.nextProblem',
                label: 'Go to Next Problem',
                category: 'go',
                shortcut: 'F8',
                description: 'Navigate to the next error or warning',
                execute: () => {
                    useDiagnosticsStore.getState().goToNextDiagnostic();
                },
            },
            {
                id: 'go.previousProblem',
                label: 'Go to Previous Problem',
                category: 'go',
                shortcut: 'Shift+F8',
                description: 'Navigate to the previous error or warning',
                execute: () => {
                    useDiagnosticsStore.getState().goToPreviousDiagnostic();
                },
            },

            // ================================================================
            // Refactor Commands
            // ================================================================
            {
                id: 'refactor.rename',
                label: 'Rename Symbol',
                category: 'refactor',
                shortcut: 'F2',
                description: 'Rename the symbol under cursor',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // Monaco handles F2 natively, but this registers it in command palette
                    // Triggering via editor action
                    const event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
                    document.activeElement?.dispatchEvent(event);
                },
            },
            {
                id: 'refactor.extractVariable',
                label: 'Extract Variable',
                category: 'refactor',
                shortcut: 'Ctrl+Shift+V',
                description: 'Extract selected expression into a variable',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // This will be handled by the code action provider
                    console.log('[Refactor] Extract variable - triggered from command palette');
                },
            },
            {
                id: 'refactor.extractMethod',
                label: 'Extract Method',
                category: 'refactor',
                shortcut: 'Ctrl+Shift+M',
                description: 'Extract selected code into a method',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // This will be handled by the code action provider
                    console.log('[Refactor] Extract method - triggered from command palette');
                },
            },
            {
                id: 'refactor.quickFix',
                label: 'Quick Fix...',
                category: 'refactor',
                shortcut: 'Ctrl+.',
                description: 'Show quick fixes and code actions',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    // Trigger Monaco's quick fix menu
                    const event = new KeyboardEvent('keydown', { 
                        key: '.', 
                        ctrlKey: true, 
                        bubbles: true 
                    });
                    document.activeElement?.dispatchEvent(event);
                },
            },
            {
                id: 'refactor.organizeImports',
                label: 'Organize Imports',
                category: 'refactor',
                shortcut: 'Shift+Alt+O',
                description: 'Sort and remove unused imports',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    console.log('[Refactor] Organize imports - triggered from command palette');
                },
            },

            // ================================================================
            // Terminal Commands
            // ================================================================
            {
                id: 'terminal.new',
                label: 'New Terminal',
                category: 'terminal',
                shortcut: 'Ctrl+Shift+`',
                description: 'Create a new terminal instance',
                execute: async () => {
                    const { useTerminalStore } = await import('@/stores/terminal/useTerminalStore');
                    useBuildPanelStore.getState().openPanel();
                    useTerminalStore.getState().createTerminal();
                },
            },
            {
                id: 'terminal.focus',
                label: 'Focus Terminal',
                category: 'terminal',
                description: 'Focus the terminal panel',
                execute: () => {
                    useBuildPanelStore.getState().openPanel();
                },
            },
            {
                id: 'terminal.split',
                label: 'Split Terminal',
                category: 'terminal',
                description: 'Split the terminal view',
                execute: async () => {
                    const { useTerminalStore } = await import('@/stores/terminal/useTerminalStore');
                    useBuildPanelStore.getState().openPanel();
                    const store = useTerminalStore.getState();
                    if (store.layout === 'single') {
                        store.setLayout('split-horizontal');
                    }
                },
            },
            {
                id: 'terminal.kill',
                label: 'Kill Terminal',
                category: 'terminal',
                description: 'Kill the active terminal',
                execute: async () => {
                    const { useTerminalStore } = await import('@/stores/terminal/useTerminalStore');
                    const store = useTerminalStore.getState();
                    if (store.activeTerminalId) {
                        store.closeTerminal(store.activeTerminalId);
                    }
                },
            },
            {
                id: 'terminal.clear',
                label: 'Clear Terminal',
                category: 'terminal',
                description: 'Clear the terminal output',
                execute: async () => {
                    const { useTerminalStore } = await import('@/stores/terminal/useTerminalStore');
                    useTerminalStore.getState().clearTerminal();
                },
            },

            // ================================================================
            // Debug Commands
            // ================================================================
            {
                id: 'debug.start',
                label: 'Start Debugging',
                category: 'debug',
                shortcut: 'F5',
                description: 'Start a debug session',
                execute: () => {
                    const debugStore = useDebugStore.getState();
                    if (debugStore.session?.state === 'paused') {
                        debugStore.resumeSession();
                    } else if (!debugStore.session) {
                        debugStore.startSession('coreclr');
                    }
                },
            },
            {
                id: 'debug.stop',
                label: 'Stop Debugging',
                category: 'debug',
                shortcut: 'Shift+F5',
                description: 'Stop the current debug session',
                when: () => !!useDebugStore.getState().session,
                execute: () => {
                    useDebugStore.getState().stopSession();
                },
            },
            {
                id: 'debug.stepOver',
                label: 'Step Over',
                category: 'debug',
                shortcut: 'F10',
                description: 'Step over to next line',
                when: () => useDebugStore.getState().session?.state === 'paused',
                execute: () => {
                    useDebugStore.getState().stepOver();
                },
            },
            {
                id: 'debug.stepInto',
                label: 'Step Into',
                category: 'debug',
                shortcut: 'F11',
                description: 'Step into function call',
                when: () => useDebugStore.getState().session?.state === 'paused',
                execute: () => {
                    useDebugStore.getState().stepInto();
                },
            },
            {
                id: 'debug.stepOut',
                label: 'Step Out',
                category: 'debug',
                shortcut: 'Shift+F11',
                description: 'Step out of current function',
                when: () => useDebugStore.getState().session?.state === 'paused',
                execute: () => {
                    useDebugStore.getState().stepOut();
                },
            },
            {
                id: 'debug.toggleBreakpoint',
                label: 'Toggle Breakpoint',
                category: 'debug',
                shortcut: 'F9',
                description: 'Toggle breakpoint on current line',
                when: () => !!useEditorStore.getState().activeTabId,
                execute: () => {
                    const { activeTabId, tabs, cursorPosition } = useEditorStore.getState();
                    const activeTab = tabs.find(t => t.id === activeTabId);
                    if (activeTab && cursorPosition) {
                        useDebugStore.getState().toggleBreakpoint(activeTab.path, cursorPosition.line);
                    }
                },
            },
            {
                id: 'debug.openPanel',
                label: 'Open Debug Panel',
                category: 'debug',
                description: 'Open the debug panel',
                execute: () => {
                    useDebugStore.getState().openPanel();
                },
            },
            {
                id: 'debug.clearBreakpoints',
                label: 'Clear All Breakpoints',
                category: 'debug',
                description: 'Remove all breakpoints',
                when: () => useDebugStore.getState().breakpoints.length > 0,
                execute: () => {
                    useDebugStore.getState().clearAllBreakpoints();
                },
            },

            // ================================================================
            // Help Commands
            // ================================================================
            {
                id: 'help.showShortcuts',
                label: 'Keyboard Shortcuts Reference',
                category: 'help',
                shortcut: 'Ctrl+K Ctrl+S',
                description: 'Show all keyboard shortcuts',
                execute: () => {
                    // Open settings with shortcuts section (placeholder for now)
                    console.log('[Commands] Show keyboard shortcuts');
                },
            },
            {
                id: 'help.about',
                label: 'About Fluxel',
                category: 'help',
                description: 'Show version and about information',
                execute: () => {
                    console.log('[Commands] Show about dialog');
                },
            },
        ];

        // Register all commands
        commands.forEach(cmd => registerCommand(cmd));

        // No cleanup needed - commands persist for app lifetime
    }, [registerCommand]);
}

/**
 * Hook to register custom commands
 * @param commands Array of commands to register
 */
export function useRegisterCommands(commands: Command[]) {
    const registerCommand = useCommandStore(state => state.registerCommand);
    const unregisterCommand = useCommandStore(state => state.unregisterCommand);

    useEffect(() => {
        commands.forEach(cmd => registerCommand(cmd));

        return () => {
            commands.forEach(cmd => unregisterCommand(cmd.id));
        };
    }, [commands, registerCommand, unregisterCommand]);
}

