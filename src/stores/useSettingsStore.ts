import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EditorMode } from './useWorkbenchStore';

export type Theme = 'light' | 'dark';
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'red';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';

// Density preset configuration for layout defaults
export interface DensityConfig {
    sidebarDefaultSize: number;
    sidebarMinSize: number;
    sidebarMaxSize: number;
    radius: string;
    radiusSm: string;
    radiusLg: string;
    spacingUnit: string;
    densityGap: string;
    densityPaddingSm: string;
    densityPaddingMd: string;
    densityPaddingLg: string;
    densityGapSm: string;
    densityGapMd: string;
    densityGapLg: string;
    panelHandleWidth: string;
    panelHandleActiveWidth: string;
}

export const densityConfigs: Record<UIDensity, DensityConfig> = {
    compact: {
        sidebarDefaultSize: 10,
        sidebarMinSize: 7,
        sidebarMaxSize: 20,
        radius: '0.5rem',
        radiusSm: '0.4rem',
        radiusLg: '0.8rem',
        spacingUnit: '0.35rem',
        densityGap: '0.25rem',
        densityPaddingSm: '0.25rem',
        densityPaddingMd: '0.5rem',
        densityPaddingLg: '0.75rem',
        densityGapSm: '0.125rem',
        densityGapMd: '0.5rem',
        densityGapLg: '0.75rem',
        panelHandleWidth: '2px',
        panelHandleActiveWidth: '3px',
    },
    comfortable: {
        sidebarDefaultSize: 17,
        sidebarMinSize: 10,
        sidebarMaxSize: 25,
        radius: '0.75rem',
        radiusSm: '0.5rem',
        radiusLg: '0.9rem',
        spacingUnit: '0.5rem',
        densityGap: '0.5rem',
        densityPaddingSm: '0.3rem',
        densityPaddingMd: '0.55rem',
        densityPaddingLg: '0.75rem',
        densityGapSm: '0.25rem',
        densityGapMd: '0.5rem',
        densityGapLg: '1rem',
        panelHandleWidth: '2px',
        panelHandleActiveWidth: '4px',
    },
    spacious: {
        sidebarDefaultSize: 20,
        sidebarMinSize: 15,
        sidebarMaxSize: 35,
        radius: '1rem',
        radiusSm: '0.75rem',
        radiusLg: '1rem',
        spacingUnit: '0.75rem',
        densityGap: '0.75rem',
        densityPaddingSm: '0.5rem',
        densityPaddingMd: '0.55rem',
        densityPaddingLg: '1.0rem',
        densityGapSm: '0.325rem',
        densityGapMd: '0.7rem',
        densityGapLg: '1rem',
        panelHandleWidth: '3px',
        panelHandleActiveWidth: '5px',
    },
};

const applyDensityConfigToRoot = (root: HTMLElement, config: DensityConfig) => {
    root.style.setProperty('--radius', config.radius);
    root.style.setProperty('--radius-sm', config.radiusSm);
    root.style.setProperty('--radius-lg', config.radiusLg);
    root.style.setProperty('--spacing-unit', config.spacingUnit);
    root.style.setProperty('--density-gap', config.densityGap);
    root.style.setProperty('--density-padding-sm', config.densityPaddingSm);
    root.style.setProperty('--density-padding-md', config.densityPaddingMd);
    root.style.setProperty('--density-padding-lg', config.densityPaddingLg);
    root.style.setProperty('--density-gap-sm', config.densityGapSm);
    root.style.setProperty('--density-gap-md', config.densityGapMd);
    root.style.setProperty('--density-gap-lg', config.densityGapLg);
    root.style.setProperty('--panel-handle-width', config.panelHandleWidth);
    root.style.setProperty('--panel-handle-active-width', config.panelHandleActiveWidth);
};

export interface SettingsState {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    uiDensity: UIDensity;

    // Editor Behavior
    fontSize: number;
    showMinimap: boolean;
    showLineNumbers: boolean;
    tabSize: number;
    wordWrap: boolean;
    autosaveDelay: number; // milliseconds

    // Autocomplete (Ollama)
    autocompleteEnabled: boolean;
    autocompleteModel: string;
    autocompleteEndpoint: string;
    autocompleteDebounceMs: number;

    // Workbench
    defaultEditorMode: EditorMode;

    // Setters
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: AccentColor) => void;
    setUIDensity: (density: UIDensity) => void;
    setFontSize: (size: number) => void;
    setShowMinimap: (show: boolean) => void;
    setShowLineNumbers: (show: boolean) => void;
    setTabSize: (size: number) => void;
    setWordWrap: (wrap: boolean) => void;
    setAutosaveDelay: (delay: number) => void;
    setAutocompleteEnabled: (enabled: boolean) => void;
    setAutocompleteModel: (model: string) => void;
    setAutocompleteEndpoint: (endpoint: string) => void;
    setAutocompleteDebounceMs: (delay: number) => void;
    setDefaultEditorMode: (mode: EditorMode) => void;
    initAppearance: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            // Appearance defaults
            theme: 'dark',
            accentColor: 'orange',
            uiDensity: 'comfortable' as UIDensity,

            // Editor Behavior defaults
            fontSize: 14,
            showMinimap: false,
            showLineNumbers: true,
            tabSize: 4,
            wordWrap: false,
            autosaveDelay: 1000, // 1 second

            // Autocomplete defaults
            autocompleteEnabled: false, // Opt-in feature
            autocompleteModel: 'qwen2.5-coder:1.5b',
            autocompleteEndpoint: 'http://localhost:11434',
            autocompleteDebounceMs: 300,

            // Workbench defaults
            defaultEditorMode: 'visual',

            setTheme: (theme) => {
                // Side effect: update document class
                const root = window.document.documentElement;
                root.setAttribute('data-theme', theme);
                if (theme === 'dark') {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }
                set({ theme });
            },
            setAccentColor: (accentColor) => {
                // Side effect: update document attribute
                const root = window.document.documentElement;
                root.setAttribute('data-accent', accentColor);
                set({ accentColor });
            },
            setUIDensity: (uiDensity) => {
                // Side effect: update document attribute
                const root = window.document.documentElement;
                root.setAttribute('data-density', uiDensity);
                applyDensityConfigToRoot(root, densityConfigs[uiDensity]);
                set({ uiDensity });
            },
            setFontSize: (fontSize) => set({ fontSize }),
            setShowMinimap: (showMinimap) => set({ showMinimap }),
            setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
            setTabSize: (tabSize) => set({ tabSize }),
            setWordWrap: (wordWrap) => set({ wordWrap }),
            setAutosaveDelay: (autosaveDelay) => set({ autosaveDelay }),
            setAutocompleteEnabled: (autocompleteEnabled) => set({ autocompleteEnabled }),
            setAutocompleteModel: (autocompleteModel) => set({ autocompleteModel }),
            setAutocompleteEndpoint: (autocompleteEndpoint) => set({ autocompleteEndpoint }),
            setAutocompleteDebounceMs: (autocompleteDebounceMs) => set({ autocompleteDebounceMs }),
            setDefaultEditorMode: (defaultEditorMode) => set({ defaultEditorMode }),
            initAppearance: () => {
                // Initialize all appearance settings on app load
                const state = get();
                const root = window.document.documentElement;

                // Initialize theme
                root.setAttribute('data-theme', state.theme);
                if (state.theme === 'dark') {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }

                // Initialize accent color
                root.setAttribute('data-accent', state.accentColor);

                // Initialize UI density
                root.setAttribute('data-density', state.uiDensity);
                applyDensityConfigToRoot(root, densityConfigs[state.uiDensity]);
            },
        }),
        {
            name: 'fluxel-settings',
        }
    )
);
