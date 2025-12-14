// ... existing code ...
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EditorMode } from './useWorkbenchStore';

export type Theme = 'light' | 'dark';
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'red';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';
export type IconPack =
    | 'material-design'  // Material Design + Simple Icons from react-icons
    | 'feather'          // Feather Icons from react-icons
    | 'heroicons'        // Heroicons 2 from react-icons
    | 'bootstrap'        // Bootstrap Icons from react-icons
    | 'phosphor'         // Phosphor Icons from react-icons
    | 'lucide'           // Lucide icons (standalone)
    | 'exuanbo'          // Exuanbo file icons
    | 'material';        // Material file icons
export type BuildSystem = 'auto' | 'dotnet' | 'bun' | 'npm' | 'manual';

// Editor customization types
export type CursorStyle = 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
export type CursorBlinking = 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
export type CursorSmoothCaretAnimation = 'off' | 'explicit' | 'on';
export type RenderWhitespace = 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
export type LineNumbers = 'on' | 'off' | 'relative' | 'interval';
export type RenderLineHighlight = 'none' | 'gutter' | 'line' | 'all';
export type WordWrapMode = 'off' | 'on' | 'wordWrapColumn' | 'bounded';
export type AutoClosingBehavior = 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
export type MinimapSide = 'left' | 'right';
export type MinimapShowSlider = 'always' | 'mouseover';
export type EditorFontFamily = 'JetBrains Mono' | 'Fira Code' | 'Cascadia Code' | 'Source Code Pro' | 'Consolas' | 'Monaco';
export type EditorFontWeight = 'normal' | 'bold';

// Density preset configuration for layout defaults
export interface DensityConfig {
    // Panel sizing
    sidebarDefaultSize: number;
    sidebarMinSize: number;
    sidebarMaxSize: number;

    // Border radius
    radius: string;
    radiusSm: string;
    radiusLg: string;

    // General spacing
    spacingUnit: string;
    densityGap: string;
    densityPaddingSm: string;
    densityPaddingMd: string;
    densityPaddingLg: string;
    densityGapSm: string;
    densityGapMd: string;
    densityGapLg: string;

    // Panel handles
    panelHandleWidth: string;
    panelHandleActiveWidth: string;

    // Component-specific sizing
    statusBarHeight: string;
    statusBarFontSize: string;
    activityBarWidth: string;
    activityBarIconSize: string;
    titleBarHeight: string;
    titleBarFontSize: string;
    tabBarHeight: string;
    tabBarFontSize: string;
    fileTreeItemHeight: string;
    fileTreeFontSize: string;
    fileTreeIconSize: string;

    // Scrollbar styling
    scrollbarWidth: string;
    scrollbarThumbRadius: string;
    scrollbarThumbBorderWidth: string;

    // Build Panel styling
    buildPanelHeaderHeight: string;
    buildPanelHeaderPaddingX: string;
    buildPanelHeaderPaddingY: string;
    buildPanelHeaderFontSize: string;
    buildPanelHeaderIconSize: string;
    buildPanelHeaderGap: string;
    buildPanelButtonPadding: string;
    buildPanelOutputPadding: string;
    buildPanelOutputFontSize: string;
    buildPanelOutputLineHeight: string;
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
        statusBarHeight: '1.0rem',
        statusBarFontSize: '0.625rem',
        activityBarWidth: '2.5rem',
        activityBarIconSize: '1rem',
        titleBarHeight: '2rem',
        titleBarFontSize: '0.75rem',
        tabBarHeight: '2rem',
        tabBarFontSize: '0.75rem',
        fileTreeItemHeight: '1.5rem',
        fileTreeFontSize: '0.75rem',
        fileTreeIconSize: '0.875rem',
        scrollbarWidth: '8px',
        scrollbarThumbRadius: '4px',
        scrollbarThumbBorderWidth: '1.5px',
        buildPanelHeaderHeight: '2rem',
        buildPanelHeaderPaddingX: '0.75rem',
        buildPanelHeaderPaddingY: '0.375rem',
        buildPanelHeaderFontSize: '0.6875rem',
        buildPanelHeaderIconSize: '0.875rem',
        buildPanelHeaderGap: '0.375rem',
        buildPanelButtonPadding: '0.25rem',
        buildPanelOutputPadding: '0.625rem',
        buildPanelOutputFontSize: '0.6875rem',
        buildPanelOutputLineHeight: '1.5',
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
        statusBarHeight: '1.5rem',
        statusBarFontSize: '0.6875rem',
        activityBarWidth: '3rem',
        activityBarIconSize: '1.25rem',
        titleBarHeight: '2.25rem',
        titleBarFontSize: '0.8125rem',
        tabBarHeight: '2.25rem',
        tabBarFontSize: '0.8125rem',
        fileTreeItemHeight: '1.75rem',
        fileTreeFontSize: '0.8125rem',
        fileTreeIconSize: '1rem',
        scrollbarWidth: '10px',
        scrollbarThumbRadius: '5px',
        scrollbarThumbBorderWidth: '2px',
        buildPanelHeaderHeight: '2.25rem',
        buildPanelHeaderPaddingX: '0.75rem',
        buildPanelHeaderPaddingY: '0.5rem',
        buildPanelHeaderFontSize: '0.75rem',
        buildPanelHeaderIconSize: '1rem',
        buildPanelHeaderGap: '0.5rem',
        buildPanelButtonPadding: '0.25rem',
        buildPanelOutputPadding: '0.75rem',
        buildPanelOutputFontSize: '0.75rem',
        buildPanelOutputLineHeight: '1.625',
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
        statusBarHeight: '1.75rem',
        statusBarFontSize: '0.75rem',
        activityBarWidth: '3.5rem',
        activityBarIconSize: '1.5rem',
        titleBarHeight: '2.5rem',
        titleBarFontSize: '0.875rem',
        tabBarHeight: '2.5rem',
        tabBarFontSize: '0.875rem',
        fileTreeItemHeight: '2rem',
        fileTreeFontSize: '0.875rem',
        fileTreeIconSize: '1.125rem',
        scrollbarWidth: '12px',
        scrollbarThumbRadius: '6px',
        scrollbarThumbBorderWidth: '2.5px',
        buildPanelHeaderHeight: '2.5rem',
        buildPanelHeaderPaddingX: '0.875rem',
        buildPanelHeaderPaddingY: '0.625rem',
        buildPanelHeaderFontSize: '0.8125rem',
        buildPanelHeaderIconSize: '1.125rem',
        buildPanelHeaderGap: '0.625rem',
        buildPanelButtonPadding: '0.375rem',
        buildPanelOutputPadding: '0.875rem',
        buildPanelOutputFontSize: '0.8125rem',
        buildPanelOutputLineHeight: '1.75',
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
    root.style.setProperty('--status-bar-height', config.statusBarHeight);
    root.style.setProperty('--status-bar-font-size', config.statusBarFontSize);
    root.style.setProperty('--activity-bar-width', config.activityBarWidth);
    root.style.setProperty('--activity-bar-icon-size', config.activityBarIconSize);
    root.style.setProperty('--title-bar-height', config.titleBarHeight);
    root.style.setProperty('--title-bar-font-size', config.titleBarFontSize);
    root.style.setProperty('--tab-bar-height', config.tabBarHeight);
    root.style.setProperty('--tab-bar-font-size', config.tabBarFontSize);
    root.style.setProperty('--file-tree-item-height', config.fileTreeItemHeight);
    root.style.setProperty('--file-tree-font-size', config.fileTreeFontSize);
    root.style.setProperty('--file-tree-icon-size', config.fileTreeIconSize);
    root.style.setProperty('--scrollbar-width', config.scrollbarWidth);
    root.style.setProperty('--scrollbar-thumb-radius', config.scrollbarThumbRadius);
    root.style.setProperty('--scrollbar-thumb-border-width', config.scrollbarThumbBorderWidth);
    root.style.setProperty('--build-panel-header-height', config.buildPanelHeaderHeight);
    root.style.setProperty('--build-panel-header-padding-x', config.buildPanelHeaderPaddingX);
    root.style.setProperty('--build-panel-header-padding-y', config.buildPanelHeaderPaddingY);
    root.style.setProperty('--build-panel-header-font-size', config.buildPanelHeaderFontSize);
    root.style.setProperty('--build-panel-header-icon-size', config.buildPanelHeaderIconSize);
    root.style.setProperty('--build-panel-header-gap', config.buildPanelHeaderGap);
    root.style.setProperty('--build-panel-button-padding', config.buildPanelButtonPadding);
    root.style.setProperty('--build-panel-output-padding', config.buildPanelOutputPadding);
    root.style.setProperty('--build-panel-output-font-size', config.buildPanelOutputFontSize);
    root.style.setProperty('--build-panel-output-line-height', config.buildPanelOutputLineHeight);
};

export interface SettingsState {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    uiDensity: UIDensity;
    iconPack: IconPack;

    // Editor - Font & Typography
    fontSize: number;
    fontFamily: EditorFontFamily;
    lineHeight: number;
    fontLigatures: boolean;
    fontWeight: EditorFontWeight;
    letterSpacing: number;

    // Editor - Cursor
    cursorStyle: CursorStyle;
    cursorBlinking: CursorBlinking;
    cursorWidth: number;
    cursorSmoothCaretAnimation: CursorSmoothCaretAnimation;

    // Editor - Whitespace & Indentation
    tabSize: number;
    insertSpaces: boolean;
    renderWhitespace: RenderWhitespace;
    renderIndentGuides: boolean;
    highlightActiveIndentGuide: boolean;

    // Editor - Display
    showLineNumbers: boolean;
    lineNumbers: LineNumbers;
    renderLineHighlight: RenderLineHighlight;
    bracketPairColorization: boolean;
    bracketPairGuides: boolean;
    folding: boolean;
    foldingHighlight: boolean;
    glyphMargin: boolean;

    // Editor - Behavior
    wordWrap: WordWrapMode;
    wordWrapColumn: number;
    smoothScrolling: boolean;
    scrollBeyondLastLine: boolean;
    stickyScroll: boolean;
    autosaveDelay: number;
    autoClosingBrackets: AutoClosingBehavior;
    autoClosingQuotes: AutoClosingBehavior;
    formatOnPaste: boolean;

    // Editor - Minimap
    showMinimap: boolean;
    minimapSide: MinimapSide;
    minimapScale: number;
    minimapMaxColumn: number;
    minimapShowSlider: MinimapShowSlider;

    // Autocomplete (Ollama)
    autocompleteEnabled: boolean;
    autocompleteModel: string;
    autocompleteEndpoint: string;
    autocompleteDebounceMs: number;

    // Workbench
    defaultEditorMode: EditorMode;

    // Build
    buildSystem: BuildSystem;
    customBuildCommand: string;

    // Version Control
    githubToken: string;

    // Setters - Appearance
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: AccentColor) => void;
    setUIDensity: (density: UIDensity) => void;
    setIconPack: (pack: IconPack) => void;

    // Setters - Editor Font
    setFontSize: (size: number) => void;
    setFontFamily: (family: EditorFontFamily) => void;
    setLineHeight: (height: number) => void;
    setFontLigatures: (enabled: boolean) => void;
    setFontWeight: (weight: EditorFontWeight) => void;
    setLetterSpacing: (spacing: number) => void;

    // Setters - Editor Cursor
    setCursorStyle: (style: CursorStyle) => void;
    setCursorBlinking: (blinking: CursorBlinking) => void;
    setCursorWidth: (width: number) => void;
    setCursorSmoothCaretAnimation: (animation: CursorSmoothCaretAnimation) => void;

    // Setters - Editor Whitespace
    setTabSize: (size: number) => void;
    setInsertSpaces: (insert: boolean) => void;
    setRenderWhitespace: (render: RenderWhitespace) => void;
    setRenderIndentGuides: (render: boolean) => void;
    setHighlightActiveIndentGuide: (highlight: boolean) => void;

    // Setters - Editor Display
    setShowLineNumbers: (show: boolean) => void;
    setLineNumbers: (lineNumbers: LineNumbers) => void;
    setRenderLineHighlight: (highlight: RenderLineHighlight) => void;
    setBracketPairColorization: (enabled: boolean) => void;
    setBracketPairGuides: (enabled: boolean) => void;
    setFolding: (enabled: boolean) => void;
    setFoldingHighlight: (enabled: boolean) => void;
    setGlyphMargin: (enabled: boolean) => void;

    // Setters - Editor Behavior
    setWordWrap: (wrap: WordWrapMode) => void;
    setWordWrapColumn: (column: number) => void;
    setSmoothScrolling: (enabled: boolean) => void;
    setScrollBeyondLastLine: (enabled: boolean) => void;
    setStickyScroll: (enabled: boolean) => void;
    setAutosaveDelay: (delay: number) => void;
    setAutoClosingBrackets: (behavior: AutoClosingBehavior) => void;
    setAutoClosingQuotes: (behavior: AutoClosingBehavior) => void;
    setFormatOnPaste: (enabled: boolean) => void;

    // Setters - Editor Minimap
    setShowMinimap: (show: boolean) => void;
    setMinimapSide: (side: MinimapSide) => void;
    setMinimapScale: (scale: number) => void;
    setMinimapMaxColumn: (column: number) => void;
    setMinimapShowSlider: (show: MinimapShowSlider) => void;

    // Setters - Autocomplete
    setAutocompleteEnabled: (enabled: boolean) => void;
    setAutocompleteModel: (model: string) => void;
    setAutocompleteEndpoint: (endpoint: string) => void;
    setAutocompleteDebounceMs: (delay: number) => void;

    // Setters - Workbench & Build
    setDefaultEditorMode: (mode: EditorMode) => void;
    setBuildSystem: (system: BuildSystem) => void;
    setCustomBuildCommand: (command: string) => void;
    setGithubToken: (token: string) => void;
    initAppearance: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            // Appearance defaults
            theme: 'dark',
            accentColor: 'orange',
            uiDensity: 'comfortable' as UIDensity,
            iconPack: 'material' as IconPack,

            // Editor - Font & Typography defaults
            fontSize: 14,
            fontFamily: 'JetBrains Mono' as EditorFontFamily,
            lineHeight: 1.5,
            fontLigatures: false,
            fontWeight: 'normal' as EditorFontWeight,
            letterSpacing: 0,

            // Editor - Cursor defaults
            cursorStyle: 'line' as CursorStyle,
            cursorBlinking: 'smooth' as CursorBlinking,
            cursorWidth: 2,
            cursorSmoothCaretAnimation: 'off' as CursorSmoothCaretAnimation,

            // Editor - Whitespace & Indentation defaults
            tabSize: 4,
            insertSpaces: true,
            renderWhitespace: 'selection' as RenderWhitespace,
            renderIndentGuides: true,
            highlightActiveIndentGuide: true,

            // Editor - Display defaults
            showLineNumbers: true,
            lineNumbers: 'on' as LineNumbers,
            renderLineHighlight: 'all' as RenderLineHighlight,
            bracketPairColorization: true,
            bracketPairGuides: true,
            folding: true,
            foldingHighlight: true,
            glyphMargin: true,

            // Editor - Behavior defaults
            wordWrap: 'off' as WordWrapMode,
            wordWrapColumn: 80,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            stickyScroll: false,
            autosaveDelay: 1000,
            autoClosingBrackets: 'languageDefined' as AutoClosingBehavior,
            autoClosingQuotes: 'languageDefined' as AutoClosingBehavior,
            formatOnPaste: true,

            // Editor - Minimap defaults
            showMinimap: false,
            minimapSide: 'right' as MinimapSide,
            minimapScale: 1,
            minimapMaxColumn: 120,
            minimapShowSlider: 'mouseover' as MinimapShowSlider,

            // Autocomplete defaults
            autocompleteEnabled: false,
            autocompleteModel: 'qwen2.5-coder:1.5b',
            autocompleteEndpoint: 'http://localhost:11434',
            autocompleteDebounceMs: 300,

            // Workbench defaults
            defaultEditorMode: 'visual',

            // Build defaults
            buildSystem: 'auto',
            customBuildCommand: '',

            // VC defaults
            githubToken: '',

            // Setters - Appearance
            setTheme: (theme) => {
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
                const root = window.document.documentElement;
                root.setAttribute('data-accent', accentColor);
                set({ accentColor });
            },
            setUIDensity: (uiDensity) => {
                const root = window.document.documentElement;
                root.setAttribute('data-density', uiDensity);
                applyDensityConfigToRoot(root, densityConfigs[uiDensity]);
                set({ uiDensity });
            },
            setIconPack: (iconPack) => set({ iconPack }),

            // Setters - Editor Font
            setFontSize: (fontSize) => set({ fontSize }),
            setFontFamily: (fontFamily) => set({ fontFamily }),
            setLineHeight: (lineHeight) => set({ lineHeight }),
            setFontLigatures: (fontLigatures) => set({ fontLigatures }),
            setFontWeight: (fontWeight) => set({ fontWeight }),
            setLetterSpacing: (letterSpacing) => set({ letterSpacing }),

            // Setters - Editor Cursor
            setCursorStyle: (cursorStyle) => set({ cursorStyle }),
            setCursorBlinking: (cursorBlinking) => set({ cursorBlinking }),
            setCursorWidth: (cursorWidth) => set({ cursorWidth }),
            setCursorSmoothCaretAnimation: (cursorSmoothCaretAnimation) => set({ cursorSmoothCaretAnimation }),

            // Setters - Editor Whitespace
            setTabSize: (tabSize) => set({ tabSize }),
            setInsertSpaces: (insertSpaces) => set({ insertSpaces }),
            setRenderWhitespace: (renderWhitespace) => set({ renderWhitespace }),
            setRenderIndentGuides: (renderIndentGuides) => set({ renderIndentGuides }),
            setHighlightActiveIndentGuide: (highlightActiveIndentGuide) => set({ highlightActiveIndentGuide }),

            // Setters - Editor Display
            setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
            setLineNumbers: (lineNumbers) => set({ lineNumbers }),
            setRenderLineHighlight: (renderLineHighlight) => set({ renderLineHighlight }),
            setBracketPairColorization: (bracketPairColorization) => set({ bracketPairColorization }),
            setBracketPairGuides: (bracketPairGuides) => set({ bracketPairGuides }),
            setFolding: (folding) => set({ folding }),
            setFoldingHighlight: (foldingHighlight) => set({ foldingHighlight }),
            setGlyphMargin: (glyphMargin) => set({ glyphMargin }),

            // Setters - Editor Behavior
            setWordWrap: (wordWrap) => set({ wordWrap }),
            setWordWrapColumn: (wordWrapColumn) => set({ wordWrapColumn }),
            setSmoothScrolling: (smoothScrolling) => set({ smoothScrolling }),
            setScrollBeyondLastLine: (scrollBeyondLastLine) => set({ scrollBeyondLastLine }),
            setStickyScroll: (stickyScroll) => set({ stickyScroll }),
            setAutosaveDelay: (autosaveDelay) => set({ autosaveDelay }),
            setAutoClosingBrackets: (autoClosingBrackets) => set({ autoClosingBrackets }),
            setAutoClosingQuotes: (autoClosingQuotes) => set({ autoClosingQuotes }),
            setFormatOnPaste: (formatOnPaste) => set({ formatOnPaste }),

            // Setters - Editor Minimap
            setShowMinimap: (showMinimap) => set({ showMinimap }),
            setMinimapSide: (minimapSide) => set({ minimapSide }),
            setMinimapScale: (minimapScale) => set({ minimapScale }),
            setMinimapMaxColumn: (minimapMaxColumn) => set({ minimapMaxColumn }),
            setMinimapShowSlider: (minimapShowSlider) => set({ minimapShowSlider }),

            // Setters - Autocomplete
            setAutocompleteEnabled: (autocompleteEnabled) => set({ autocompleteEnabled }),
            setAutocompleteModel: (autocompleteModel) => set({ autocompleteModel }),
            setAutocompleteEndpoint: (autocompleteEndpoint) => set({ autocompleteEndpoint }),
            setAutocompleteDebounceMs: (autocompleteDebounceMs) => set({ autocompleteDebounceMs }),

            // Setters - Workbench & Build
            setDefaultEditorMode: (defaultEditorMode) => set({ defaultEditorMode }),
            setBuildSystem: (buildSystem) => set({ buildSystem }),
            setCustomBuildCommand: (customBuildCommand) => set({ customBuildCommand }),
            setGithubToken: (githubToken) => set({ githubToken }),

            initAppearance: () => {
                const state = get();
                const root = window.document.documentElement;

                root.setAttribute('data-theme', state.theme);
                if (state.theme === 'dark') {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }

                root.setAttribute('data-accent', state.accentColor);
                root.setAttribute('data-density', state.uiDensity);
                applyDensityConfigToRoot(root, densityConfigs[state.uiDensity]);
            },
        }),
        {
            name: 'fluxel-settings',
        }
    )
);
